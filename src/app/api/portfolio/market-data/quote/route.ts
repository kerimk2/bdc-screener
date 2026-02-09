import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// LRU Cache for quotes (1 minute TTL - prices change frequently)
const quoteCache = new LRUCache<QuoteResult>({ maxSize: 500, ttlMs: 60 * 1000 });

// Cache exchange rates for 1 hour
const exchangeRateCache = new Map<string, { rate: number; timestamp: number }>();
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface QuoteResult {
  symbol: string;
  name: string;
  price: number;
  priceUSD: number;
  currency: string;
  exchangeRate: number;
  change: number;
  changesPercentage: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  pe: number | null;
  eps: number | null;
}

async function getExchangeRate(fromCurrency: string): Promise<number> {
  if (fromCurrency === 'USD') return 1;

  const cacheKey = `${fromCurrency}USD`;
  const cached = exchangeRateCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < RATE_CACHE_TTL) {
    return cached.rate;
  }

  try {
    // Yahoo Finance currency pair format: JPYUSD=X
    const quote = await yahooFinance.quote(`${fromCurrency}USD=X`);
    const rate = quote?.regularMarketPrice || 1;

    exchangeRateCache.set(cacheKey, { rate, timestamp: Date.now() });
    return rate;
  } catch (err) {
    console.error(`Error fetching exchange rate for ${fromCurrency}:`, err);
    // Return cached rate if available, otherwise 1
    return cached?.rate || 1;
  }
}

export async function GET(request: NextRequest) {
  // Periodic cache cleanup
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');

  if (!symbols) {
    return NextResponse.json({ error: 'Symbols required' }, { status: 400 });
  }

  try {
    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
    const results: QuoteResult[] = [];
    const symbolsToFetch: string[] = [];

    // Check cache first
    for (const symbol of symbolList) {
      const cached = quoteCache.get(symbol);
      if (cached) {
        results.push(cached);
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // If all symbols are cached, return early
    if (symbolsToFetch.length === 0) {
      return NextResponse.json(results);
    }

    // Fetch uncached quotes in parallel (batches of 10)
    const currenciesNeeded = new Set<string>();
    const quotesData: Array<{ quote: Awaited<ReturnType<typeof yahooFinance.quote>>; symbol: string }> = [];

    const batchSize = 10;
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const quote = await yahooFinance.quote(symbol);
            return quote ? { quote, symbol } : null;
          } catch (err) {
            console.error(`Error fetching quote for ${symbol}:`, err);
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result) {
          quotesData.push(result);
          if (result.quote.currency && result.quote.currency !== 'USD') {
            currenciesNeeded.add(result.quote.currency);
          }
        }
      }
    }

    // Fetch all exchange rates in parallel
    const ratePromises = Array.from(currenciesNeeded).map(async (currency) => {
      const rate = await getExchangeRate(currency);
      return { currency, rate };
    });
    const rates = await Promise.all(ratePromises);
    const rateMap = new Map(rates.map(r => [r.currency, r.rate]));
    rateMap.set('USD', 1);

    // Build results with converted prices and cache them
    for (const { quote, symbol } of quotesData) {
      const currency = quote.currency || 'USD';
      const exchangeRate = rateMap.get(currency) || 1;
      const price = quote.regularMarketPrice || 0;
      const priceUSD = price * exchangeRate;

      const quoteResult: QuoteResult = {
        symbol: quote.symbol || symbol,
        name: quote.shortName || quote.longName || symbol,
        price,
        priceUSD,
        currency,
        exchangeRate,
        change: quote.regularMarketChange || 0,
        changesPercentage: quote.regularMarketChangePercent || 0,
        dayLow: quote.regularMarketDayLow || 0,
        dayHigh: quote.regularMarketDayHigh || 0,
        yearLow: quote.fiftyTwoWeekLow || 0,
        yearHigh: quote.fiftyTwoWeekHigh || 0,
        marketCap: quote.marketCap ? quote.marketCap * exchangeRate : 0,
        volume: quote.regularMarketVolume || 0,
        avgVolume: quote.averageDailyVolume3Month || 0,
        open: quote.regularMarketOpen || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        pe: quote.trailingPE || null,
        eps: quote.epsTrailingTwelveMonths || null,
      };

      // Cache the result
      quoteCache.set(symbol, quoteResult);
      results.push(quoteResult);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
