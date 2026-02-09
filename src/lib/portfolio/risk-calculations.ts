import { CorrelationMatrix, FactorExposure, ScenarioResult, EnrichedPosition, AssetMetadata } from '@/types/portfolio';

interface HistoricalPriceData {
  [symbol: string]: { date: string; close: number }[];
}

// Calculate Pearson correlation coefficient between two arrays
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Calculate daily returns from price series
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

// Calculate correlation matrix for all positions
export function calculateCorrelationMatrix(
  historicalData: HistoricalPriceData,
  symbols: string[]
): CorrelationMatrix {
  // Deduplicate symbols (same stock in multiple accounts shows as 1:1 correlation)
  const uniqueSymbols = [...new Set(symbols)];

  const matrix: number[][] = [];
  const allCorrelations: { pair: [string, string]; value: number }[] = [];

  // Build returns for each unique symbol
  const returnsMap: { [symbol: string]: number[] } = {};

  for (const symbol of uniqueSymbols) {
    const prices = historicalData[symbol];
    if (prices && prices.length > 1) {
      const closePrices = prices.map(p => p.close);
      returnsMap[symbol] = calculateReturns(closePrices);
    } else {
      returnsMap[symbol] = [];
    }
  }

  // Calculate correlation matrix
  for (let i = 0; i < uniqueSymbols.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < uniqueSymbols.length; j++) {
      if (i === j) {
        row.push(1);
      } else {
        const corr = pearsonCorrelation(
          returnsMap[uniqueSymbols[i]] || [],
          returnsMap[uniqueSymbols[j]] || []
        );
        row.push(corr);

        // Track all correlations for unique pairs (i < j to avoid duplicates)
        if (i < j && !isNaN(corr)) {
          allCorrelations.push({
            pair: [uniqueSymbols[i], uniqueSymbols[j]],
            value: corr,
          });
        }
      }
    }
    matrix.push(row);
  }

  // Get top 10 highest correlations (excluding 1.0)
  const highCorrelations = [...allCorrelations]
    .filter(c => c.value < 0.99) // Exclude perfect correlations
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Get top 10 lowest correlations (most negative or least correlated)
  const lowCorrelations = [...allCorrelations]
    .sort((a, b) => a.value - b.value)
    .slice(0, 10);

  return {
    symbols: uniqueSymbols,
    matrix,
    highCorrelations,
    lowCorrelations,
  };
}

// Calculate portfolio volatility (annualized standard deviation)
export function calculatePortfolioVolatility(
  historicalData: HistoricalPriceData,
  positions: EnrichedPosition[]
): number {
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  if (totalValue === 0) return 0;

  // Calculate weighted returns
  const weightedReturns: number[] = [];
  const maxLength = Math.max(
    ...Object.values(historicalData).map(d => d.length)
  );

  for (let day = 1; day < maxLength; day++) {
    let dailyReturn = 0;
    for (const position of positions) {
      const prices = historicalData[position.symbol];
      if (prices && prices.length > day) {
        const weight = position.marketValue / totalValue;
        const dayReturn = (prices[day].close - prices[day - 1].close) / prices[day - 1].close;
        dailyReturn += weight * dayReturn;
      }
    }
    weightedReturns.push(dailyReturn);
  }

  // Calculate standard deviation and annualize
  if (weightedReturns.length === 0) return 0;
  const mean = weightedReturns.reduce((a, b) => a + b, 0) / weightedReturns.length;
  const variance = weightedReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / weightedReturns.length;
  const dailyVol = Math.sqrt(variance);

  // Annualize (252 trading days)
  return dailyVol * Math.sqrt(252);
}

