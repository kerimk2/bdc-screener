/**
 * Options Calculations Library
 * Black-Scholes pricing, yield calculations, and backtesting utilities
 */

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Black-Scholes Call Option Price
 * Used for estimating option premiums when real data unavailable
 *
 * @param S - Current stock price
 * @param K - Strike price
 * @param T - Time to expiration in years
 * @param r - Risk-free rate (e.g., 0.05 for 5%)
 * @param sigma - Volatility (IV) as decimal (e.g., 0.30 for 30%)
 */
export function blackScholesCall(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return Math.max(0, S - K);
  if (sigma <= 0) return Math.max(0, S - K);

  const d1 = (Math.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

/**
 * Black-Scholes Put Option Price
 */
export function blackScholesPut(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return Math.max(0, K - S);
  if (sigma <= 0) return Math.max(0, K - S);

  const d1 = (Math.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

/**
 * Calculate historical volatility from price data
 * Uses rolling standard deviation of log returns, annualized
 *
 * @param prices - Array of prices with dates, sorted chronologically
 * @param window - Rolling window size (default 20 days)
 */
export function calculateHistoricalVolatility(
  prices: { date: string; close: number }[],
  window: number = 20
): { date: string; hv: number }[] {
  if (prices.length < window + 1) return [];

  const results: { date: string; hv: number }[] = [];

  // Calculate log returns
  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i].close > 0 && prices[i - 1].close > 0) {
      logReturns.push(Math.log(prices[i].close / prices[i - 1].close));
    }
  }

  // Rolling standard deviation
  for (let i = window; i < logReturns.length; i++) {
    const windowReturns = logReturns.slice(i - window, i);
    const mean = windowReturns.reduce((a, b) => a + b, 0) / window;
    const variance = windowReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (window - 1);
    const dailyStdDev = Math.sqrt(variance);
    const annualizedVol = dailyStdDev * Math.sqrt(252); // 252 trading days

    results.push({
      date: prices[i + 1]?.date || prices[i].date,
      hv: annualizedVol,
    });
  }

  return results;
}

/**
 * Calculate strike price based on moneyness
 *
 * @param currentPrice - Current stock price
 * @param moneynessPercent - Positive = OTM, Negative = ITM (e.g., 5 = 5% OTM)
 * @param strikeIncrement - Standard strike increment (usually $0.50, $1, $2.50, or $5)
 */
export function calculateStrike(
  currentPrice: number,
  moneynessPercent: number,
  strikeIncrement: number = 1
): number {
  const targetStrike = currentPrice * (1 + moneynessPercent / 100);
  return Math.round(targetStrike / strikeIncrement) * strikeIncrement;
}

/**
 * Find the closest available strike from options chain
 */
export function findClosestStrike(
  targetStrike: number,
  availableStrikes: number[]
): number {
  if (availableStrikes.length === 0) return targetStrike;
  return availableStrikes.reduce((prev, curr) =>
    Math.abs(curr - targetStrike) < Math.abs(prev - targetStrike) ? curr : prev
  );
}

/**
 * Calculate annualized premium yield
 *
 * @param premium - Premium received per share
 * @param stockPrice - Current stock price (capital at risk)
 * @param daysToExpiration - Days until expiration
 */
export function calculateAnnualizedYield(
  premium: number,
  stockPrice: number,
  daysToExpiration: number
): number {
  if (stockPrice <= 0 || daysToExpiration <= 0) return 0;

  // Premium yield per cycle (return on capital at risk)
  const cycleYield = premium / stockPrice;
  // Annualize: (1 + cycleYield)^(365/DTE) - 1
  const annualized = (Math.pow(1 + cycleYield, 365 / daysToExpiration) - 1) * 100;
  return annualized;
}

/**
 * Calculate yield if called (premium + capital gain)
 */
export function calculateYieldIfCalled(
  premium: number,
  strike: number,
  currentPrice: number,
  daysToExpiration: number
): number {
  if (currentPrice <= 0 || daysToExpiration <= 0) return 0;

  const capitalGain = Math.max(0, strike - currentPrice);
  const totalReturn = (premium + capitalGain) / currentPrice;
  const annualized = (Math.pow(1 + totalReturn, 365 / daysToExpiration) - 1) * 100;
  return annualized;
}

/**
 * Estimate assignment probability using delta approximation
 * Delta roughly represents the probability of finishing ITM
 */
export function estimateAssignmentProbability(
  currentPrice: number,
  strike: number,
  daysToExpiration: number,
  volatility: number,
  riskFreeRate: number = 0.05
): number {
  if (daysToExpiration <= 0 || volatility <= 0) {
    return currentPrice >= strike ? 100 : 0;
  }

  const T = daysToExpiration / 365;
  const d2 = (Math.log(currentPrice / strike) + (riskFreeRate - volatility ** 2 / 2) * T)
    / (volatility * Math.sqrt(T));
  return normalCDF(d2) * 100; // As percentage
}

/**
 * Calculate option delta (for calls)
 */
export function calculateDelta(
  currentPrice: number,
  strike: number,
  daysToExpiration: number,
  volatility: number,
  riskFreeRate: number = 0.05
): number {
  if (daysToExpiration <= 0 || volatility <= 0) {
    return currentPrice >= strike ? 1 : 0;
  }

  const T = daysToExpiration / 365;
  const d1 = (Math.log(currentPrice / strike) + (riskFreeRate + volatility ** 2 / 2) * T)
    / (volatility * Math.sqrt(T));
  return normalCDF(d1);
}

/**
 * Determine strike increment based on stock price
 */
export function getStrikeIncrement(price: number): number {
  if (price < 5) return 0.5;
  if (price < 25) return 1;
  if (price < 200) return 2.5;
  return 5;
}

/**
 * Get the number of contracts that can be written
 */
export function getContractCount(shares: number): number {
  return Math.floor(shares / 100);
}

/**
 * Calculate breakeven price for covered call
 */
export function calculateBreakeven(
  currentPrice: number,
  premium: number
): number {
  return currentPrice - premium;
}

/**
 * Calculate max profit for covered call
 */
export function calculateMaxProfit(
  shares: number,
  currentPrice: number,
  strike: number,
  premium: number
): number {
  const contracts = getContractCount(shares);
  const capitalGain = Math.max(0, strike - currentPrice) * contracts * 100;
  const premiumReceived = premium * contracts * 100;
  return capitalGain + premiumReceived;
}

export interface BacktestResult {
  startDate: string;
  endDate: string;
  totalPremiumCollected: number;
  totalCycles: number;
  assignmentCount: number;
  averagePremiumPerCycle: number;
  annualizedYield: number;
  premiumHistory: { date: string; cumulative: number; event: string }[];
}

/**
 * Simulate covered call strategy over historical period
 *
 * @param priceHistory - Historical prices sorted chronologically
 * @param shares - Number of shares held
 * @param moneynessPercent - Target moneyness (e.g., 5 for 5% OTM)
 * @param cycleDays - Days per cycle (7 for weekly, 30 for monthly, 45 for 45DTE)
 * @param volatilityEstimate - Estimated IV (default 30%)
 * @param riskFreeRate - Risk-free rate (default 5%)
 */
export function backtestCoveredCall(
  priceHistory: { date: string; close: number }[],
  shares: number,
  moneynessPercent: number,
  cycleDays: number,
  volatilityEstimate: number = 0.30,
  riskFreeRate: number = 0.05
): BacktestResult {
  const contracts = getContractCount(shares);
  if (contracts === 0 || priceHistory.length < cycleDays) {
    return {
      startDate: priceHistory[0]?.date || '',
      endDate: priceHistory[priceHistory.length - 1]?.date || '',
      totalPremiumCollected: 0,
      totalCycles: 0,
      assignmentCount: 0,
      averagePremiumPerCycle: 0,
      annualizedYield: 0,
      premiumHistory: [],
    };
  }

  let totalPremium = 0;
  let cycles = 0;
  let assignments = 0;
  const premiumHistory: { date: string; cumulative: number; event: string }[] = [];

  let i = 0;
  while (i < priceHistory.length - cycleDays) {
    const entryPrice = priceHistory[i].close;
    const entryDate = priceHistory[i].date;
    const expiryIndex = Math.min(i + cycleDays, priceHistory.length - 1);
    const expiryPrice = priceHistory[expiryIndex].close;
    const expiryDate = priceHistory[expiryIndex].date;

    // Calculate strike and premium using Black-Scholes
    const strike = calculateStrike(entryPrice, moneynessPercent, getStrikeIncrement(entryPrice));
    const T = cycleDays / 365;
    const premium = blackScholesCall(entryPrice, strike, T, riskFreeRate, volatilityEstimate);

    const cyclePremium = premium * contracts * 100;
    totalPremium += cyclePremium;
    cycles++;

    // Check for assignment
    const wasAssigned = expiryPrice >= strike;
    if (wasAssigned) {
      assignments++;
      premiumHistory.push({
        date: expiryDate,
        cumulative: totalPremium,
        event: `Assigned at $${strike.toFixed(2)}`,
      });
    } else {
      premiumHistory.push({
        date: expiryDate,
        cumulative: totalPremium,
        event: `Expired OTM`,
      });
    }

    i = expiryIndex; // Move to next cycle
  }

  const startValue = priceHistory[0].close * shares;
  const totalDays = priceHistory.length > 1
    ? (new Date(priceHistory[priceHistory.length - 1].date).getTime() -
       new Date(priceHistory[0].date).getTime()) / (1000 * 60 * 60 * 24)
    : 1;
  const annualizedYield = totalDays > 0
    ? (totalPremium / startValue) * (365 / totalDays) * 100
    : 0;

  return {
    startDate: priceHistory[0].date,
    endDate: priceHistory[priceHistory.length - 1].date,
    totalPremiumCollected: totalPremium,
    totalCycles: cycles,
    assignmentCount: assignments,
    averagePremiumPerCycle: cycles > 0 ? totalPremium / cycles : 0,
    annualizedYield,
    premiumHistory,
  };
}
