import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// LRU Cache for fundamentals (4 hours TTL, fundamentals change quarterly)
const fundamentalsLRUCache = new LRUCache<FundamentalsData>({ maxSize: 200, ttlMs: 4 * 60 * 60 * 1000 });

// Helper to safely extract numeric values from Yahoo Finance responses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'object') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

export interface FundamentalsData {
  symbol: string;
  // Valuation
  peRatio: number | null;
  forwardPE: number | null;
  evToEbitda: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  // Growth
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  // Performance
  ytdReturn: number | null;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  // Dividends (forward)
  dividendYield: number | null;
  dividendRate: number | null;
  payoutRatio: number | null;
  // Dividends (trailing - actual paid over last 12 months)
  trailingAnnualDividendYield: number | null;
  trailingAnnualDividendRate: number | null;
  // Profitability
  profitMargin: number | null;
  operatingMargin: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  // Other
  beta: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  revenue: number | null;
  ebitda: number | null;
  // Additional financial metrics
  operatingCashflow: number | null;
  netIncome: number | null;
  freeCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  bookValue: number | null;
  // Asset type for filtering (stock, fund, etf)
  quoteType: string | null;
}

const NULL_FUNDAMENTALS: Omit<FundamentalsData, 'symbol'> = {
  peRatio: null,
  forwardPE: null,
  evToEbitda: null,
  priceToBook: null,
  priceToSales: null,
  revenueGrowth: null,
  earningsGrowth: null,
  ytdReturn: null,
  oneYearReturn: null,
  threeYearReturn: null,
  dividendYield: null,
  dividendRate: null,
  payoutRatio: null,
  trailingAnnualDividendYield: null,
  trailingAnnualDividendRate: null,
  profitMargin: null,
  operatingMargin: null,
  returnOnEquity: null,
  returnOnAssets: null,
  beta: null,
  marketCap: null,
  enterpriseValue: null,
  revenue: null,
  ebitda: null,
  operatingCashflow: null,
  netIncome: null,
  freeCashflow: null,
  totalDebt: null,
  totalCash: null,
  bookValue: null,
  quoteType: null,
};

async function fetchSingleFundamentals(symbol: string): Promise<FundamentalsData> {
  // Check per-symbol cache first
  const cached = fundamentalsLRUCache.get(symbol);
  if (cached) {
    return cached;
  }

  try {
    const summaryData = await yahooFinance.quoteSummary(symbol, {
      modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail', 'price'],
    });

    const keyStats = summaryData.defaultKeyStatistics;
    const financial = summaryData.financialData;
    const summary = summaryData.summaryDetail;
    const price = summaryData.price;

    const peRatio = toNumber(summary?.trailingPE) ?? toNumber(keyStats?.trailingPE);
    const forwardPE = toNumber(keyStats?.forwardPE) ?? toNumber(summary?.forwardPE);
    const revenueGrowth = toNumber(financial?.revenueGrowth);
    const earningsGrowth = toNumber(financial?.earningsGrowth);
    const weekChange = toNumber(keyStats?.['52WeekChange']);
    // For mutual funds, dividendYield is often undefined but 'yield' contains the distribution yield
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fundYield = toNumber((summary as any)?.yield);
    const divYield = toNumber(summary?.dividendYield) ?? fundYield;
    const payout = toNumber(summary?.payoutRatio);
    const profitMarg = toNumber(financial?.profitMargins);
    const opMarg = toNumber(financial?.operatingMargins);
    const roe = toNumber(financial?.returnOnEquity);
    const roa = toNumber(financial?.returnOnAssets);

    // Trailing dividend data (actual dividends paid over last 12 months)
    const trailingDivYield = toNumber(summary?.trailingAnnualDividendYield);
    const trailingDivRate = toNumber(summary?.trailingAnnualDividendRate);

    const result: FundamentalsData = {
      symbol,
      peRatio,
      forwardPE,
      evToEbitda: toNumber(keyStats?.enterpriseToEbitda),
      priceToBook: toNumber(keyStats?.priceToBook),
      priceToSales: toNumber(keyStats?.enterpriseToRevenue),
      revenueGrowth: revenueGrowth !== null ? revenueGrowth * 100 : null,
      earningsGrowth: earningsGrowth !== null ? earningsGrowth * 100 : null,
      // Use 52WeekChange from keyStats instead of expensive chart() call
      ytdReturn: null,
      oneYearReturn: weekChange !== null ? weekChange * 100 : null,
      threeYearReturn: null,
      // Forward dividends
      dividendYield: divYield !== null ? divYield * 100 : null,
      dividendRate: toNumber(summary?.dividendRate),
      payoutRatio: payout !== null ? payout * 100 : null,
      // Trailing dividends
      trailingAnnualDividendYield: trailingDivYield !== null ? trailingDivYield * 100 : null,
      trailingAnnualDividendRate: trailingDivRate,
      // Profitability
      profitMargin: profitMarg !== null ? profitMarg * 100 : null,
      operatingMargin: opMarg !== null ? opMarg * 100 : null,
      returnOnEquity: roe !== null ? roe * 100 : null,
      returnOnAssets: roa !== null ? roa * 100 : null,
      // Other
      beta: toNumber(keyStats?.beta) ?? toNumber(summary?.beta),
      marketCap: toNumber(price?.marketCap),
      enterpriseValue: toNumber(keyStats?.enterpriseValue),
      revenue: toNumber(financial?.totalRevenue),
      ebitda: toNumber(financial?.ebitda),
      // Additional financial metrics
      operatingCashflow: toNumber(financial?.operatingCashflow),
      netIncome: toNumber(financial?.netIncomeToCommon) ?? toNumber(keyStats?.netIncomeToCommon),
      freeCashflow: toNumber(financial?.freeCashflow),
      totalDebt: toNumber(financial?.totalDebt),
      totalCash: toNumber(financial?.totalCash),
      bookValue: toNumber(keyStats?.bookValue),
      quoteType: price?.quoteType || null,
    };

    fundamentalsLRUCache.set(symbol, result);
    return result;
  } catch (err) {
    console.error(`Error fetching fundamentals for ${symbol}:`, err);
    return { symbol, ...NULL_FUNDAMENTALS };
  }
}

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');

  if (!symbols) {
    return NextResponse.json({ error: 'Symbols required' }, { status: 400 });
  }

  try {
    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    // Fetch in parallel batches of 5 (avoid overwhelming Yahoo Finance)
    const BATCH_SIZE = 5;
    const results: FundamentalsData[] = [];

    for (let i = 0; i < symbolList.length; i += BATCH_SIZE) {
      const batch = symbolList.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(symbol => fetchSingleFundamentals(symbol))
      );
      results.push(...batchResults);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching fundamentals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