// Calculate portfolio beta relative to benchmark
export function calculatePortfolioBeta(
  historicalData: HistoricalPriceData,
  positions: EnrichedPosition[],
  benchmarkSymbol: string = 'SPY'
): number {
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  if (totalValue === 0) return 0;

  const benchmarkPrices = historicalData[benchmarkSymbol];
  if (!benchmarkPrices || benchmarkPrices.length < 2) return 1;

  const benchmarkReturns = calculateReturns(benchmarkPrices.map(p => p.close));

  // Calculate weighted portfolio returns
  const portfolioReturns: number[] = [];
  for (let day = 0; day < benchmarkReturns.length; day++) {
    let dailyReturn = 0;
    for (const position of positions) {
      const prices = historicalData[position.symbol];
      if (prices && prices.length > day + 1) {
        const weight = position.marketValue / totalValue;
        const dayReturn = (prices[day + 1].close - prices[day].close) / prices[day].close;
        dailyReturn += weight * dayReturn;
      }
    }
    portfolioReturns.push(dailyReturn);
  }

  // Calculate covariance and variance
  const meanPortfolio = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
  const meanBenchmark = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;

  let covariance = 0;
  let benchmarkVariance = 0;

  for (let i = 0; i < Math.min(portfolioReturns.length, benchmarkReturns.length); i++) {
    covariance += (portfolioReturns[i] - meanPortfolio) * (benchmarkReturns[i] - meanBenchmark);
    benchmarkVariance += Math.pow(benchmarkReturns[i] - meanBenchmark, 2);
  }

  if (benchmarkVariance === 0) return 1;
  return covariance / benchmarkVariance;
}

