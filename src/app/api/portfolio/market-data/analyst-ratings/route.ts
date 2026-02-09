import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache with size limit (4 hours TTL)
const ratingsCache = new LRUCache<AnalystRating>({ maxSize: 200, ttlMs: 4 * 60 * 60 * 1000 });

interface AnalystRating {
  symbol: string;
  rating: string;
  score: number;
  targetPrice: number | null;
  currentPrice: number;
  upside: number | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
}

function getRatingLabel(score: number): string {
  if (score >= 4.5) return 'Strong Buy';
  if (score >= 3.5) return 'Buy';
  if (score >= 2.5) return 'Hold';
  if (score >= 1.5) return 'Sell';
  return 'Strong Sell';
}

export async function GET(request: NextRequest) {
  // Cleanup old cache entries periodically
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Symbols required' }, { status: 400 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'At least one symbol required' }, { status: 400 });
  }

  try {
    // Check per-symbol cache and determine what needs fetching
    const ratings: AnalystRating[] = [];
    const symbolsToFetch: string[] = [];

    for (const symbol of symbols) {
      const cached = ratingsCache.get(symbol);
      if (cached) {
        ratings.push(cached);
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // Fetch missing symbols in parallel batches
    if (symbolsToFetch.length > 0) {
      const batchSize = 5;
      for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
        const batch = symbolsToFetch.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            try {
              const data = await yahooFinance.quoteSummary(symbol, {
                modules: ['recommendationTrend', 'financialData', 'price'],
              });

              const trend = data.recommendationTrend?.trend?.[0];
              const financialData = data.financialData;
              const price = data.price;

              if (trend) {
                const strongBuy = trend.strongBuy || 0;
                const buy = trend.buy || 0;
                const hold = trend.hold || 0;
                const sell = trend.sell || 0;
                const strongSell = trend.strongSell || 0;
                const totalAnalysts = strongBuy + buy + hold + sell + strongSell;

                const score = totalAnalysts > 0
                  ? (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / totalAnalysts
                  : 3;

                const currentPrice = price?.regularMarketPrice || 0;
                const targetPrice = financialData?.targetMeanPrice || null;
                const upside = targetPrice && currentPrice > 0
                  ? ((targetPrice - currentPrice) / currentPrice) * 100
                  : null;

                return {
                  symbol,
                  rating: getRatingLabel(score),
                  score,
                  targetPrice,
                  currentPrice,
                  upside,
                  strongBuy,
                  buy,
                  hold,
                  sell,
                  strongSell,
                  totalAnalysts,
                };
              }
              return null;
            } catch (err) {
              console.error(`Error fetching analyst data for ${symbol}:`, err);
              return null;
            }
          })
        );

        // Cache and collect results
        for (const result of batchResults) {
          if (result) {
            ratingsCache.set(result.symbol, result);
            ratings.push(result);
          }
        }
      }
    }

    // Sort by score (highest first)
    ratings.sort((a, b) => b.score - a.score);

    // Calculate summary stats
    const avgScore = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;
    const ratingsWithUpside = ratings.filter(r => r.upside !== null);
    const avgUpside = ratingsWithUpside.length > 0
      ? ratingsWithUpside.reduce((sum, r) => sum + (r.upside || 0), 0) / ratingsWithUpside.length
      : null;

    const responseData = {
      ratings,
      summary: {
        averageRating: getRatingLabel(avgScore),
        averageScore: avgScore,
        averageUpside: avgUpside,
        totalAnalystsCovering: ratings.reduce((sum, r) => sum + r.totalAnalysts, 0),
        strongBuys: ratings.filter(r => r.score >= 4.5).length,
        buys: ratings.filter(r => r.score >= 3.5 && r.score < 4.5).length,
        holds: ratings.filter(r => r.score >= 2.5 && r.score < 3.5).length,
        sells: ratings.filter(r => r.score < 2.5).length,
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching analyst ratings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
