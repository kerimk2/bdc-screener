import {
  EnrichedPosition,
  PortfolioSummary,
  PerformanceMetrics,
  RiskMetrics,
  SectorAllocation,
  GeographicAllocation,
  AssetTypeAllocation,
  HistoricalPrice,
} from '@/types/portfolio';

// Normalize sector names to handle variations from different data sources
function normalizeSectorName(sector: string): string {
  const sectorMap: Record<string, string> = {
    // Financial Services variants
    'Financial Services': 'Financial Services',
    'Financials': 'Financial Services',
    'Financial': 'Financial Services',

    // Consumer variants
    'Consumer Cyclical': 'Consumer Cyclical',
    'Consumer Discretionary': 'Consumer Cyclical',
    'Consumer Defensive': 'Consumer Defensive',
    'Consumer Staples': 'Consumer Defensive',

    // Technology variants
    'Technology': 'Technology',
    'Information Technology': 'Technology',
    'Tech': 'Technology',

    // Communication variants
    'Communication Services': 'Communication Services',
    'Telecommunications': 'Communication Services',
    'Telecom': 'Communication Services',

    // Healthcare variants
    'Healthcare': 'Healthcare',
    'Health Care': 'Healthcare',

    // Industrials variants
    'Industrials': 'Industrials',
    'Industrial': 'Industrials',

    // Energy
    'Energy': 'Energy',

    // Utilities
    'Utilities': 'Utilities',

    // Real Estate variants
    'Real Estate': 'Real Estate',
    'REIT': 'Real Estate',

    // Materials variants
    'Basic Materials': 'Basic Materials',
    'Materials': 'Basic Materials',

    // Other standard sectors
    'Fixed Income': 'Fixed Income',
    'Cash & Equivalents': 'Cash & Equivalents',
    'Commodities': 'Commodities',
    'Multi-Asset': 'Multi-Asset',
    'Index/Broad': 'Index/Broad',
  };

  return sectorMap[sector] || sector;
}

// Normalize country names to canonical display names
// Maps ISO codes and variants to a single display name
function normalizeCountryName(country: string): string {
  const countryMap: Record<string, string> = {
    // United States variants
    'US': 'United States',
    'USA': 'United States',
    'U.S': 'United States',
    'U.S.': 'United States',
    'United States': 'United States',
    'United States of America': 'United States',

    // Canada
    'CA': 'Canada',
    'Canada': 'Canada',

    // Mexico
    'MX': 'Mexico',
    'Mexico': 'Mexico',

    // United Kingdom variants
    'GB': 'United Kingdom',
    'UK': 'United Kingdom',
    'United Kingdom': 'United Kingdom',
    'Great Britain': 'United Kingdom',

    // Germany
    'DE': 'Germany',
    'Germany': 'Germany',

    // France
    'FR': 'France',
    'France': 'France',

    // Switzerland
    'CH': 'Switzerland',
    'Switzerland': 'Switzerland',

    // Netherlands
    'NL': 'Netherlands',
    'Netherlands': 'Netherlands',

    // Ireland
    'IE': 'Ireland',
    'Ireland': 'Ireland',

    // Italy
    'IT': 'Italy',
    'Italy': 'Italy',

    // Spain
    'ES': 'Spain',
    'Spain': 'Spain',

    // Sweden
    'SE': 'Sweden',
    'Sweden': 'Sweden',

    // Norway
    'NO': 'Norway',
    'Norway': 'Norway',

    // Denmark
    'DK': 'Denmark',
    'Denmark': 'Denmark',

    // Finland
    'FI': 'Finland',
    'Finland': 'Finland',

    // Belgium
    'BE': 'Belgium',
    'Belgium': 'Belgium',

    // Austria
    'AT': 'Austria',
    'Austria': 'Austria',

    // Portugal
    'PT': 'Portugal',
    'Portugal': 'Portugal',

    // Japan
    'JP': 'Japan',
    'Japan': 'Japan',

    // China
    'CN': 'China',
    'China': 'China',

    // Hong Kong
    'HK': 'Hong Kong',
    'Hong Kong': 'Hong Kong',

    // South Korea
    'KR': 'South Korea',
    'South Korea': 'South Korea',
    'Korea': 'South Korea',

    // Taiwan
    'TW': 'Taiwan',
    'Taiwan': 'Taiwan',

    // Singapore
    'SG': 'Singapore',
    'Singapore': 'Singapore',

    // Australia
    'AU': 'Australia',
    'Australia': 'Australia',

    // New Zealand
    'NZ': 'New Zealand',
    'New Zealand': 'New Zealand',

    // India
    'IN': 'India',
    'India': 'India',

    // Brazil
    'BR': 'Brazil',
    'Brazil': 'Brazil',

    // Israel
    'IL': 'Israel',
    'Israel': 'Israel',

    // UAE
    'AE': 'UAE',
    'UAE': 'UAE',
    'United Arab Emirates': 'UAE',

    // Saudi Arabia
    'SA': 'Saudi Arabia',
    'Saudi Arabia': 'Saudi Arabia',

    // South Africa
    'ZA': 'South Africa',
    'South Africa': 'South Africa',

    // Global/Other
    'Global': 'Global',
    'Other': 'Other',
  };

  return countryMap[country] || country;
}

