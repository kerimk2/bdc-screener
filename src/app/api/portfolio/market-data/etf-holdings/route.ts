import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { createClient } from '@supabase/supabase-js';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_URL;
  const key = process.env.PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Portfolio Supabase credentials not configured');
  return createClient(url, key);
}

// In-memory cache for ETF holdings (24 hours TTL)
const holdingsCache = new LRUCache<ETFHoldingsResponse>({
  maxSize: 100,
  ttlMs: 24 * 60 * 60 * 1000,
});

interface ETFHolding {
  symbol: string;
  name: string;
  weight: number;
  sector?: string;
}

interface ETFHoldingsResponse {
  etfSymbol: string;
  holdings: ETFHolding[];
  totalWeight: number;
  fetchedAt: string;
}

// GET /api/market-data/etf-holdings?symbols=SPY,QQQ,VTI
export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');
  const forceRefresh = searchParams.get('refresh') === 'true';

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Symbols required' }, { status: 400 });
  }

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: 'At least one symbol required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabase();
    const results: ETFHoldingsResponse[] = [];
    const symbolsToFetch: string[] = [];

    // Check cache first
    for (const symbol of symbols) {
      if (!forceRefresh) {
        const cached = holdingsCache.get(symbol);
        if (cached) {
          results.push(cached);
          continue;
        }
      }
      symbolsToFetch.push(symbol);
    }

    // Fetch missing symbols
    if (symbolsToFetch.length > 0) {
      const fetchPromises = symbolsToFetch.map(async (symbol) => {
        try {
          // Try to fetch from database cache first (shared across users)
          const { data: dbHoldings } = await supabase
            .from('etf_holdings_cache')
            .select('*')
            .eq('etf_symbol', symbol)
            .order('weight', { ascending: false });

          // Check if DB cache is fresh (within 24 hours)
          if (
            !forceRefresh &&
            dbHoldings &&
            dbHoldings.length > 0 &&
            new Date(dbHoldings[0].fetched_at).getTime() >
              Date.now() - 24 * 60 * 60 * 1000
          ) {
            const response: ETFHoldingsResponse = {
              etfSymbol: symbol,
              holdings: dbHoldings.map((h) => ({
                symbol: h.holding_symbol,
                name: h.holding_name || h.holding_symbol,
                weight: h.weight,
                sector: h.sector || undefined,
              })),
              totalWeight: dbHoldings.reduce((sum, h) => sum + h.weight, 0),
              fetchedAt: dbHoldings[0].fetched_at,
            };
            holdingsCache.set(symbol, response);
            return response;
          }

          // Fetch from Yahoo Finance
          const data = await yahooFinance.quoteSummary(symbol, {
            modules: ['topHoldings', 'assetProfile'],
          });

          const topHoldings = data.topHoldings;
          if (!topHoldings?.holdings || topHoldings.holdings.length === 0) {
            // Return empty result for non-ETFs or ETFs without holdings data
            const response: ETFHoldingsResponse = {
              etfSymbol: symbol,
              holdings: [],
              totalWeight: 0,
              fetchedAt: new Date().toISOString(),
            };
            holdingsCache.set(symbol, response);
            return response;
          }

          const holdings: ETFHolding[] = topHoldings.holdings
            .filter((h) => h.symbol && h.holdingPercent)
            .map((h) => ({
              symbol: h.symbol || 'UNKNOWN',
              name: h.holdingName || h.symbol || 'Unknown',
              weight: (h.holdingPercent || 0) * 100, // Convert to percentage
              sector: undefined, // Yahoo doesn't provide sector in topHoldings
            }));

          // Save to database cache
          if (holdings.length > 0) {
            const now = new Date().toISOString();
            const dbRecords = holdings.map((h) => ({
              etf_symbol: symbol,
              holding_symbol: h.symbol,
              holding_name: h.name,
              weight: h.weight,
              sector: h.sector,
              fetched_at: now,
            }));

            // Upsert holdings
            await supabase
              .from('etf_holdings_cache')
              .upsert(dbRecords, { onConflict: 'etf_symbol,holding_symbol' });
          }

          const response: ETFHoldingsResponse = {
            etfSymbol: symbol,
            holdings,
            totalWeight: holdings.reduce((sum, h) => sum + h.weight, 0),
            fetchedAt: new Date().toISOString(),
          };

          holdingsCache.set(symbol, response);
          return response;
        } catch (err) {
          console.error(`Error fetching holdings for ${symbol}:`, err);
          return {
            etfSymbol: symbol,
            holdings: [],
            totalWeight: 0,
            fetchedAt: new Date().toISOString(),
            error: 'Failed to fetch holdings',
          };
        }
      });

      const fetchedResults = await Promise.all(fetchPromises);
      results.push(...fetchedResults);
    }

    // Sort results to match input order
    const orderedResults = symbols.map(
      (symbol) =>
        results.find((r) => r.etfSymbol === symbol) || {
          etfSymbol: symbol,
          holdings: [],
          totalWeight: 0,
          fetchedAt: new Date().toISOString(),
        }
    );

    return NextResponse.json({
      etfs: orderedResults,
      totalETFs: orderedResults.length,
      etfsWithHoldings: orderedResults.filter((r) => r.holdings.length > 0)
        .length,
    });
  } catch (error) {
    console.error('Error fetching ETF holdings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
