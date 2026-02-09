import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache for historical data (1 hour TTL)
interface HistoricalData {
  historical: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
}
const historyCache = new LRUCache<HistoricalData>({ maxSize: 300, ttlMs: 60 * 60 * 1000 });

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `${upperSymbol}:${from || ''}:${to || ''}`;

  // Check cache
  const cached = historyCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const queryOptions: { period1: Date; period2?: Date } = {
      period1: from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Default to 1 year ago
    };

    if (to) {
      queryOptions.period2 = new Date(to);
    }

    const result = await yahooFinance.chart(upperSymbol, queryOptions);

    if (!result || !result.quotes) {
      return NextResponse.json({ historical: [] });
    }

    const historical = result.quotes.map((item) => ({
      date: item.date.toISOString().split('T')[0],
      open: item.open ?? 0,
      high: item.high ?? 0,
      low: item.low ?? 0,
      close: item.close ?? 0,
      volume: item.volume ?? 0,
    }));

    const responseData: HistoricalData = { historical };
    historyCache.set(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
