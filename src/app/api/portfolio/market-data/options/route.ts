import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// LRU Cache for options data (5 min TTL, options change frequently)
const optionsCache = new LRUCache<OptionsChainResponse>({ maxSize: 100, ttlMs: 5 * 60 * 1000 });

interface OptionContract {
  contractSymbol: string;
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  percentChange: number;
}

interface OptionsChainResponse {
  symbol: string;
  underlyingPrice: number;
  expirationDates: string[];
  options: {
    expirationDate: string;
    daysToExpiration: number;
    calls: OptionContract[];
    puts: OptionContract[];
  }[];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function calculateDaysToExpiration(expirationDate: string): number {
  const expiry = new Date(expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function transformOption(opt: {
  contractSymbol?: string;
  strike?: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
  percentChange?: number;
}): OptionContract {
  return {
    contractSymbol: opt.contractSymbol || '',
    strike: opt.strike || 0,
    bid: opt.bid || 0,
    ask: opt.ask || 0,
    lastPrice: opt.lastPrice || 0,
    volume: opt.volume || 0,
    openInterest: opt.openInterest || 0,
    impliedVolatility: opt.impliedVolatility || 0,
    inTheMoney: opt.inTheMoney || false,
    percentChange: opt.percentChange || 0,
  };
}

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const date = searchParams.get('date'); // Optional: specific expiration date

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `options:${upperSymbol}:${date || 'all'}`;

  // Check cache
  const cached = optionsCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // First fetch to get available expiration dates
    const initialResult = await yahooFinance.options(upperSymbol);

    if (!initialResult) {
      return NextResponse.json({ error: 'No options data available' }, { status: 404 });
    }

    // Get underlying price
    const underlyingPrice = initialResult.quote?.regularMarketPrice || 0;

    // Format expiration dates
    const expirationDates = (initialResult.expirationDates || []).map((d: Date) =>
      d.toISOString().split('T')[0]
    );

    // If a specific date was requested, only fetch that one
    if (date) {
      const optionsResult = await yahooFinance.options(upperSymbol, { date: new Date(date) });
      const optionsData: OptionsChainResponse['options'] = [];

      if (optionsResult?.options && optionsResult.options.length > 0) {
        for (const expiration of optionsResult.options) {
          const expirationDate = expiration.expirationDate
            ? new Date(expiration.expirationDate).toISOString().split('T')[0]
            : '';
          optionsData.push({
            expirationDate,
            daysToExpiration: calculateDaysToExpiration(expirationDate),
            calls: (expiration.calls || []).map(transformOption),
            puts: (expiration.puts || []).map(transformOption),
          });
        }
      }

      const response: OptionsChainResponse = {
        symbol: upperSymbol,
        underlyingPrice,
        expirationDates,
        options: optionsData,
      };
      optionsCache.set(cacheKey, response);
      return NextResponse.json(response);
    }

    // Fetch multiple expirations (first 6 to cover weekly through 45+ DTE)
    const optionsData: OptionsChainResponse['options'] = [];
    const datesToFetch = expirationDates.slice(0, 6);

    // Fetch all expirations in parallel
    const fetchPromises = datesToFetch.map(async (expDate) => {
      try {
        const result = await yahooFinance.options(upperSymbol, { date: new Date(expDate) });
        if (result?.options && result.options.length > 0) {
          const expiration = result.options[0];
          return {
            expirationDate: expDate,
            daysToExpiration: calculateDaysToExpiration(expDate),
            calls: (expiration.calls || []).map(transformOption),
            puts: (expiration.puts || []).map(transformOption),
          };
        }
        return null;
      } catch {
        console.error(`Failed to fetch options for ${upperSymbol} exp ${expDate}`);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    for (const result of results) {
      if (result) {
        optionsData.push(result);
      }
    }

    const response: OptionsChainResponse = {
      symbol: upperSymbol,
      underlyingPrice,
      expirationDates,
      options: optionsData,
    };

    // Cache the response
    optionsCache.set(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Error fetching options for ${upperSymbol}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch options data' },
      { status: 500 }
    );
  }
}
