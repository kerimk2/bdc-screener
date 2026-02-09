import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache for per-symbol historical data (1 hour TTL)
type SymbolHistory = { date: string; close: number }[];
const symbolHistoryCache = new LRUCache<SymbolHistory>({ maxSize: 200, ttlMs: 60 * 60 * 1000 });

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

  if (symbols.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 symbols allowed' }, { status: 400 });
  }

  // Check per-symbol cache and determine what needs fetching
  const result: Record<string, SymbolHistory> = {};
  const symbolsToFetch: string[] = [];

  for (const symbol of symbols) {
    const cached = symbolHistoryCache.get(symbol);
    if (cached) {
      result[symbol] = cached;
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // If all cached, return immediately
  if (symbolsToFetch.length === 0) {
    return NextResponse.json(result);
  }

  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // Process uncached symbols in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);

      const batchPromises = batch.map(async (symbol) => {
        try {
          const data = await yahooFinance.chart(symbol, {
            period1: oneYearAgo,
          });

          if (data && data.quotes) {
            const history: SymbolHistory = data.quotes.map((item) => ({
              date: item.date.toISOString().split('T')[0],
              close: item.close ?? 0,
            }));
            symbolHistoryCache.set(symbol, history);
            result[symbol] = history;
          } else {
            result[symbol] = [];
          }
        } catch (err) {
          console.error(`Error fetching history for ${symbol}:`, err);
          result[symbol] = [];
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < symbolsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching bulk historical data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
