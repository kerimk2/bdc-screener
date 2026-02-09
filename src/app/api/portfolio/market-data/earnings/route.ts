import { NextRequest, NextResponse } from 'next/server';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// LRU Cache for earnings data (4 hours TTL)
const earningsCalendarCache = new LRUCache<EarningsEvent[]>({ maxSize: 100, ttlMs: 4 * 60 * 60 * 1000 });

interface EarningsEvent {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  hour: string; // 'bmo' | 'amc' | 'dmh'
}

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');
  const range = searchParams.get('range') || 'upcoming'; // 'upcoming' or 'past'

  if (!symbols) {
    return NextResponse.json([]);
  }

  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbolList.length === 0 || !FINNHUB_API_KEY) {
    return NextResponse.json([]);
  }

  // Check cache
  const cacheKey = `${[...symbolList].sort().join(',')}:${range}`;
  const cached = earningsCalendarCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const now = new Date();
    let from: string;
    let to: string;

    if (range === 'upcoming') {
      from = now.toISOString().split('T')[0];
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead
      to = future.toISOString().split('T')[0];
    } else {
      const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      from = past.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    }

    // Fetch earnings for each symbol
    const allEarnings: EarningsEvent[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < symbolList.length; i += BATCH_SIZE) {
      const batch = symbolList.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const response = await fetch(
              `${FINNHUB_BASE_URL}/calendar/earnings?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
            );

            if (!response.ok) {
              if (response.status === 429) {
                console.warn(`Finnhub rate limited for earnings: ${symbol}`);
              }
              return [];
            }

            const data = await response.json();

            if (!data.earningsCalendar || !Array.isArray(data.earningsCalendar)) {
              return [];
            }

            return data.earningsCalendar.map((item: {
              symbol?: string;
              date?: string;
              epsActual?: number;
              epsEstimate?: number;
              revenueActual?: number;
              revenueEstimate?: number;
              hour?: string;
            }) => ({
              symbol: item.symbol || symbol,
              date: item.date || '',
              epsActual: item.epsActual ?? null,
              epsEstimate: item.epsEstimate ?? null,
              revenueActual: item.revenueActual ?? null,
              revenueEstimate: item.revenueEstimate ?? null,
              hour: item.hour || 'dmh',
            }));
          } catch (err) {
            console.error(`Error fetching earnings for ${symbol}:`, err);
            return [];
          }
        })
      );
      allEarnings.push(...results.flat());

      if (i + BATCH_SIZE < symbolList.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Filter to only include symbols from our list
    const filteredEarnings = allEarnings.filter(e =>
      symbolList.includes(e.symbol.toUpperCase())
    );

    // Sort by date
    filteredEarnings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Cache results
    earningsCalendarCache.set(cacheKey, filteredEarnings);

    return NextResponse.json(filteredEarnings);
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json([]);
  }
}
