/**
 * ETF Overlap Analysis
 * Calculates holdings overlap between ETFs in the portfolio
 * to identify concentration risks and redundancy
 */

import {
  ETFHolding,
  EnrichedPosition,
  OverlapAnalysis,
  OverlappingHolding,
  ETFOverlapMatrix,
  ConcentrationRisk,
} from '@/types/portfolio';

/**
 * Analyze ETF overlap for a portfolio
 */
export function analyzeETFOverlap(
  etfPositions: EnrichedPosition[],
  holdingsCache: ETFHolding[],
  totalPortfolioValue: number
): OverlapAnalysis {
  // Group holdings by ETF
  const holdingsByETF = new Map<string, ETFHolding[]>();
  for (const holding of holdingsCache) {
    const etfHoldings = holdingsByETF.get(holding.etf_symbol) || [];
    etfHoldings.push(holding);
    holdingsByETF.set(holding.etf_symbol, etfHoldings);
  }

  // Calculate position weights in portfolio
  const positionWeights = new Map<string, number>();
  for (const position of etfPositions) {
    const weight = totalPortfolioValue > 0
      ? (position.marketValue / totalPortfolioValue) * 100
      : 0;
    positionWeights.set(position.symbol.toUpperCase(), weight);
  }

  // Find overlapping holdings
  const overlappingHoldings = findOverlappingHoldings(
    etfPositions,
    holdingsByETF,
    positionWeights
  );

  // Calculate overlap matrix
  const overlapMatrix = calculateOverlapMatrix(etfPositions, holdingsByETF);

  // Identify concentration risks
  const concentrationRisks = identifyConcentrationRisks(
    overlappingHoldings,
    holdingsByETF
  );

  // Count unique holdings across all ETFs
  const allHoldings = new Set<string>();
  for (const holdings of holdingsByETF.values()) {
    for (const h of holdings) {
      allHoldings.add(h.holding_symbol);
    }
  }

  return {
    overlappingHoldings,
    overlapMatrix,
    concentrationRisks,
    totalETFCount: etfPositions.length,
    uniqueHoldingsCount: allHoldings.size,
  };
}

/**
 * Find stocks that appear in multiple ETFs
 */
function findOverlappingHoldings(
  etfPositions: EnrichedPosition[],
  holdingsByETF: Map<string, ETFHolding[]>,
  positionWeights: Map<string, number>
): OverlappingHolding[] {
  // Map: holding symbol -> { etf, weight }[]
  const holdingToETFs = new Map<string, { etf: string; weight: number; name?: string }[]>();

  for (const position of etfPositions) {
    const etfSymbol = position.symbol.toUpperCase();
    const etfWeight = positionWeights.get(etfSymbol) || 0;
    const holdings = holdingsByETF.get(etfSymbol) || [];

    for (const holding of holdings) {
      const existing = holdingToETFs.get(holding.holding_symbol) || [];
      existing.push({
        etf: etfSymbol,
        weight: holding.weight,
        name: holding.holding_name,
      });
      holdingToETFs.set(holding.holding_symbol, existing);
    }
  }

  // Filter to only stocks in 2+ ETFs
  const overlapping: OverlappingHolding[] = [];
  for (const [symbol, etfs] of holdingToETFs.entries()) {
    if (etfs.length >= 2) {
      // Calculate total exposure to this stock
      let totalExposure = 0;
      for (const { etf, weight } of etfs) {
        const etfWeight = positionWeights.get(etf) || 0;
        totalExposure += (weight / 100) * etfWeight;
      }

      overlapping.push({
        symbol,
        name: etfs[0].name || symbol,
        etfs: etfs.map(e => ({ etf: e.etf, weight: e.weight })),
        totalExposure,
      });
    }
  }

  // Sort by total exposure descending
  overlapping.sort((a, b) => b.totalExposure - a.totalExposure);

  return overlapping;
}

/**
 * Calculate overlap percentage matrix between ETF pairs
 */
function calculateOverlapMatrix(
  etfPositions: EnrichedPosition[],
  holdingsByETF: Map<string, ETFHolding[]>
): ETFOverlapMatrix {
  const etfs = etfPositions.map(p => p.symbol.toUpperCase());
  const n = etfs.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 100; // 100% overlap with self
      } else {
        matrix[i][j] = calculatePairwiseOverlap(
          holdingsByETF.get(etfs[i]) || [],
          holdingsByETF.get(etfs[j]) || []
        );
      }
    }
  }

  return { etfs, matrix };
}

/**
 * Calculate overlap between two ETFs based on shared holdings weight
 */