// Calculate maximum drawdown
export function calculateMaxDrawdown(
  historicalData: HistoricalPriceData,
  positions: EnrichedPosition[]
): number {
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  if (totalValue === 0) return 0;

  // Calculate daily portfolio values
  const maxLength = Math.max(
    ...Object.values(historicalData).map(d => d.length)
  );

  const portfolioValues: number[] = [];
  for (let day = 0; day < maxLength; day++) {
    let dayValue = 0;
    for (const position of positions) {
      const prices = historicalData[position.symbol];
      if (prices && prices.length > day) {
        dayValue += position.shares * prices[day].close;
      }
    }
    portfolioValues.push(dayValue);
  }

  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = portfolioValues[0] || 0;

  for (const value of portfolioValues) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// Estimate factor exposures based on position characteristics
export function calculateFactorExposure(
  positions: EnrichedPosition[],
  metadataMap: Map<string, AssetMetadata>,
  quotesMap: Map<string, { pe: number | null; eps: number | null; marketCap: number | null }>
): FactorExposure {
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  if (totalValue === 0) {
    return { value: 0, growth: 0, momentum: 0, quality: 0, size: { small: 0, mid: 0, large: 0 } };
  }

  let valueScore = 0;
  let growthScore = 0;
  let momentumScore = 0;
  let qualityScore = 0;
  const sizeExposure = { small: 0, mid: 0, large: 0 };

  for (const position of positions) {
    const weight = position.marketValue / totalValue;
    const quote = quotesMap.get(position.symbol);
    const metadata = metadataMap.get(position.symbol);

    // Value factor: Low P/E = high value exposure
    if (quote?.pe && quote.pe > 0) {
      if (quote.pe < 15) valueScore += weight * 1;
      else if (quote.pe < 25) valueScore += weight * 0.5;
      else valueScore -= weight * 0.5;
    }

    // Growth factor: High earnings growth, tech/healthcare sectors
    const sector = metadata?.sector || '';
    if (['Technology', 'Healthcare', 'Consumer Cyclical'].includes(sector)) {
      growthScore += weight * 0.7;
    }
    if (quote?.pe && quote.pe > 30) {
      growthScore += weight * 0.5; // High P/E suggests growth expectations
    }

    // Momentum factor: Based on day change (simplified)
    if (position.dayChangePercent > 0) {
      momentumScore += weight * Math.min(position.dayChangePercent / 2, 1);
    } else {
      momentumScore -= weight * Math.min(Math.abs(position.dayChangePercent) / 2, 1);
    }

    // Quality factor: Positive earnings
    if (quote?.eps && quote.eps > 0) {
      qualityScore += weight * 0.8;
    }

    // Size factor
    const marketCap = metadata?.market_cap || quote?.marketCap || 0;
    if (marketCap > 0) {
      if (marketCap < 2e9) {
        sizeExposure.small += weight;
      } else if (marketCap < 10e9) {
        sizeExposure.mid += weight;
      } else {
        sizeExposure.large += weight;
      }
    }
  }

  return {
    value: Math.max(-1, Math.min(1, valueScore)),
    growth: Math.max(-1, Math.min(1, growthScore)),
    momentum: Math.max(-1, Math.min(1, momentumScore)),
    quality: Math.max(-1, Math.min(1, qualityScore)),
    size: sizeExposure,
  };
}

// Historical stress scenarios
export const HISTORICAL_SCENARIOS = [
  {
    name: '2008 Financial Crisis',
    description: 'Global financial meltdown triggered by subprime mortgage crisis',
    marketImpact: -0.568,
    sectorImpacts: {
      'Financial Services': -0.80,
      'Real Estate': -0.70,
      'Consumer Cyclical': -0.65,
      'Industrials': -0.60,
      'Technology': -0.55,
      'Energy': -0.55,
      'Basic Materials': -0.55,
      'Communication Services': -0.45,
      'Healthcare': -0.40,
      'Consumer Defensive': -0.35,
      'Utilities': -0.35,
    },
  },
  {
    name: 'COVID Crash (2020)',
    description: 'Market crash due to COVID-19 pandemic uncertainty',
    marketImpact: -0.339,
    sectorImpacts: {
      'Energy': -0.60,
      'Real Estate': -0.45,
      'Financial Services': -0.40,
      'Industrials': -0.40,
      'Consumer Cyclical': -0.35,
      'Communication Services': -0.30,
      'Basic Materials': -0.30,
      'Technology': -0.25,
      'Healthcare': -0.20,
      'Consumer Defensive': -0.15,
      'Utilities': -0.20,
    },
  },
  {
    name: '2022 Bear Market',
    description: 'Rate hikes and inflation concerns',
    marketImpact: -0.254,
    sectorImpacts: {
      'Technology': -0.35,
      'Communication Services': -0.40,
      'Consumer Cyclical': -0.30,
      'Real Estate': -0.30,
      'Financial Services': -0.20,
      'Healthcare': -0.15,
      'Industrials': -0.15,
      'Basic Materials': -0.10,
      'Consumer Defensive': -0.05,
      'Energy': 0.20,
      'Utilities': -0.05,
    },
  },
  {
    name: 'Interest Rate Shock (+3%)',
    description: 'Rapid interest rate increase scenario',
    marketImpact: -0.20,
    sectorImpacts: {
      'Real Estate': -0.35,
      'Utilities': -0.25,
      'Technology': -0.25,
      'Consumer Cyclical': -0.20,
      'Financial Services': -0.10,
      'Industrials': -0.15,
      'Healthcare': -0.10,
      'Consumer Defensive': -0.10,
      'Energy': -0.10,
      'Basic Materials': -0.15,
      'Communication Services': -0.20,
    },
  },
  {
    name: 'Tech Selloff (-30%)',
    description: 'Technology sector specific correction',
    marketImpact: -0.15,
    sectorImpacts: {
      'Technology': -0.30,
      'Communication Services': -0.25,
      'Consumer Cyclical': -0.15,
      'Financial Services': -0.10,
      'Healthcare': -0.05,
      'Industrials': -0.05,
      'Consumer Defensive': 0,
      'Energy': 0,
      'Utilities': 0.05,
      'Real Estate': -0.05,
      'Basic Materials': -0.05,
    },
  },
];

// Calculate scenario impact on portfolio
export function calculateScenarioImpact(
  positions: EnrichedPosition[],
  metadataMap: Map<string, AssetMetadata>,
  scenario: typeof HISTORICAL_SCENARIOS[0]
): ScenarioResult {
  const positionImpacts: { symbol: string; impact: number; value: number }[] = [];
  let totalPortfolioImpact = 0;
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  for (const position of positions) {
    const metadata = metadataMap.get(position.symbol);
    const sector = metadata?.sector || 'Unknown';

    // Get sector-specific impact or use market impact as fallback
    const sectorImpact = scenario.sectorImpacts[sector as keyof typeof scenario.sectorImpacts]
      ?? scenario.marketImpact;

    const impactValue = position.marketValue * sectorImpact;
    const weight = position.marketValue / totalValue;

    positionImpacts.push({
      symbol: position.symbol,
      impact: sectorImpact,
      value: impactValue,
    });

    totalPortfolioImpact += weight * sectorImpact;
  }

  // Sort by absolute impact
  positionImpacts.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    name: scenario.name,
    description: scenario.description,
    marketImpact: scenario.marketImpact,
    portfolioImpact: totalPortfolioImpact,
    positionImpacts,
  };
}

// Calculate all scenario results
export function runAllScenarios(
  positions: EnrichedPosition[],
  metadataMap: Map<string, AssetMetadata>
): ScenarioResult[] {
  return HISTORICAL_SCENARIOS.map(scenario =>
    calculateScenarioImpact(positions, metadataMap, scenario)
  );
}
