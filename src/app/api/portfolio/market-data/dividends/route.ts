import { NextRequest, NextResponse } from 'next/server';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// LRU Cache for dividend data (4 hours TTL)
const dividendCache = new LRUCache<DividendData[]>({ maxSize: 100, ttlMs: 4 * 60 * 60 * 1000 });

interface DividendData {
  symbol: string;
  date: string; // ex-date
  amount: number;
  payDate: string;
  recordDate: string;
  declarationDate: string;
  currency: string;
  frequency: string;
}

async function fetchDividendsFromFinnhub(symbol: string, from: string, to: string): Promise<DividendData[]> {
  if (!FINNHUB_API_KEY) return [];

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/stock/dividend?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`Finnhub rate limited for dividend: ${symbol}`);
        return [];
      }
      console.error(`Finnhub dividend API error for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) return [];

    return data.map((item: {
      symbol?: string;
      date?: string;
      amount?: number;
      payDate?: string;
      recordDate?: string;
      declarationDate?: string;
      currency?: string;
      freq?: string;
    }) => ({
      symbol: item.symbol || symbol,
      date: item.date || '',
      amount: item.amount || 0,
      payDate: item.payDate || '',
      recordDate: item.recordDate || '',
      declarationDate: item.declarationDate || '',
      currency: item.currency || 'USD',
      frequency: item.freq || '',
    }));
  } catch (err) {
    console.error(`Error fetching dividends for ${symbol}:`, err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');
  const range = searchParams.get('range') || 'upcoming'; // 'upcoming' or 'history'

  if (!symbols) {
    return NextResponse.json([]);
  }

  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbolList.length === 0) {
    return NextResponse.json([]);
  }

  // Check cache
  const cacheKey = `${[...symbolList].sort().join(',')}:${range}`;
  const cached = dividendCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const now = new Date();
    let from: string;
    let to: string;

    if (range === 'upcoming') {
      from = now.toISOString().split('T')[0];
      const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months ahead
      to = future.toISOString().split('T')[0];
    } else {
      const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year back
      from = past.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    }

    // Fetch dividends for each symbol (with rate limiting)
    const allDividends: DividendData[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < symbolList.length; i += BATCH_SIZE) {
      const batch = symbolList.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(symbol => fetchDividendsFromFinnhub(symbol, from, to))
      );
      allDividends.push(...results.flat());

      if (i + BATCH_SIZE < symbolList.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Sort by date
    allDividends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Cache results
    dividendCache.set(cacheKey, allDividends);

    return NextResponse.json(allDividends);
  } catch (error) {
    console.error('Error fetching dividends:', error);
    return NextResponse.json([]);
  }
}
