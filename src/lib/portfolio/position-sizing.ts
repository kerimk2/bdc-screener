import { PositionSizeResult } from '@/types/portfolio';

interface PositionSizeInput {
  portfolioValue: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice?: number;
  riskPercent: number; // As decimal, e.g., 0.02 for 2%
  winRate?: number; // For Kelly, as decimal
  avgWin?: number; // For Kelly, as decimal
  avgLoss?: number; // For Kelly, as decimal
  atrValue?: number; // For ATR-based sizing
  atrMultiplier?: number; // For ATR-based sizing
}

// Fixed Risk Position Sizing
// Calculates position size based on fixed percentage of portfolio at risk
export function calculateFixedRiskSize(input: PositionSizeInput): PositionSizeResult {
  const { portfolioValue, entryPrice, stopLoss, targetPrice, riskPercent } = input;

  const riskAmount = portfolioValue * riskPercent;
  const riskPerShare = Math.abs(entryPrice - stopLoss);

  if (riskPerShare === 0) {
    return {
      method: 'fixed_risk',
      shares: 0,
      positionSize: 0,
      portfolioWeight: 0,
      riskAmount: 0,
      riskRewardRatio: null,
      stopLoss,
      targetPrice: targetPrice || null,
    };
  }

  const shares = Math.floor(riskAmount / riskPerShare);
  const positionSize = shares * entryPrice;
  const portfolioWeight = positionSize / portfolioValue;

  let riskRewardRatio: number | null = null;
  if (targetPrice) {
    const reward = Math.abs(targetPrice - entryPrice);
    riskRewardRatio = reward / riskPerShare;
  }

  return {
    method: 'fixed_risk',
    shares,
    positionSize,
    portfolioWeight,
    riskAmount: shares * riskPerShare,
    riskRewardRatio,
    stopLoss,
    targetPrice: targetPrice || null,
  };
}

// Kelly Criterion Position Sizing
// f* = (bp - q) / b where:
// b = odds received on the wager (win/loss ratio)
// p = probability of winning
// q = probability of losing (1 - p)
export function calculateKellySize(input: PositionSizeInput): PositionSizeResult {
  const {
    portfolioValue,
    entryPrice,
    stopLoss,
    targetPrice,
    winRate = 0.5,
    avgWin = 0.1,
    avgLoss = 0.05
  } = input;

  const p = winRate;
  const q = 1 - p;
  const b = avgWin / avgLoss; // Win/loss ratio

  // Kelly formula
  let kellyFraction = (b * p - q) / b;

  // Apply half-Kelly for more conservative sizing
  kellyFraction = Math.max(0, kellyFraction * 0.5);

  // Cap at 25% of portfolio
  kellyFraction = Math.min(kellyFraction, 0.25);

  const positionSize = portfolioValue * kellyFraction;
  const shares = Math.floor(positionSize / entryPrice);
  const actualPositionSize = shares * entryPrice;
  const portfolioWeight = actualPositionSize / portfolioValue;

  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const riskAmount = shares * riskPerShare;

  let riskRewardRatio: number | null = null;
  if (targetPrice) {
    const reward = Math.abs(targetPrice - entryPrice);
    riskRewardRatio = riskPerShare > 0 ? reward / riskPerShare : null;
  }

  return {
    method: 'kelly',
    shares,
    positionSize: actualPositionSize,
    portfolioWeight,
    riskAmount,
    riskRewardRatio,
    stopLoss,
    targetPrice: targetPrice || null,
  };
}

// ATR-Based Position Sizing
// Uses Average True Range to set stop loss and size position
export function calculateATRSize(input: PositionSizeInput): PositionSizeResult {
  const {
    portfolioValue,
    entryPrice,
    riskPercent,
    targetPrice,
    atrValue = 0,
    atrMultiplier = 2
  } = input;

  if (atrValue <= 0) {
    return {
      method: 'atr',
      shares: 0,
      positionSize: 0,
      portfolioWeight: 0,
      riskAmount: 0,
      riskRewardRatio: null,
      stopLoss: entryPrice,
      targetPrice: targetPrice || null,
    };
  }

  // Calculate ATR-based stop loss
  const stopDistance = atrValue * atrMultiplier;
  const stopLoss = entryPrice - stopDistance;

  // Risk amount based on portfolio percentage
  const riskAmount = portfolioValue * riskPercent;

  // Position size calculation
  const shares = Math.floor(riskAmount / stopDistance);
  const positionSize = shares * entryPrice;
  const portfolioWeight = positionSize / portfolioValue;

  let riskRewardRatio: number | null = null;
  if (targetPrice) {
    const reward = Math.abs(targetPrice - entryPrice);
    riskRewardRatio = reward / stopDistance;
  }

  return {
    method: 'atr',
    shares,
    positionSize,
    portfolioWeight,
    riskAmount: shares * stopDistance,
    riskRewardRatio,
    stopLoss,
    targetPrice: targetPrice || null,
  };
}

// Calculate Average True Range (ATR)
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
    return 0;
  }

  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];

    // True Range = max(high - low, |high - prevClose|, |low - prevClose|)
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Calculate ATR as simple moving average of true ranges
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;

  return atr;
}

// Validate position size against portfolio constraints
export function validatePositionSize(
  result: PositionSizeResult,
  portfolioValue: number,
  maxPositionWeight: number = 0.10, // Default 10% max position
  maxRiskPercent: number = 0.05 // Default 5% max risk
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let isValid = true;

  if (result.portfolioWeight > maxPositionWeight) {
    warnings.push(`Position size (${(result.portfolioWeight * 100).toFixed(1)}%) exceeds maximum allowed (${(maxPositionWeight * 100).toFixed(0)}%)`);
    isValid = false;
  }

  const actualRiskPercent = result.riskAmount / portfolioValue;
  if (actualRiskPercent > maxRiskPercent) {
    warnings.push(`Risk amount (${(actualRiskPercent * 100).toFixed(2)}%) exceeds maximum allowed (${(maxRiskPercent * 100).toFixed(0)}%)`);
    isValid = false;
  }

  if (result.shares === 0) {
    warnings.push('Calculated position size is zero');
    isValid = false;
  }

  if (result.riskRewardRatio !== null && result.riskRewardRatio < 1) {
    warnings.push(`Risk/reward ratio (${result.riskRewardRatio.toFixed(2)}) is less than 1:1`);
  }

  return { isValid, warnings };
}

// Round lot sizes (optional, for stocks that trade in lots)
export function roundToLot(shares: number, lotSize: number = 1): number {
  return Math.floor(shares / lotSize) * lotSize;
}
