import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache with size limit (4 hours TTL)
interface SymbolInsiderData {
  transactions: InsiderTransaction[];
  summary: { buys: number; sells: number; netShares: number; netValue: number };
}
const insiderCache = new LRUCache<SymbolInsiderData>({ maxSize: 200, ttlMs: 4 * 60 * 60 * 1000 });

interface InsiderTransaction {
  symbol: string;
  name: string;
  relation: string;
  date: string;
  type: 'Buy' | 'Sell' | 'Exercise';
  shares: number;
  value: number;
  sharesOwned?: number;
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
    const cachedData: Map<string, SymbolInsiderData> = new Map();
    const symbolsToFetch: string[] = [];

    for (const symbol of symbols) {
      const cached = insiderCache.get(symbol);
      if (cached) {
        cachedData.set(symbol, cached);
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
                modules: ['insiderTransactions', 'insiderHolders'],
              });

              const transactions: InsiderTransaction[] = [];
              const summary = { buys: 0, sells: 0, netShares: 0, netValue: 0 };

              if (data.insiderTransactions?.transactions) {
                for (const tx of data.insiderTransactions.transactions) {
                  const transactionType = tx.transactionText?.toLowerCase() || '';
                  let type: 'Buy' | 'Sell' | 'Exercise' = 'Buy';

                  if (transactionType.includes('sale') || transactionType.includes('sell')) {
                    type = 'Sell';
                  } else if (transactionType.includes('exercise') || transactionType.includes('option')) {
                    type = 'Exercise';
                  }

                  const shares = tx.shares || 0;
                  const value = tx.value || 0;

                  transactions.push({
                    symbol,
                    name: tx.filerName || 'Unknown',
                    relation: tx.filerRelation || 'Unknown',
                    date: tx.startDate ? new Date(tx.startDate).toISOString().split('T')[0] : 'Unknown',
                    type,
                    shares: Math.abs(shares),
                    value: Math.abs(value),
                    sharesOwned: undefined,
                  });

                  if (type === 'Buy') {
                    summary.buys += 1;
                    summary.netShares += shares;
                    summary.netValue += value;
                  } else if (type === 'Sell') {
                    summary.sells += 1;
                    summary.netShares -= shares;
                    summary.netValue -= value;
                  }
                }
              }

              return { symbol, transactions, summary };
            } catch (err) {
              console.error(`Error fetching insider data for ${symbol}:`, err);
              return { symbol, transactions: [], summary: { buys: 0, sells: 0, netShares: 0, netValue: 0 } };
            }
          })
        );

        // Cache and collect results
        for (const result of batchResults) {
          insiderCache.set(result.symbol, { transactions: result.transactions, summary: result.summary });
          cachedData.set(result.symbol, { transactions: result.transactions, summary: result.summary });
        }
      }
    }

    // Aggregate results
    const allTransactions: InsiderTransaction[] = [];
    const summaryBySymbol: Record<string, { buys: number; sells: number; netShares: number; netValue: number }> = {};

    for (const symbol of symbols) {
      const data = cachedData.get(symbol);
      if (data) {
        allTransactions.push(...data.transactions);
        summaryBySymbol[symbol] = data.summary;
      } else {
        summaryBySymbol[symbol] = { buys: 0, sells: 0, netShares: 0, netValue: 0 };
      }
    }

    // Sort transactions by date (most recent first)
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const responseData = {
      transactions: allTransactions.slice(0, 100),
      summaryBySymbol,
      totalBuys: Object.values(summaryBySymbol).reduce((sum, s) => sum + s.buys, 0),
      totalSells: Object.values(summaryBySymbol).reduce((sum, s) => sum + s.sells, 0),
      netValue: Object.values(summaryBySymbol).reduce((sum, s) => sum + s.netValue, 0),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching insider activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
