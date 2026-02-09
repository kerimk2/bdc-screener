'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calculator,
  History,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Percent,
  Calendar,
  Target,
  Briefcase,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Loading } from '@/components/portfolio/ui/loading';
import { Button } from '@/components/portfolio/ui/button';
import { Input } from '@/components/portfolio/ui/input';
import { getOptionsChain, getHistoricalPrices } from '@/lib/portfolio/market-data';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import { cn } from '@/lib/portfolio/utils';
import { EnrichedPosition, OptionsChainResponse, OptionContract, CoveredCallSimulation, LiquidityInfo } from '@/types/portfolio';
import {
  calculateStrike,
  getStrikeIncrement,
  getContractCount,
  calculateAnnualizedYield,
  calculateYieldIfCalled,
  estimateAssignmentProbability,
  calculateBreakeven,
  calculateMaxProfit,
  blackScholesCall,
  backtestCoveredCall,
  BacktestResult,
} from '@/lib/portfolio/options-calculations';

type ExpirationCycle = 'weekly' | 'monthly' | '45dte';

// Liquidity thresholds
const LIQUIDITY_THRESHOLDS = {
  minBid: 0.05, // Minimum bid price ($0.05)
  maxSpreadPercent: 30, // Maximum bid/ask spread as % of mid price
  minVolume: 1, // Minimum daily volume (relaxed for less active options)
  minOpenInterest: 10, // Minimum open interest
};

// Calculate liquidity metrics for an option contract
function calculateLiquidity(contract: OptionContract): LiquidityInfo {
  const { bid, ask, volume, openInterest } = contract;
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : ask || bid || contract.lastPrice;
  const spread = ask - bid;
  const spreadPercent = mid > 0 ? (spread / mid) * 100 : 100;

  // Check if option meets liquidity requirements
  const hasBid = bid >= LIQUIDITY_THRESHOLDS.minBid;
  const spreadOk = spreadPercent <= LIQUIDITY_THRESHOLDS.maxSpreadPercent;
  const volumeOk = volume >= LIQUIDITY_THRESHOLDS.minVolume;
  const openInterestOk = openInterest >= LIQUIDITY_THRESHOLDS.minOpenInterest;

  const isLiquid = hasBid && spreadOk;

  // Calculate liquidity score
  let liquidityScore: 'good' | 'fair' | 'poor';
  if (hasBid && spreadPercent <= 10 && openInterest >= 100) {
    liquidityScore = 'good';
  } else if (hasBid && spreadPercent <= 25 && openInterest >= 20) {
    liquidityScore = 'fair';
  } else {
    liquidityScore = 'poor';
  }

  return {
    bid,
    ask,
    spread,
    spreadPercent,
    volume,
    openInterest,
    isLiquid,
    liquidityScore,
  };
}

// Filter and rank call options by liquidity and proximity to target strike
function findBestLiquidCall(
  calls: OptionContract[],
  targetStrike: number,
  minPrice: number
): { call: OptionContract; liquidity: LiquidityInfo } | null {
  // Filter to calls at or above minimum price (typically 90% of current)
  const validCalls = calls.filter(c => c.strike >= minPrice);
  if (validCalls.length === 0) return null;

  // Calculate liquidity for each call and filter to liquid ones
  const callsWithLiquidity = validCalls.map(call => ({
    call,
    liquidity: calculateLiquidity(call),
    strikeDiff: Math.abs(call.strike - targetStrike),
  }));

  // Prefer liquid options, but fall back to best available if none are liquid
  const liquidCalls = callsWithLiquidity.filter(c => c.liquidity.isLiquid);

  // If we have liquid options, pick the one closest to target strike
  if (liquidCalls.length > 0) {
    liquidCalls.sort((a, b) => a.strikeDiff - b.strikeDiff);
    return { call: liquidCalls[0].call, liquidity: liquidCalls[0].liquidity };
  }

  // No liquid options - find the best illiquid one but flag it
  // Sort by liquidity score (good > fair > poor), then by strike proximity
  callsWithLiquidity.sort((a, b) => {
    const scoreOrder = { good: 0, fair: 1, poor: 2 };
    const scoreDiff = scoreOrder[a.liquidity.liquidityScore] - scoreOrder[b.liquidity.liquidityScore];
    if (scoreDiff !== 0) return scoreDiff;
    return a.strikeDiff - b.strikeDiff;
  });

  return { call: callsWithLiquidity[0].call, liquidity: callsWithLiquidity[0].liquidity };
}

