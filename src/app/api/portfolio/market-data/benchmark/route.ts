import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache for benchmark data (1 hour TTL - historical data doesn't change much)
interface BenchmarkData {
  symbol: string;
  historical: { date: string; open: number; high: number; low: number; close: number; adjClose: number; volume: number }[];
  dailyReturns: { date: string; return: number }[];
  cumulativeReturns: { date: string; value: number }[];
  totalReturn: number;
}
const benchmarkCache = new LRUCache<BenchmarkData>({ maxSize: 50, ttlMs: 60 * 60 * 1000 });

export async function GET(request: NextRequest) {
  // Cleanup old cache entries periodically
  cleanupCachesIfNeeded();
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol') || 'SPY';
  const period = searchParams.get('period') || '1y'; // 1m, 3m, 6m, ytd, 1y, 3y, 5y

  // Check cache
  const cacheKey = `${symbol}:${period}`;
  const cached = benchmarkCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Calculate period dates
    const now = new Date();
    let period1: Date;

    switch (period) {
      case '1m':
        period1 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        period1 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        period1 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'ytd':
        period1 = new Date(now.getFullYear(), 0, 1);
        break;
      case '1y':
        period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case '3y':
        period1 = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
        break;
      case '5y':
        period1 = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    const result = await yahooFinance.chart(symbol, { period1 });

    if (!result || !result.quotes || result.quotes.length === 0) {
      return NextResponse.json({
        symbol,
        historical: [],
        dailyReturns: [],
        cumulativeReturns: [],
        totalReturn: 0,
      });
    }

    // Map historical data
    const historical = result.quotes.map((item) => ({
      date: item.date.toISOString().split('T')[0],
      open: item.open ?? 0,
      high: item.high ?? 0,
      low: item.low ?? 0,
      close: item.close ?? 0,
      adjClose: item.adjclose ?? item.close ?? 0,
      volume: item.volume ?? 0,
    }));

    // Calculate daily returns
    const dailyReturns: { date: string; return: number }[] = [];
    for (let i = 1; i < historical.length; i++) {
      const prevClose = historical[i - 1].adjClose;
      const currClose = historical[i].adjClose;
      if (prevClose > 0) {
        dailyReturns.push({
          date: historical[i].date,
          return: (currClose - prevClose) / prevClose,
        });
      }
    }

    // Calculate cumulative returns (normalized to start at 100)
    const cumulativeReturns: { date: string; value: number }[] = [];
    let cumValue = 100;
    if (historical.length > 0) {
      cumulativeReturns.push({ date: historical[0].date, value: 100 });
      for (let i = 1; i < historical.length; i++) {
        const prevClose = historical[i - 1].adjClose;
        const currClose = historical[i].adjClose;
        if (prevClose > 0) {
          cumValue *= (currClose / prevClose);
          cumulativeReturns.push({ date: historical[i].date, value: cumValue });
        }
      }
    }

    // Total return for the period
    const firstPrice = historical[0]?.adjClose || 0;
    const lastPrice = historical[historical.length - 1]?.adjClose || 0;
    const totalReturn = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

    const responseData: BenchmarkData = {
      symbol,
      historical,
      dailyReturns,
      cumulativeReturns,
      totalReturn,
    };

    // Cache the result
    benchmarkCache.set(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching benchmark data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