// Region mapping for countries
function getRegionFromCountryCode(country: string): string {
  // First normalize the country name
  const normalized = normalizeCountryName(country);

  const regionMap: Record<string, string> = {
    'United States': 'North America',
    'Canada': 'North America',
    'Mexico': 'North America',
    'United Kingdom': 'Europe',
    'Germany': 'Europe',
    'France': 'Europe',
    'Switzerland': 'Europe',
    'Netherlands': 'Europe',
    'Ireland': 'Europe',
    'Italy': 'Europe',
    'Spain': 'Europe',
    'Sweden': 'Europe',
    'Norway': 'Europe',
    'Denmark': 'Europe',
    'Finland': 'Europe',
    'Belgium': 'Europe',
    'Austria': 'Europe',
    'Portugal': 'Europe',
    'Japan': 'Asia Pacific',
    'China': 'Asia Pacific',
    'Hong Kong': 'Asia Pacific',
    'South Korea': 'Asia Pacific',
    'Taiwan': 'Asia Pacific',
    'Singapore': 'Asia Pacific',
    'Australia': 'Asia Pacific',
    'New Zealand': 'Asia Pacific',
    'India': 'Asia Pacific',
    'Brazil': 'Emerging Markets',
    'South Africa': 'Emerging Markets',
    'Israel': 'Middle East',
    'UAE': 'Middle East',
    'Saudi Arabia': 'Middle East',
    'Global': 'Global',
    'Other': 'Other',
  };
  return regionMap[normalized] || 'Unknown';
}

// Portfolio summary calculations
export function calculatePortfolioSummary(positions: EnrichedPosition[], cashBalance: number = 0): PortfolioSummary {
  if (positions.length === 0 && cashBalance === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalGainLossPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
      positionCount: 0,
    };
  }

  const positionsValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalValue = positionsValue + cashBalance;
  const totalCost = positions.reduce((sum, p) => sum + p.cost_basis, 0);
  const totalGainLoss = positionsValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  // Calculate day change using percentage to handle currency conversion correctly
  // marketValue is already USD-adjusted and includes DRIP shares
  const dayChange = positions.reduce((sum, p) => {
    if (p.dayChangePercent === 0) return sum;
    // Previous value = current value / (1 + percent change)
    const prevValue = p.marketValue / (1 + p.dayChangePercent / 100);
    return sum + (p.marketValue - prevValue);
  }, 0);
  const previousValue = totalValue - dayChange;
  const dayChangePercent = previousValue > 0 ? (dayChange / previousValue) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    dayChange,
    dayChangePercent,
    positionCount: positions.length,
  };
}