function calculatePairwiseOverlap(
  holdingsA: ETFHolding[],
  holdingsB: ETFHolding[]
): number {
  if (holdingsA.length === 0 || holdingsB.length === 0) return 0;

  const symbolsA = new Set(holdingsA.map(h => h.holding_symbol));
  const weightsB = new Map(holdingsB.map(h => [h.holding_symbol, h.weight]));

  // Sum of weights of holdings in A that also appear in B
  let overlapWeight = 0;
  let totalWeightA = 0;

  for (const holding of holdingsA) {
    totalWeightA += holding.weight;
    if (weightsB.has(holding.holding_symbol)) {
      // Use minimum of the two weights as overlap contribution
      const weightB = weightsB.get(holding.holding_symbol) || 0;
      overlapWeight += Math.min(holding.weight, weightB);
    }
  }

  // Overlap as percentage of ETF A's holdings
  return totalWeightA > 0 ? (overlapWeight / totalWeightA) * 100 : 0;
}

/**
 * Identify individual stocks with high concentration risk
 */
function identifyConcentrationRisks(
  overlappingHoldings: OverlappingHolding[],
  holdingsByETF: Map<string, ETFHolding[]>
): ConcentrationRisk[] {
  // Get all holdings with their total exposure
  const allExposures = new Map<string, { name: string; exposure: number; sources: { etf: string; contribution: number }[] }>();

  for (const [etfSymbol, holdings] of holdingsByETF.entries()) {
    for (const holding of holdings) {
      const existing = allExposures.get(holding.holding_symbol) || {
        name: holding.holding_name || holding.holding_symbol,
        exposure: 0,
        sources: [],
      };
      existing.sources.push({
        etf: etfSymbol,
        contribution: holding.weight,
      });
      allExposures.set(holding.holding_symbol, existing);
    }
  }

  // Add overlapping holdings exposure data
  for (const holding of overlappingHoldings) {
    const existing = allExposures.get(holding.symbol);
    if (existing) {
      existing.exposure = holding.totalExposure;
    }
  }

  // Convert to array and filter for significant exposure (> 1%)
  const risks: ConcentrationRisk[] = [];
  for (const [symbol, data] of allExposures.entries()) {
    if (data.exposure > 1) {
      risks.push({
        symbol,
        name: data.name,
        exposure: data.exposure,
        sources: data.sources,
      });
    }
  }

  // Sort by exposure descending
  risks.sort((a, b) => b.exposure - a.exposure);

  return risks.slice(0, 20); // Top 20
}

/**
 * Get concentration risk level for display
 */
export function getConcentrationLevel(exposure: number): {
  level: 'low' | 'medium' | 'high';
  color: string;
} {
  if (exposure >= 5) {
    return { level: 'high', color: 'text-red-500' };
  } else if (exposure >= 3) {
    return { level: 'medium', color: 'text-yellow-500' };
  }
  return { level: 'low', color: 'text-green-500' };
}

/**
 * Get overlap level between two ETFs for display
 */
export function getOverlapLevel(overlapPercent: number): {
  level: 'low' | 'moderate' | 'high' | 'very-high';
  color: string;
  description: string;
} {
  if (overlapPercent >= 70) {
    return {
      level: 'very-high',
      color: 'bg-red-500',
      description: 'Very high overlap - consider consolidating',
    };
  } else if (overlapPercent >= 50) {
    return {
      level: 'high',
      color: 'bg-orange-500',
      description: 'High overlap - significant redundancy',
    };
  } else if (overlapPercent >= 30) {
    return {
      level: 'moderate',
      color: 'bg-yellow-500',
      description: 'Moderate overlap - some shared holdings',
    };
  }
  return {
    level: 'low',
    color: 'bg-green-500',
    description: 'Low overlap - good diversification',
  };
}

/**
 * Calculate total unique and duplicate exposure
 */
export function calculateExposureSummary(analysis: OverlapAnalysis): {
  totalOverlappingStocks: number;
  totalOverlappingExposure: number;
  topOverlap: { symbol: string; exposure: number } | null;
} {
  const totalOverlappingStocks = analysis.overlappingHoldings.length;
  const totalOverlappingExposure = analysis.overlappingHoldings.reduce(
    (sum, h) => sum + h.totalExposure,
    0
  );
  const topOverlap = analysis.overlappingHoldings.length > 0
    ? {
        symbol: analysis.overlappingHoldings[0].symbol,
        exposure: analysis.overlappingHoldings[0].totalExposure,
      }
    : null;

  return {
    totalOverlappingStocks,
    totalOverlappingExposure,
    topOverlap,
  };
}
