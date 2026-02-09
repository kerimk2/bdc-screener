import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache with size limit (4 hours TTL)
const earningsCache = new LRUCache<EarningsData>({ maxSize: 200, ttlMs: 4 * 60 * 60 * 1000 });

interface EarningsData {
  symbol: string;
  nextEarningsDate: string | null;
  currentQuarterEstimate: number | null;
  currentYearEstimate: number | null;
  history: {
    quarter: string;
    date: string;
    estimated: number | null;
    actual: number | null;
    surprise: number | null;
    surprisePercent: number | null;
  }[];
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
    const earningsData: EarningsData[] = [];
    const symbolsToFetch: string[] = [];

    for (const symbol of symbols) {
      const cached = earningsCache.get(symbol);
      if (cached) {
        earningsData.push(cached);
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
                modules: ['earningsTrend', 'earningsHistory', 'calendarEvents'],
              });

              const earningsTrend = data.earningsTrend?.trend || [];
              const earningsHistory = data.earningsHistory?.history || [];
              const calendarEvents = data.calendarEvents;

              let nextEarningsDate: string | null = null;
              if (calendarEvents?.earnings?.earningsDate?.[0]) {
                nextEarningsDate = new Date(calendarEvents.earnings.earningsDate[0]).toISOString().split('T')[0];
              }

              const currentQuarter = earningsTrend.find(t => t.period === '0q');
              const currentYear = earningsTrend.find(t => t.period === '0y');

              const history = earningsHistory.map((h) => {
                // Yahoo Finance types are inconsistent - quarter can be an object with quarter/year props
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const q = h.quarter as any;
                const quarterStr = q && typeof q === 'object' && 'quarter' in q && 'year' in q
                  ? `Q${q.quarter} ${q.year}`
                  : 'Unknown';
                const dateStr = h.quarterDate
                  ? new Date(h.quarterDate as unknown as string | number | Date).toISOString().split('T')[0]
                  : 'Unknown';
                return {
                  quarter: quarterStr,
                  date: dateStr,
                  estimated: h.epsEstimate || null,
                  actual: h.epsActual || null,
                  surprise: h.epsDifference || null,
                  surprisePercent: h.surprisePercent ? h.surprisePercent * 100 : null,
                };
              });

              return {
                symbol,
                nextEarningsDate,
                currentQuarterEstimate: currentQuarter?.earningsEstimate?.avg || null,
                currentYearEstimate: currentYear?.earningsEstimate?.avg || null,
                history: history.slice(0, 4),
              };
            } catch (err) {
              console.error(`Error fetching earnings data for ${symbol}:`, err);
              return {
                symbol,
                nextEarningsDate: null,
                currentQuarterEstimate: null,
                currentYearEstimate: null,
                history: [],
              };
            }
          })
        );

        // Cache and collect results
        for (const result of batchResults) {
          earningsCache.set(result.symbol, result);
          earningsData.push(result);
        }
      }
    }

    // Build upcoming earnings list
    const upcomingEarnings: { symbol: string; date: string; daysUntil: number }[] = [];
    for (const data of earningsData) {
      if (data.nextEarningsDate) {
        const daysUntil = Math.ceil((new Date(data.nextEarningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= 30) {
          upcomingEarnings.push({ symbol: data.symbol, date: data.nextEarningsDate, daysUntil });
        }
      }
    }
    upcomingEarnings.sort((a, b) => a.daysUntil - b.daysUntil);

    // Calculate beat rate from history
    let totalBeats = 0;
    let totalReports = 0;
    for (const data of earningsData) {
      for (const h of data.history) {
        if (h.actual !== null && h.estimated !== null) {
          totalReports++;
          if (h.actual > h.estimated) totalBeats++;
        }
      }
    }

    const responseData = {
      earnings: earningsData,
      upcomingEarnings: upcomingEarnings.slice(0, 10),
      summary: {
        symbolsWithUpcoming: upcomingEarnings.length,
        nextEarningsDate: upcomingEarnings[0]?.date || null,
        nextEarningsSymbol: upcomingEarnings[0]?.symbol || null,
        historicalBeatRate: totalReports > 0 ? (totalBeats / totalReports) * 100 : null,
        totalReportsAnalyzed: totalReports,
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching earnings estimates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