interface EligiblePosition extends EnrichedPosition {
  contracts: number;
}

interface PortfolioCallData {
  symbol: string;
  shares: number;
  contracts: number;
  currentPrice: number;
  marketValue: number;
  strike: number;
  premium: number;
  totalPremium: number;
  annualizedYield: number;
  daysToExpiration: number;
  expirationDate: string;
  liquidity?: LiquidityInfo;
}

export default function CoveredCallsPage() {
  const { enrichedPositions, loading: dataLoading } = useData();
  const formatCurrency = useFormatCurrency();
  const [activeTab, setActiveTab] = useState<'calculator' | 'portfolio' | 'opportunities' | 'backtest'>('calculator');

  // Calculator state
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [moneynessPercent, setMoneynessPercent] = useState<number>(5);
  const [expirationCycle, setExpirationCycle] = useState<ExpirationCycle>('monthly');
  const [optionsData, setOptionsData] = useState<OptionsChainResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [simulation, setSimulation] = useState<CoveredCallSimulation | null>(null);

  // Portfolio state
  const [portfolioMoneyness, setPortfolioMoneyness] = useState<number>(2);
  const [portfolioCycle, setPortfolioCycle] = useState<ExpirationCycle>('weekly');
  const [portfolioData, setPortfolioData] = useState<PortfolioCallData[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Backtest state
  const [backtestSymbol, setBacktestSymbol] = useState<string>('');
  const [backtestMoneyness, setBacktestMoneyness] = useState<number>(5);
  const [backtestCycle, setBacktestCycle] = useState<ExpirationCycle>('monthly');
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  // Filter positions with 100+ shares (eligible for covered calls)
  const eligiblePositions = useMemo<EligiblePosition[]>(() => {
    return enrichedPositions
      .filter(p => p.shares >= 100)
      .map(p => ({
        ...p,
        contracts: getContractCount(p.shares),
      }))
      .sort((a, b) => b.marketValue - a.marketValue);
  }, [enrichedPositions]);

  // All positions that could potentially be eligible
  const allPositionsWithContracts = useMemo(() => {
    return enrichedPositions.map(p => ({
      ...p,
      contracts: getContractCount(p.shares),
      isEligible: p.shares >= 100,
    }));
  }, [enrichedPositions]);

  // Selected position details
  const selectedPosition = useMemo(() => {
    return eligiblePositions.find(p => p.symbol === selectedSymbol) || null;
  }, [eligiblePositions, selectedSymbol]);

  // Get cycle configuration for expiration
  const getCycleConfig = (cycle: ExpirationCycle): { target: number; min: number; max: number } => {
    switch (cycle) {
      case 'weekly': return { target: 7, min: 4, max: 14 };
      case 'monthly': return { target: 30, min: 20, max: 45 };
      case '45dte': return { target: 45, min: 35, max: 60 };
    }
  };

  // Fetch options chain when symbol changes
  useEffect(() => {
    if (!selectedSymbol) {
      setOptionsData(null);
      setSimulation(null);
      return;
    }

    async function fetchOptions() {
      setLoadingOptions(true);
      try {
        const data = await getOptionsChain(selectedSymbol);
        setOptionsData(data);
      } catch (err) {
        console.error('Error fetching options:', err);
        setOptionsData(null);
      } finally {
        setLoadingOptions(false);
      }
    }

    fetchOptions();
  }, [selectedSymbol]);

  // Calculate simulation when parameters change
  useEffect(() => {
    if (!selectedPosition || !optionsData) {
      setSimulation(null);
      return;
    }

    const cycleConfig = getCycleConfig(expirationCycle);

    // Filter out options expiring too soon (less than 2 days)
    const validOptions = optionsData.options.filter(opt => opt.daysToExpiration >= 2);

    if (validOptions.length === 0) {
      setSimulation(null);
      return;
    }

    // Find the best matching expiration - prefer within range, then closest to target
    let selectedExpiration = validOptions
      .filter(opt => opt.daysToExpiration >= cycleConfig.min && opt.daysToExpiration <= cycleConfig.max)
      .sort((a, b) => {
        const aDiff = Math.abs(a.daysToExpiration - cycleConfig.target);
        const bDiff = Math.abs(b.daysToExpiration - cycleConfig.target);
        return aDiff - bDiff;
      })[0];

    // If nothing in ideal range, find closest to target DTE
    if (!selectedExpiration) {
      selectedExpiration = validOptions
        .sort((a, b) => {
          const aDiff = Math.abs(a.daysToExpiration - cycleConfig.target);
          const bDiff = Math.abs(b.daysToExpiration - cycleConfig.target);
          return aDiff - bDiff;
        })[0];
    }
    const strikeIncrement = getStrikeIncrement(optionsData.underlyingPrice);
    const targetStrike = calculateStrike(optionsData.underlyingPrice, moneynessPercent, strikeIncrement);

    // Find best liquid call option near target strike
    const bestCall = findBestLiquidCall(
      selectedExpiration.calls,
      targetStrike,
      optionsData.underlyingPrice * 0.9
    );

    if (!bestCall) {
      setSimulation(null);
      return;
    }

    const { call: closestCall, liquidity } = bestCall;

    // Use mid price for liquid options, be more conservative for illiquid ones
    let premium: number;
    if (liquidity.isLiquid && closestCall.bid > 0 && closestCall.ask > 0) {
      premium = (closestCall.bid + closestCall.ask) / 2;
    } else if (closestCall.bid > 0) {
      // For illiquid options, use bid (what you'd actually get)
      premium = closestCall.bid;
    } else if (closestCall.lastPrice > 0) {
      // Last resort: use last traded price with discount
      premium = closestCall.lastPrice * 0.8;
    } else {
      // No usable price data
      setSimulation(null);
      return;
    }
    const contracts = selectedPosition.contracts;
    // Calculate yield based on stock price (capital at risk), not strike
    const annualizedYield = calculateAnnualizedYield(premium, optionsData.underlyingPrice, selectedExpiration.daysToExpiration);
    const yieldIfCalled = calculateYieldIfCalled(premium, closestCall.strike, optionsData.underlyingPrice, selectedExpiration.daysToExpiration);

    // Estimate assignment probability from IV
    const iv = closestCall.impliedVolatility || 0.30;
    const assignmentProb = estimateAssignmentProbability(
      optionsData.underlyingPrice,
      closestCall.strike,
      selectedExpiration.daysToExpiration,
      iv
    );

    const breakeven = calculateBreakeven(optionsData.underlyingPrice, premium);

    setSimulation({
      symbol: selectedSymbol,
      shares: selectedPosition.shares,
      contracts,
      strike: closestCall.strike,
      premium,
      annualizedYield,
      assignmentProbability: assignmentProb,
      breakeven,
      daysToExpiration: selectedExpiration.daysToExpiration,
      expirationDate: selectedExpiration.expirationDate,
      liquidity,
    });
  }, [selectedPosition, optionsData, moneynessPercent, expirationCycle, selectedSymbol]);

  // Run backtest
  const runBacktest = async () => {
    if (!backtestSymbol) return;

    const position = enrichedPositions.find(p => p.symbol === backtestSymbol);
    if (!position || position.shares < 100) {
      setBacktestError('Need at least 100 shares to run backtest');
      return;
    }

    setLoadingBacktest(true);
    setBacktestError(null);
    setBacktestResult(null);

    try {
      // Fetch 1 year of historical data
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const fromDate = oneYearAgo.toISOString().split('T')[0];

      const history = await getHistoricalPrices(backtestSymbol, fromDate);

      if (history.length < 30) {
        setBacktestError('Insufficient historical data for backtest');
        return;
      }

      // Sort chronologically (API returns descending)
      const prices = [...history]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(p => ({ date: p.date, close: p.close }));

      const cycleConfig = getCycleConfig(backtestCycle);
      const result = backtestCoveredCall(
        prices,
        position.shares,
        backtestMoneyness,
        cycleConfig.target,
        0.30, // Estimated IV
        0.05  // Risk-free rate
      );

      setBacktestResult(result);
    } catch (err) {
      console.error('Backtest error:', err);
      setBacktestError('Failed to run backtest');
    } finally {
      setLoadingBacktest(false);
    }
  };

  // Calculate portfolio-wide covered call potential
  const calculatePortfolio = async () => {
    if (eligiblePositions.length === 0) return;

    setLoadingPortfolio(true);
    setPortfolioData([]);

    const cycleConfig = getCycleConfig(portfolioCycle);
    const results: PortfolioCallData[] = [];

    // Fetch options for each eligible position
    for (const position of eligiblePositions) {
      try {
        const options = await getOptionsChain(position.symbol);
        if (!options || options.options.length === 0) continue;

        // Filter valid expirations
        const validOptions = options.options.filter(opt => opt.daysToExpiration >= 2);
        if (validOptions.length === 0) continue;

        // Find best matching expiration
        let selectedExp = validOptions
          .filter(opt => opt.daysToExpiration >= cycleConfig.min && opt.daysToExpiration <= cycleConfig.max)
          .sort((a, b) => Math.abs(a.daysToExpiration - cycleConfig.target) - Math.abs(b.daysToExpiration - cycleConfig.target))[0];

        if (!selectedExp) {
          selectedExp = validOptions.sort((a, b) =>
            Math.abs(a.daysToExpiration - cycleConfig.target) - Math.abs(b.daysToExpiration - cycleConfig.target)
          )[0];
        }

        // Find best liquid call based on moneyness
        const strikeIncrement = getStrikeIncrement(options.underlyingPrice);
        const targetStrike = calculateStrike(options.underlyingPrice, portfolioMoneyness, strikeIncrement);

        const bestCall = findBestLiquidCall(
          selectedExp.calls,
          targetStrike,
          options.underlyingPrice * 0.9
        );
        if (!bestCall) continue;

        const { call: closestCall, liquidity } = bestCall;

        // Calculate premium - use bid for illiquid options (what you'd actually get)
        let premium: number;
        if (liquidity.isLiquid && closestCall.bid > 0 && closestCall.ask > 0) {
          premium = (closestCall.bid + closestCall.ask) / 2;
        } else if (closestCall.bid > 0) {
          premium = closestCall.bid;
        } else if (closestCall.lastPrice > 0) {
          premium = closestCall.lastPrice * 0.8;
        } else {
          continue; // Skip if no usable price
        }

        const contracts = position.contracts;
        const totalPremium = premium * contracts * 100;
        const annualizedYield = calculateAnnualizedYield(premium, options.underlyingPrice, selectedExp.daysToExpiration);

        results.push({
          symbol: position.symbol,
          shares: position.shares,
          contracts,
          currentPrice: options.underlyingPrice,
          marketValue: position.marketValue,
          strike: closestCall.strike,
          premium,
          totalPremium,
          annualizedYield,
          daysToExpiration: selectedExp.daysToExpiration,
          expirationDate: selectedExp.expirationDate,
          liquidity,
        });
      } catch (err) {
        console.error(`Failed to fetch options for ${position.symbol}:`, err);
      }
    }

    setPortfolioData(results);
    setLoadingPortfolio(false);
  };

  // Portfolio summary
  const portfolioSummary = useMemo(() => {
    if (portfolioData.length === 0) return null;

    const totalPremium = portfolioData.reduce((sum, p) => sum + p.totalPremium, 0);
    const totalValue = portfolioData.reduce((sum, p) => sum + p.marketValue, 0);
    const avgYield = portfolioData.length > 0
      ? portfolioData.reduce((sum, p) => sum + p.annualizedYield, 0) / portfolioData.length
      : 0;
    const totalContracts = portfolioData.reduce((sum, p) => sum + p.contracts, 0);

    return {
      totalPremium,
      totalValue,
      avgYield,
      totalContracts,
      positionCount: portfolioData.length,
    };
  }, [portfolioData]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalContracts = eligiblePositions.reduce((sum, p) => sum + p.contracts, 0);
    const totalEligibleValue = eligiblePositions.reduce((sum, p) => sum + p.marketValue, 0);

    // Find next Friday for weekly expiration
    const today = new Date();
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);

    return {
      eligibleCount: eligiblePositions.length,
      totalContracts,
      totalEligibleValue,
      nextExpiration: nextFriday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  }, [eligiblePositions]);

  if (dataLoading) {
    return <Loading message="Loading positions..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Covered Call Simulator</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Simulate and backtest covered call strategies on your positions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Eligible Positions</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {summaryStats.eligibleCount}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Eligible Value</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summaryStats.totalEligibleValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Contracts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {summaryStats.totalContracts}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Next Weekly Exp</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {summaryStats.nextExpiration}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {eligiblePositions.length === 0 ? (
        <Card className="py-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            No positions with 100+ shares. Covered calls require at least 100 shares.
          </p>
        </Card>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 w-fit">
            {[
              { id: 'calculator' as const, label: 'Calculator', icon: Calculator },
              { id: 'portfolio' as const, label: 'Portfolio', icon: Briefcase },
              { id: 'opportunities' as const, label: 'Opportunities', icon: TrendingUp },
              { id: 'backtest' as const, label: 'Backtest', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Configure Strategy</CardTitle>
                  <CardDescription>Select position and strategy parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Position selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Position
                    </label>
                    <select
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Select a position...</option>
                      {eligiblePositions.map((pos) => (
                        <option key={pos.id} value={pos.symbol}>
                          {pos.symbol} - {pos.shares} shares ({pos.contracts} contracts)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Moneyness selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Moneyness (Strike vs Current Price)
                    </label>
                    <select
                      value={moneynessPercent}
                      onChange={(e) => setMoneynessPercent(parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value={-5}>-5% ITM (higher premium, likely assignment)</option>
                      <option value={-2}>-2% ITM</option>
                      <option value={0}>ATM (at the money)</option>
                      <option value={1}>+1% OTM</option>
                      <option value={2}>+2% OTM</option>
                      <option value={3}>+3% OTM</option>
                      <option value={5}>+5% OTM (balanced)</option>
                      <option value={7}>+7% OTM</option>
                      <option value={10}>+10% OTM (lower premium, less assignment risk)</option>
                      <option value={15}>+15% OTM</option>
                    </select>
                  </div>

                  {/* Expiration cycle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expiration Cycle
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'weekly' as const, label: 'Weekly' },
                        { value: 'monthly' as const, label: 'Monthly' },
                        { value: '45dte' as const, label: '45 DTE' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setExpirationCycle(option.value)}
                          className={cn(
                            'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            expirationCycle === option.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Simulation Results</CardTitle>
                  <CardDescription>
                    {loadingOptions ? 'Loading options data...' : 'Estimated returns based on current options chain'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingOptions ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    </div>
                  ) : !simulation ? (
                    <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                      {selectedSymbol ? 'No options data available' : 'Select a position to simulate'}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Liquidity Warning Banner */}
                      {simulation.liquidity && !simulation.liquidity.isLiquid && (
                        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                Low Liquidity Warning
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                This option has a wide bid/ask spread ({simulation.liquidity.spreadPercent.toFixed(0)}%) or low open interest ({simulation.liquidity.openInterest}).
                                Actual execution price may differ significantly.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Key metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                          <div className="text-sm text-green-600 dark:text-green-400">Annualized Yield</div>
                          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {simulation.annualizedYield.toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                          <div className="text-sm text-blue-600 dark:text-blue-400">Premium/Contract</div>
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            ${(simulation.premium * 100).toFixed(0)}
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Strike Price</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${simulation.strike.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Contracts</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {simulation.contracts}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Total Premium</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(simulation.premium * simulation.contracts * 100)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Expiration</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {simulation.expirationDate} ({simulation.daysToExpiration} days)
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Breakeven</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${simulation.breakeven.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Assignment Probability</span>
                          <span className={cn(
                            'font-medium',
                            simulation.assignmentProbability > 50
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-gray-900 dark:text-white'
                          )}>
                            {simulation.assignmentProbability.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Liquidity Details */}
                      {simulation.liquidity && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Liquidity</span>
                            {simulation.liquidity.liquidityScore === 'good' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" /> Good
                              </span>
                            )}
                            {simulation.liquidity.liquidityScore === 'fair' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                <AlertCircle className="h-3 w-3" /> Fair
                              </span>
                            )}
                            {simulation.liquidity.liquidityScore === 'poor' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <AlertTriangle className="h-3 w-3" /> Poor
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Bid/Ask</span>
                              <span className="text-gray-900 dark:text-white">
                                ${simulation.liquidity.bid.toFixed(2)} / ${simulation.liquidity.ask.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Spread</span>
                              <span className={cn(
                                simulation.liquidity.spreadPercent > 25
                                  ? 'text-red-600 dark:text-red-400'
                                  : simulation.liquidity.spreadPercent > 10
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-gray-900 dark:text-white'
                              )}>
                                {simulation.liquidity.spreadPercent.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Volume</span>
                              <span className="text-gray-900 dark:text-white">{simulation.liquidity.volume.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Open Interest</span>
                              <span className="text-gray-900 dark:text-white">{simulation.liquidity.openInterest.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div className="space-y-6">
              {/* Portfolio Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Covered Call Analysis</CardTitle>
                  <CardDescription>
                    See potential premium income across all eligible positions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Moneyness
                      </label>
                      <select
                        value={portfolioMoneyness}
                        onChange={(e) => setPortfolioMoneyness(parseFloat(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value={0}>ATM</option>
                        <option value={1}>+1% OTM</option>
                        <option value={2}>+2% OTM</option>
                        <option value={3}>+3% OTM</option>
                        <option value={5}>+5% OTM</option>
                        <option value={10}>+10% OTM</option>
                      </select>
                    </div>
                    <div className="min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Expiration Cycle
                      </label>
                      <select
                        value={portfolioCycle}
                        onChange={(e) => setPortfolioCycle(e.target.value as ExpirationCycle)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="45dte">45 DTE</option>
                      </select>
                    </div>
                    <Button
                      onClick={calculatePortfolio}
                      disabled={loadingPortfolio || eligiblePositions.length === 0}
                    >
                      {loadingPortfolio ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        'Calculate Portfolio'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio Summary */}
              {portfolioSummary && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Card className="p-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Premium (per cycle)</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(portfolioSummary.totalPremium)}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Avg Annualized Yield</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {portfolioSummary.avgYield.toFixed(1)}%
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total Contracts</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {portfolioSummary.totalContracts}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Positions Analyzed</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {portfolioSummary.positionCount} / {eligiblePositions.length}
                    </div>
                  </Card>
                </div>
              )}

              {/* Portfolio Table */}
              {portfolioData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Position Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Contracts</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Price</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Strike</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Premium</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Total</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Ann. Yield</th>
                            <th className="pb-3 text-center font-medium text-gray-500 dark:text-gray-400">Liquidity</th>
                            <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Expiration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolioData.map((row) => (
                            <tr key={row.symbol} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-3 font-medium text-gray-900 dark:text-white">{row.symbol}</td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">{row.contracts}</td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                                ${row.currentPrice.toFixed(2)}
                              </td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                                ${row.strike.toFixed(2)}
                              </td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                                ${(row.premium * 100).toFixed(0)}
                              </td>
                              <td className="py-3 text-right font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(row.totalPremium)}
                              </td>
                              <td className="py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                                {row.annualizedYield.toFixed(1)}%
                              </td>
                              <td className="py-3 text-center">
                                {row.liquidity && (
                                  <div className="flex flex-col items-center gap-1">
                                    {row.liquidity.liquidityScore === 'good' && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                        <CheckCircle className="h-3 w-3" /> Good
                                      </span>
                                    )}
                                    {row.liquidity.liquidityScore === 'fair' && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        <AlertCircle className="h-3 w-3" /> Fair
                                      </span>
                                    )}
                                    {row.liquidity.liquidityScore === 'poor' && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        <AlertTriangle className="h-3 w-3" /> Poor
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">
                                      {row.liquidity.spreadPercent.toFixed(0)}% spread
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                                {row.expirationDate} ({row.daysToExpiration}d)
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                            <td className="pt-3 font-bold text-gray-900 dark:text-white">Total</td>
                            <td className="pt-3 text-right font-bold text-gray-900 dark:text-white">
                              {portfolioSummary?.totalContracts}
                            </td>
                            <td colSpan={3}></td>
                            <td className="pt-3 text-right font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(portfolioSummary?.totalPremium || 0)}
                            </td>
                            <td className="pt-3 text-right font-bold text-blue-600 dark:text-blue-400">
                              {portfolioSummary?.avgYield.toFixed(1)}% avg
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!loadingPortfolio && portfolioData.length === 0 && (
                <Card className="py-12 text-center">
                  <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-3 text-gray-500 dark:text-gray-400">
                    Click "Calculate Portfolio" to analyze covered call potential across all positions
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Opportunities Tab */}
          {activeTab === 'opportunities' && (
            <Card>
              <CardHeader>
                <CardTitle>Covered Call Opportunities</CardTitle>
                <CardDescription>All positions with potential covered call income</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                        <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Shares</th>
                        <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Contracts</th>
                        <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Price</th>
                        <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Value</th>
                        <th className="pb-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
                        <th className="pb-3 text-center font-medium text-gray-500 dark:text-gray-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPositionsWithContracts.map((pos) => (
                        <tr
                          key={pos.id}
                          className={cn(
                            'border-b border-gray-100 dark:border-gray-800',
                            !pos.isEligible && 'opacity-50'
                          )}
                        >
                          <td className="py-3 font-medium text-gray-900 dark:text-white">
                            {pos.symbol}
                          </td>
                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                            {pos.shares.toLocaleString()}
                          </td>
                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                            {pos.contracts}
                          </td>
                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                            {formatCurrency(pos.currentPrice)}
                          </td>
                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                            {formatCurrency(pos.marketValue)}
                          </td>
                          <td className="py-3 text-center">
                            {pos.isEligible ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Eligible
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                Need {100 - pos.shares} more
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            {pos.isEligible && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSymbol(pos.symbol);
                                  setActiveTab('calculator');
                                }}
                              >
                                Simulate
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Backtest Tab */}
          {activeTab === 'backtest' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Backtest Configuration</CardTitle>
                  <CardDescription>
                    Simulate covered call strategy over the past year
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Backtests use estimated IV (historical volatility x 1.2) and Black-Scholes pricing. Actual results may vary.
                      </p>
                    </div>
                  </div>

                  {/* Symbol selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Position
                    </label>
                    <select
                      value={backtestSymbol}
                      onChange={(e) => setBacktestSymbol(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Select a position...</option>
                      {eligiblePositions.map((pos) => (
                        <option key={pos.id} value={pos.symbol}>
                          {pos.symbol} - {pos.shares} shares
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Moneyness */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Moneyness
                    </label>
                    <select
                      value={backtestMoneyness}
                      onChange={(e) => setBacktestMoneyness(parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value={0}>ATM (at the money)</option>
                      <option value={2}>+2% OTM</option>
                      <option value={5}>+5% OTM</option>
                      <option value={10}>+10% OTM</option>
                    </select>
                  </div>

                  {/* Cycle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expiration Cycle
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'weekly' as const, label: 'Weekly' },
                        { value: 'monthly' as const, label: 'Monthly' },
                        { value: '45dte' as const, label: '45 DTE' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setBacktestCycle(option.value)}
                          className={cn(
                            'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            backtestCycle === option.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={runBacktest}
                    disabled={!backtestSymbol || loadingBacktest}
                    className="w-full"
                  >
                    {loadingBacktest ? 'Running Backtest...' : 'Run Backtest'}
                  </Button>

                  {backtestError && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      {backtestError}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Backtest Results</CardTitle>
                  <CardDescription>
                    {backtestResult
                      ? `${backtestResult.startDate} to ${backtestResult.endDate}`
                      : 'Run a backtest to see results'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingBacktest ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    </div>
                  ) : !backtestResult ? (
                    <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                      Configure and run a backtest to see results
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Key metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                          <div className="text-sm text-green-600 dark:text-green-400">Total Premium</div>
                          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {formatCurrency(backtestResult.totalPremiumCollected)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                          <div className="text-sm text-blue-600 dark:text-blue-400">Annualized Yield</div>
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {backtestResult.annualizedYield.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Total Cycles</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {backtestResult.totalCycles}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Assignments</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {backtestResult.assignmentCount} ({backtestResult.totalCycles > 0 ? ((backtestResult.assignmentCount / backtestResult.totalCycles) * 100).toFixed(0) : 0}%)
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500 dark:text-gray-400">Avg Premium/Cycle</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(backtestResult.averagePremiumPerCycle)}
                          </span>
                        </div>
                      </div>

                      {/* Event log */}
                      {backtestResult.premiumHistory.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Recent Events
                          </h4>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {backtestResult.premiumHistory.slice(-10).reverse().map((event, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1"
                              >
                                <span className="text-gray-500">{event.date}</span>
                                <span className={cn(
                                  event.event.includes('Assigned')
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-green-600 dark:text-green-400'
                                )}>
                                  {event.event}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(event.cumulative)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