// Allocation calculations
export function calculateSectorAllocation(positions: EnrichedPosition[], cashBalance: number = 0): SectorAllocation[] {
  const positionsValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalValue = positionsValue + cashBalance;
  if (totalValue === 0) return [];

  const sectorMap = new Map<string, { value: number; count: number }>();

  for (const position of positions) {
    // Use manual_sector if set, otherwise fall back to metadata
    const rawSector = position.manual_sector || position.metadata?.sector || 'Unknown';
    // Normalize sector name to handle variations (e.g., "Financials" vs "Financial Services")
    const sector = normalizeSectorName(rawSector);
    const existing = sectorMap.get(sector) || { value: 0, count: 0 };
    sectorMap.set(sector, {
      value: existing.value + position.marketValue,
      count: existing.count + 1,
    });
  }

  if (cashBalance > 0) {
    sectorMap.set('Cash', { value: cashBalance, count: 0 });
  }

  return Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      value: data.value,
      weight: (data.value / totalValue) * 100,
      count: data.count,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateGeographicAllocation(positions: EnrichedPosition[]): GeographicAllocation[] {
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  if (totalValue === 0) return [];

  const geoMap = new Map<string, { region: string; value: number; count: number }>();

  for (const position of positions) {
    // Use manual_country if set, otherwise fall back to metadata
    const rawCountry = position.manual_country || position.metadata?.country || 'Unknown';
    // Normalize country name to handle variants like "US" vs "United States"
    const country = normalizeCountryName(rawCountry);
    // Calculate region from the normalized country name
    const region = getRegionFromCountryCode(country);
    const existing = geoMap.get(country) || { region, value: 0, count: 0 };
    geoMap.set(country, {
      region,
      value: existing.value + position.marketValue,
      count: existing.count + 1,
    });
  }

  return Array.from(geoMap.entries())
    .map(([country, data]) => ({
      country,
      region: data.region,
      value: data.value,
      weight: (data.value / totalValue) * 100,
      count: data.count,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateAssetTypeAllocation(positions: EnrichedPosition[], cashBalance: number = 0): AssetTypeAllocation[] {
  const positionsValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalValue = positionsValue + cashBalance;
  if (totalValue === 0) return [];

  const typeMap = new Map<string, { value: number; count: number }>();

  for (const position of positions) {
    const assetType = position.asset_type;
    const existing = typeMap.get(assetType) || { value: 0, count: 0 };
    typeMap.set(assetType, {
      value: existing.value + position.marketValue,
      count: existing.count + 1,
    });
  }

  if (cashBalance > 0) {
    typeMap.set('cash', { value: cashBalance, count: 0 });
  }

  return Array.from(typeMap.entries())
    .map(([assetType, data]) => ({
      assetType,
      value: data.value,
      weight: (data.value / totalValue) * 100,
      count: data.count,
    }))
    .sort((a, b) => b.value - a.value);
}

// Cash flow interface for performance calculations
interface CashFlow {
  date: string;
  amount: number; // positive = inflow (deposit), negative = outflow (withdrawal)
  type: 'deposit' | 'withdrawal' | 'dividend' | 'fee' | 'other';
}

// Performance calculations
export function calculatePerformanceMetrics(
  positions: EnrichedPosition[],
  portfolioHistory?: { date: string; value: number }[],
  cashFlows?: CashFlow[]
): PerformanceMetrics {
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.cost_basis, 0);

  // Calculate net invested (total deposits - total withdrawals)
  let netDeposits = 0;
  let netWithdrawals = 0;
  let totalDividendsReceived = 0;
  let totalFeesPaid = 0;

  if (cashFlows && cashFlows.length > 0) {
    for (const cf of cashFlows) {
      if (cf.type === 'deposit') {
        netDeposits += cf.amount;
      } else if (cf.type === 'withdrawal') {
        netWithdrawals += Math.abs(cf.amount);
      } else if (cf.type === 'dividend') {
        totalDividendsReceived += cf.amount;
      } else if (cf.type === 'fee') {
        totalFeesPaid += Math.abs(cf.amount);
      }
    }
  }

  const netInvested = netDeposits - netWithdrawals;

  // Simple return: (Current Value - Total Cost) / Total Cost
  const totalReturn = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // Cash-flow adjusted return: (Current Value - Net Invested) / Net Invested
  // This shows the true gain/loss accounting for all money put in and taken out
  const cashFlowAdjustedReturn = netInvested > 0 ? totalValue - netInvested : totalReturn;
  const cashFlowAdjustedReturnPercent = netInvested > 0 ? (cashFlowAdjustedReturn / netInvested) * 100 : totalReturnPercent;

  // Calculate annualized return based on weighted average holding period
  let weightedDays = 0;
  let totalWeight = 0;

  for (const position of positions) {
    const purchaseDate = new Date(position.purchase_date);
    const today = new Date();
    const daysHeld = Math.max(1, Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
    const weight = position.cost_basis;
    weightedDays += daysHeld * weight;
    totalWeight += weight;
  }

  const avgDaysHeld = totalWeight > 0 ? weightedDays / totalWeight : 365;
  const yearsHeld = avgDaysHeld / 365;

  // Calculate annualized return with safeguards for edge cases
  let annualizedReturn: number;

  // For very short holding periods (< 30 days), annualization becomes unreliable
  // Just show the raw return instead of an extrapolated annualized figure
  if (yearsHeld < 30 / 365) {
    annualizedReturn = totalReturnPercent;
  } else if (yearsHeld > 0 && totalReturnPercent > -100) {
    // Standard annualization formula: (1 + return)^(1/years) - 1
    const rawAnnualized = (Math.pow(1 + totalReturnPercent / 100, 1 / yearsHeld) - 1) * 100;
    // Cap to reasonable bounds (-100% to +500%) to avoid displaying absurd numbers
    annualizedReturn = Math.max(-100, Math.min(500, rawAnnualized));
  } else {
    annualizedReturn = totalReturnPercent;
  }

  // Time-weighted return calculation using Modified Dietz method
  // This removes the impact of cash flows on performance measurement
  let timeWeightedReturn = totalReturnPercent;

  if (cashFlows && cashFlows.length > 0 && portfolioHistory && portfolioHistory.length > 1) {
    // Use Modified Dietz method for TWR approximation
    const startDate = new Date(portfolioHistory[portfolioHistory.length - 1].date);
    const endDate = new Date(portfolioHistory[0].date);
    const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const startValue = portfolioHistory[portfolioHistory.length - 1].value;
    const endValue = portfolioHistory[0].value;

    // Calculate weighted cash flows
    let weightedCashFlows = 0;
    let totalCashFlows = 0;

    for (const cf of cashFlows) {
      const cfDate = new Date(cf.date);
      if (cfDate >= startDate && cfDate <= endDate) {
        const daysRemaining = (endDate.getTime() - cfDate.getTime()) / (1000 * 60 * 60 * 24);
        const weight = daysRemaining / totalDays;
        const cfAmount = cf.type === 'withdrawal' ? -Math.abs(cf.amount) : cf.amount;
        weightedCashFlows += cfAmount * weight;
        totalCashFlows += cfAmount;
      }
    }

    // Modified Dietz formula: (End Value - Start Value - Cash Flows) / (Start Value + Weighted Cash Flows)
    const denominator = startValue + weightedCashFlows;
    if (denominator > 0) {
      timeWeightedReturn = ((endValue - startValue - totalCashFlows) / denominator) * 100;
    }
  }

  // Money-weighted return (Modified Dietz approximation of IRR)
  const moneyWeightedReturn = cashFlows && cashFlows.length > 0 ? cashFlowAdjustedReturnPercent : annualizedReturn;

  return {
    totalReturn,
    totalReturnPercent,
    annualizedReturn,
    timeWeightedReturn,
    moneyWeightedReturn,
  };
}

// Calculate net invested amount from transactions
export function calculateNetInvested(transactions: Array<{
  type: string;
  total_amount: number;
}>): { netDeposits: number; netWithdrawals: number; netInvested: number; totalDividends: number } {
  let netDeposits = 0;
  let netWithdrawals = 0;
  let totalDividends = 0;

  for (const tx of transactions) {
    if (tx.type === 'deposit') {
      netDeposits += tx.total_amount;
    } else if (tx.type === 'withdrawal') {
      netWithdrawals += tx.total_amount;
    } else if (tx.type === 'dividend' || tx.type === 'drip') {
      totalDividends += tx.total_amount;
    }
  }

  return {
    netDeposits,
    netWithdrawals,
    netInvested: netDeposits - netWithdrawals,
    totalDividends,
  };
}

// Risk calculations
export function calculateRiskMetrics(
  portfolioReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate: number = 0.05 // 5% annual risk-free rate
): RiskMetrics {
  if (portfolioReturns.length < 2) {
    return {
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      beta: 1,
      alpha: 0,
      rSquared: 0,
      informationRatio: 0,
      trackingError: 0,
      var95: 0,
    };
  }

  // Daily risk-free rate
  const dailyRfr = riskFreeRate / 252;

  // Calculate mean and standard deviation
  const mean = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
  const variance = portfolioReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (portfolioReturns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

  // Sharpe Ratio
  const excessReturns = portfolioReturns.map(r => r - dailyRfr);
  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgExcessReturn / stdDev) * Math.sqrt(252) : 0;

  // Sortino Ratio (downside deviation)
  const negativeReturns = excessReturns.filter(r => r < 0);
  const downsideVariance = negativeReturns.length > 0
    ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    : 0;
  const downsideDeviation = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideDeviation > 0 ? (avgExcessReturn / downsideDeviation) * Math.sqrt(252) : 0;

  // Max Drawdown
  let peak = -Infinity;
  let maxDrawdown = 0;
  let cumReturn = 1;
  for (const r of portfolioReturns) {
    cumReturn *= (1 + r);
    if (cumReturn > peak) peak = cumReturn;
    const drawdown = (peak - cumReturn) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  maxDrawdown *= 100; // Convert to percentage

  // Beta, Alpha, R-squared (if benchmark data available)
  let beta = 1;
  let alpha = 0;
  let rSquared = 0;
  let trackingError = 0;
  let informationRatio = 0;

  if (benchmarkReturns.length === portfolioReturns.length && benchmarkReturns.length > 0) {
    const benchmarkMean = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
    const benchmarkVariance = benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - benchmarkMean, 2), 0) / (benchmarkReturns.length - 1);

    // Covariance
    const covariance = portfolioReturns.reduce((sum, r, i) => {
      return sum + (r - mean) * (benchmarkReturns[i] - benchmarkMean);
    }, 0) / (portfolioReturns.length - 1);

    beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
    alpha = (mean - dailyRfr - beta * (benchmarkMean - dailyRfr)) * 252 * 100; // Annualized

    // R-squared
    const ssRes = portfolioReturns.reduce((sum, r, i) => {
      const predicted = benchmarkMean + beta * (benchmarkReturns[i] - benchmarkMean);
      return sum + Math.pow(r - predicted, 2);
    }, 0);
    const ssTot = portfolioReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0);
    rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    // Tracking Error
    const trackingDiff = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
    const trackingMean = trackingDiff.reduce((a, b) => a + b, 0) / trackingDiff.length;
    const trackingVariance = trackingDiff.reduce((sum, d) => sum + Math.pow(d - trackingMean, 2), 0) / (trackingDiff.length - 1);
    trackingError = Math.sqrt(trackingVariance) * Math.sqrt(252) * 100;

    // Information Ratio
    const avgTrackingDiff = trackingDiff.reduce((a, b) => a + b, 0) / trackingDiff.length;
    informationRatio = trackingError > 0 ? (avgTrackingDiff * 252 * 100) / trackingError : 0;
  }

  // Value at Risk (95%)
  const sortedReturns = [...portfolioReturns].sort((a, b) => a - b);
  const var95Index = Math.floor(portfolioReturns.length * 0.05);
  const var95 = -sortedReturns[var95Index] * 100; // Convert to positive percentage loss

  return {
    volatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    beta,
    alpha,
    rSquared,
    informationRatio,
    trackingError,
    var95,
  };
}

// Calculate daily returns from price history
export function calculateDailyReturns(prices: HistoricalPrice[]): number[] {
  const returns: number[] = [];
  const sortedPrices = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 1; i < sortedPrices.length; i++) {
    const prevClose = sortedPrices[i - 1].adjClose;
    const currClose = sortedPrices[i].adjClose;
    if (prevClose > 0) {
      returns.push((currClose - prevClose) / prevClose);
    }
  }

  return returns;
}

// Format helpers
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return formatCurrency(value);
}
