import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache for search results (24 hours TTL, search results are stable)
interface SearchResult {
  symbol: string;
  name: string;
  exchangeShortName: string;
}
const searchCache = new LRUCache<SearchResult[]>({ maxSize: 500, ttlMs: 24 * 60 * 60 * 1000 });

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const cacheKey = query.toLowerCase();

  // Check cache
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const results = await yahooFinance.search(query, { quotesCount: 10 });

    interface YahooQuote {
      symbol?: string;
      shortname?: string;
      longname?: string;
      exchDisp?: string;
      exchange?: string;
      isYahooFinance?: boolean;
    }

    const mappedResults = ((results.quotes || []) as YahooQuote[])
      .filter((item) => item.isYahooFinance !== false)
      .slice(0, 10)
      .map((item) => ({
        symbol: item.symbol || '',
        name: item.shortname || item.longname || '',
        exchangeShortName: item.exchDisp || item.exchange || '',
      }));

    searchCache.set(cacheKey, mappedResults);
    return NextResponse.json(mappedResults);
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
