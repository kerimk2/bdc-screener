import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export interface BDCYahooData {
  price: number | null;
  dividend_yield: number | null;
  nav_per_share: number | null;
  debt_to_equity: number | null;
  market_cap: number | null;
  payout_ratio: number | null;
  beta: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  analyst_target_price: number | null;
  analyst_rating: string | null;
  institutional_ownership: number | null;
  five_yr_avg_dividend_yield: number | null;
  ex_dividend_date: string | null;
}

export async function fetchBDCData(ticker: string): Promise<BDCYahooData> {
  const result = await yf.quoteSummary(ticker.toUpperCase(), {
    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData'],
  });

  const price = result.price?.regularMarketPrice ?? null;
  const market_cap = result.price?.marketCap ?? null;

  // dividendYield from summaryDetail is a decimal (0.10 = 10%), convert to percentage
  let dividend_yield: number | null = null;
  if (result.summaryDetail?.dividendYield != null) {
    dividend_yield = result.summaryDetail.dividendYield * 100;
  } else if (result.defaultKeyStatistics?.trailingAnnualDividendYield != null) {
    dividend_yield = Number(result.defaultKeyStatistics.trailingAnnualDividendYield) * 100;
  }

  // BDCs report assets at fair value, so book value per share ~= NAV per share
  const nav_per_share = result.defaultKeyStatistics?.bookValue ?? null;

  // debtToEquity from Yahoo is a percentage (120 = 1.2x), convert to ratio
  let debt_to_equity: number | null = null;
  if (result.financialData?.debtToEquity != null) {
    debt_to_equity = result.financialData.debtToEquity / 100;
  }

  // New metrics
  const payout_ratio = result.summaryDetail?.payoutRatio ?? null;
  const beta = result.defaultKeyStatistics?.beta ?? null;
  const fifty_two_week_high = result.summaryDetail?.fiftyTwoWeekHigh ?? null;
  const fifty_two_week_low = result.summaryDetail?.fiftyTwoWeekLow ?? null;
  const analyst_target_price = result.financialData?.targetMeanPrice ?? null;
  const analyst_rating = result.financialData?.recommendationKey ?? null;
  const institutional_ownership = result.defaultKeyStatistics?.heldPercentInstitutions ?? null;
  const five_yr_avg_dividend_yield = result.summaryDetail?.fiveYearAvgDividendYield ?? null;

  // ex-dividend date comes as a Date object from Yahoo
  let ex_dividend_date: string | null = null;
  const exDivRaw = result.summaryDetail?.exDividendDate;
  if (exDivRaw instanceof Date) {
    ex_dividend_date = exDivRaw.toISOString().split('T')[0];
  }

  return {
    price, dividend_yield, nav_per_share, debt_to_equity,
    market_cap, payout_ratio, beta,
    fifty_two_week_high, fifty_two_week_low,
    analyst_target_price, analyst_rating,
    institutional_ownership, five_yr_avg_dividend_yield, ex_dividend_date,
  };
}
