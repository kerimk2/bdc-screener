import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache (4 hours TTL, max 200 entries)
const shortInterestCache = new LRUCache<ShortInterestResponse>({ maxSize: 200, ttlMs: 4 * 60 * 60 * 1000 });

interface ShortInterestData {
  symbol: string;
  shortPercentOfFloat: number | null;
  shortRatio: number | null;
  sharesShort: number | null;
  sharesShortPriorMonth: number | null;
  shortPercentChange: number | null;
  floatShares: number | null;
  avgVolume: number | null;
  daysTocover: number | null;
}

interface ShortInterestResponse {
  shortInterest: ShortInterestData[];
  summary: {
    averageShortPercent: number | null;
    highShortInterestCount: number;
    increasingShortCount: number;
    positionsWithData: number;
  };
}

export async function GET(request: NextRequest) {
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

  const cacheKey = symbols.sort().join(',');

  // Check cache
  const cached = shortInterestCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Fetch in parallel batches of 5
    const batchSize = 5;
    const shortInterestData: ShortInterestData[] = [];

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const data = await yahooFinance.quoteSummary(symbol, {
              modules: ['defaultKeyStatistics', 'summaryDetail'],
            });

            const stats = data.defaultKeyStatistics;
            const summary = data.summaryDetail;

            if (stats) {
              // Yahoo Finance types can be inconsistent - ensure we have numbers
              const sharesShort = typeof stats.sharesShort === 'number' ? stats.sharesShort : null;
              const sharesShortPriorMonth = typeof stats.sharesShortPriorMonth === 'number'
                ? stats.sharesShortPriorMonth
                : null;
              const avgVolume = typeof summary?.averageVolume === 'number' ? summary.averageVolume : null;

              const shortPercentChange = sharesShort !== null && sharesShortPriorMonth !== null && sharesShortPriorMonth !== 0
                ? ((sharesShort - sharesShortPriorMonth) / sharesShortPriorMonth) * 100
                : null;

              // Calculate days to cover: shares short / average daily volume
              const daysTocover = sharesShort && avgVolume && avgVolume > 0
                ? sharesShort / avgVolume
                : null;

              return {
                symbol,
                shortPercentOfFloat: stats.shortPercentOfFloat ? stats.shortPercentOfFloat * 100 : null,
                shortRatio: stats.shortRatio || null,
                sharesShort,
                sharesShortPriorMonth,
                shortPercentChange,
                floatShares: stats.floatShares || null,
                avgVolume,
                daysTocover,
              };
            }
            return null;
          } catch (err) {
            console.error(`Error fetching short interest for ${symbol}:`, err);
            return {
              symbol,
              shortPercentOfFloat: null,
              shortRatio: null,
              sharesShort: null,
              sharesShortPriorMonth: null,
              shortPercentChange: null,
              floatShares: null,
              avgVolume: null,
              daysTocover: null,
            } as ShortInterestData;
          }
        })
      );

      shortInterestData.push(...batchResults.filter((r): r is ShortInterestData => r !== null));

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Sort by short percent of float (highest first)
    shortInterestData.sort((a, b) => (b.shortPercentOfFloat || 0) - (a.shortPercentOfFloat || 0));

    // Calculate summary
    const withData = shortInterestData.filter(d => d.shortPercentOfFloat !== null);
    const avgShortPercent = withData.length > 0
      ? withData.reduce((sum, d) => sum + (d.shortPercentOfFloat || 0), 0) / withData.length
      : null;
    const highShortCount = withData.filter(d => (d.shortPercentOfFloat || 0) > 10).length;
    const increasingCount = shortInterestData.filter(d => d.shortPercentChange !== null && d.shortPercentChange > 0).length;

    const responseData: ShortInterestResponse = {
      shortInterest: shortInterestData,
      summary: {
        averageShortPercent: avgShortPercent,
        highShortInterestCount: highShortCount,
        increasingShortCount: increasingCount,
        positionsWithData: withData.length,
      },
    };

    shortInterestCache.set(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching short interest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
