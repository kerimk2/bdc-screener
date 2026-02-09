'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { useAuth } from '@/components/portfolio/providers/auth-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Loading } from '@/components/portfolio/ui/loading';
import { AllocationChart } from '@/components/portfolio/charts/allocation-chart';
import { BenchmarkChart } from '@/components/portfolio/charts/benchmark-chart';
import { RiskMetricsCard } from '@/components/portfolio/analytics/risk-metrics-card';
import { CorrelationHeatmap } from '@/components/portfolio/risk/correlation-heatmap';
import { FactorExposureChart } from '@/components/portfolio/risk/factor-exposure-chart';
import { ScenarioTable } from '@/components/portfolio/risk/scenario-table';
import { Button } from '@/components/portfolio/ui/button';
import { Input } from '@/components/portfolio/ui/input';
import { Select } from '@/components/portfolio/ui/select';
import {
  calculatePortfolioSummary,
  calculateSectorAllocation,
  calculateGeographicAllocation,
  calculateAssetTypeAllocation,
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  calculateDailyReturns,
  calculateNetInvested,
} from '@/lib/portfolio/calculations';
import {
  calculateCorrelationMatrix,
  calculatePortfolioVolatility,
  calculatePortfolioBeta,
  calculateMaxDrawdown,
  calculateFactorExposure,
  runAllScenarios,
} from '@/lib/portfolio/risk-calculations';
import {
  analyzeETFOverlap,
  getConcentrationLevel,
  getOverlapLevel,
  calculateExposureSummary,
} from '@/lib/portfolio/etf-overlap';
import { analyzeThematicExposure, getThemeWeightLevel, INVESTMENT_THEMES } from '@/lib/portfolio/thematic-analysis';
import * as db from '@/lib/portfolio/supabase';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import { getFundamentals, FundamentalsData, getHistoricalPrices } from '@/lib/portfolio/market-data';
import { getTransactions } from '@/lib/portfolio/supabase';
import { cn } from '@/lib/portfolio/utils';
import {
  RiskMetrics,
  HistoricalPrice,
  Transaction,
  CorrelationMatrix,
  FactorExposure,
  ScenarioResult,
  AssetMetadata,
  ETFHolding,
  OverlapAnalysis,
} from '@/types/portfolio';
import {
  BarChart3,
  Layers,
  Shield,
  Scale,
  Activity,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Info,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ============== Types ==============
type MainTab = 'overview' | 'themes' | 'etf' | 'risk' | 'rebalancing';
type Period = '1m' | '3m' | '6m' | 'ytd' | '1y';
type RiskTab = 'correlation' | 'factors' | 'scenarios';
type ETFTab = 'overlap' | 'concentration' | 'matrix';
type AllocationType = 'sector' | 'asset_type' | 'vs_index';

interface PortfolioMetrics {
  weightedPE: number | null;
  weightedForwardPE: number | null;
  weightedEvEbitda: number | null;
  weightedDividendYield: number | null;
  weightedBeta: number | null;
  weightedRevenueGrowth: number | null;
  weightedProfitMargin: number | null;
  weightedROE: number | null;
  weightedROA: number | null;
  avgYtdReturn: number | null;
  avgOneYearReturn: number | null;
  avgThreeYearReturn: number | null;
  totalRevenue: number | null;
  totalNetIncome: number | null;
  totalOperatingCashflow: number | null;
  positionsWithFundamentals: number;
  fundsMutualExcluded: number;
}

interface TargetAllocation {
  id: string;
  allocation_type: string;
  name: string;
  target_weight: number;
  created_at: string;
  updated_at: string;
}

interface DriftItem {
  name: string;
  currentWeight: number;
  targetWeight: number;
  drift: number;
  currentValue: number;
  action: 'buy' | 'sell' | 'hold';
  adjustmentDollars: number;
}

// ============== Constants ==============
const INDEX_SECTOR_WEIGHTS: Record<string, Record<string, number>> = {
  'SPY': {
    'Technology': 29.5,
    'Healthcare': 12.8,
    'Financials': 13.2,
    'Consumer Discretionary': 10.5,
    'Communication Services': 8.9,
    'Industrials': 8.5,
    'Consumer Staples': 6.2,
    'Energy': 3.8,
    'Utilities': 2.4,
    'Real Estate': 2.3,
    'Materials': 2.1,
  },
  'QQQ': {
    'Technology': 51.2,
    'Communication Services': 16.8,
    'Consumer Discretionary': 13.5,
    'Healthcare': 6.8,
    'Consumer Staples': 4.2,
    'Industrials': 4.1,
    'Utilities': 1.4,
    'Financials': 1.2,
    'Energy': 0.5,
    'Real Estate': 0.2,
    'Materials': 0.1,
  },
  'ACWI': {
    'Technology': 23.5,
    'Financials': 15.8,
    'Healthcare': 11.5,
    'Consumer Discretionary': 10.8,
    'Industrials': 10.2,
    'Communication Services': 7.5,
    'Consumer Staples': 6.8,
    'Energy': 4.5,
    'Materials': 4.2,
    'Utilities': 2.8,
    'Real Estate': 2.4,
  },
};

type IndexName = keyof typeof INDEX_SECTOR_WEIGHTS;

const SECTOR_PRESETS = {
  'S&P 500 Sectors': INDEX_SECTOR_WEIGHTS['SPY'],
  'Equal Weight Sectors': {
    'Technology': 9.1,
    'Healthcare': 9.1,
    'Financials': 9.1,
    'Consumer Discretionary': 9.1,
    'Communication Services': 9.1,
    'Industrials': 9.1,
    'Consumer Staples': 9.1,
    'Energy': 9.1,
    'Utilities': 9.1,
    'Real Estate': 9.1,
    'Materials': 9.0,
  },
  'Conservative': {
    'Healthcare': 15,
    'Consumer Staples': 15,
    'Utilities': 15,
    'Financials': 12,
    'Industrials': 10,
    'Technology': 10,
    'Communication Services': 8,
    'Consumer Discretionary': 5,
    'Real Estate': 5,
    'Materials': 3,
    'Energy': 2,
  },
  'Growth Focus': {
    'Technology': 35,
    'Consumer Discretionary': 15,
    'Communication Services': 15,
    'Healthcare': 12,
    'Industrials': 8,
    'Financials': 6,
    'Consumer Staples': 3,
    'Materials': 2,
    'Energy': 2,
    'Utilities': 1,
    'Real Estate': 1,
  },
};

type PresetName = keyof typeof SECTOR_PRESETS;

// ============== Helper Components ==============
function MetricCard({ label, value, format = 'number', suffix = '', colorCode = false }: {
  label: string;
  value: number | null;
  format?: 'number' | 'percent' | 'currency' | 'ratio';
  suffix?: string;
  colorCode?: boolean;
}) {
  const formatCurrency = useFormatCurrency();

  const sanitizedValue = useMemo(() => {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) > 1e10) return null;
    return value;
  }, [value]);

  const formatValue = () => {
    if (sanitizedValue === null) return '—';
    switch (format) {
      case 'percent':
        return `${sanitizedValue >= 0 ? '+' : ''}${sanitizedValue.toFixed(2)}%`;
      case 'currency':
        return formatCurrency(sanitizedValue);
      case 'ratio':
        return `${sanitizedValue.toFixed(2)}x`;
      default:
        return `${sanitizedValue.toFixed(2)}${suffix}`;
    }
  };

  const colorClass = colorCode && sanitizedValue !== null
    ? sanitizedValue >= 0 ? 'text-green-500' : 'text-red-500'
    : 'text-gray-900 dark:text-white';

  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
      <p className={cn('text-lg font-semibold truncate', colorClass)}>
        {formatValue()}
      </p>
    </div>
  );
}

function ThemeDetail({ exposure, formatCurrency }: { exposure: { theme: { id: string; name: string; color: string }; positions: { symbol: string; name: string; weight: number; marketValue: number }[]; totalWeight: number; totalValue: number; positionCount: number }; formatCurrency: (v: number) => string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: exposure.theme.color }} />
          <span className="font-medium text-gray-900 dark:text-white">{exposure.theme.name}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">({exposure.positionCount} positions)</span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-gray-900 dark:text-white">{exposure.totalWeight.toFixed(1)}%</span>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(exposure.totalValue)}</span>
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Weight</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {exposure.positions.map((pos) => (
                <tr key={pos.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{pos.symbol}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-gray-600 dark:text-gray-400">{pos.name}</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{pos.weight.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(pos.marketValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function calculatePortfolioMetrics(
  enrichedPositions: Array<{ symbol: string; marketValue: number; weight: number }>,
  fundamentals: Map<string, FundamentalsData>
): PortfolioMetrics {
  let weightedPE = 0;
  let weightedForwardPE = 0;
  let weightedEvEbitda = 0;
  let weightedDividendYield = 0;
  let weightedBeta = 0;
  let weightedRevenueGrowth = 0;
  let weightedProfitMargin = 0;
  let weightedROE = 0;
  let weightedROA = 0;
  let ytdSum = 0;
  let oneYearSum = 0;
  let threeYearSum = 0;
  let ytdCount = 0;
  let oneYearCount = 0;
  let threeYearCount = 0;
  let totalRevenue = 0;
  let totalNetIncome = 0;
  let totalOperatingCashflow = 0;
  let positionsWithFundamentals = 0;
  let fundsMutualExcluded = 0;

  let stockWeight = 0;
  for (const pos of enrichedPositions) {
    const fund = fundamentals.get(pos.symbol.toUpperCase());
    if (fund?.quoteType === 'MUTUALFUND') continue;
    stockWeight += pos.weight;
  }

  for (const pos of enrichedPositions) {
    const fund = fundamentals.get(pos.symbol.toUpperCase());
    if (!fund) continue;

    const isMutualFund = fund.quoteType === 'MUTUALFUND';
    if (isMutualFund) {
      fundsMutualExcluded++;
      if (fund.ytdReturn !== null) { ytdSum += fund.ytdReturn; ytdCount++; }
      if (fund.oneYearReturn !== null) { oneYearSum += fund.oneYearReturn; oneYearCount++; }
      if (fund.threeYearReturn !== null) { threeYearSum += fund.threeYearReturn; threeYearCount++; }
      continue;
    }

    positionsWithFundamentals++;
    const weight = stockWeight > 0 ? (pos.weight / stockWeight) : 0;

    if (fund.peRatio && fund.peRatio > 0 && fund.peRatio < 200) weightedPE += fund.peRatio * weight;
    if (fund.forwardPE && fund.forwardPE > 0 && fund.forwardPE < 200) weightedForwardPE += fund.forwardPE * weight;
    if (fund.evToEbitda && fund.evToEbitda > 0 && fund.evToEbitda < 100) weightedEvEbitda += fund.evToEbitda * weight;
    if (fund.dividendYield && fund.dividendYield >= 0) weightedDividendYield += fund.dividendYield * weight;
    if (fund.beta) weightedBeta += fund.beta * weight;
    if (fund.revenueGrowth !== null) weightedRevenueGrowth += fund.revenueGrowth * weight;
    if (fund.profitMargin !== null) weightedProfitMargin += fund.profitMargin * weight;
    if (fund.returnOnEquity !== null) weightedROE += fund.returnOnEquity * weight;
    if (fund.returnOnAssets !== null) weightedROA += fund.returnOnAssets * weight;
    if (fund.ytdReturn !== null) { ytdSum += fund.ytdReturn; ytdCount++; }
    if (fund.oneYearReturn !== null) { oneYearSum += fund.oneYearReturn; oneYearCount++; }
    if (fund.threeYearReturn !== null) { threeYearSum += fund.threeYearReturn; threeYearCount++; }
    if (fund.revenue !== null) totalRevenue += fund.revenue;
    if (fund.netIncome !== null) totalNetIncome += fund.netIncome;
    if (fund.operatingCashflow !== null) totalOperatingCashflow += fund.operatingCashflow;
  }

  return {
    weightedPE: weightedPE > 0 ? weightedPE : null,
    weightedForwardPE: weightedForwardPE > 0 ? weightedForwardPE : null,
    weightedEvEbitda: weightedEvEbitda > 0 ? weightedEvEbitda : null,
    weightedDividendYield: weightedDividendYield > 0 ? weightedDividendYield : null,
    weightedBeta: weightedBeta > 0 ? weightedBeta : null,
    weightedRevenueGrowth: weightedRevenueGrowth !== 0 ? weightedRevenueGrowth : null,
    weightedProfitMargin: weightedProfitMargin !== 0 ? weightedProfitMargin : null,
    weightedROE: weightedROE !== 0 ? weightedROE : null,
    weightedROA: weightedROA !== 0 ? weightedROA : null,
    avgYtdReturn: ytdCount > 0 ? ytdSum / ytdCount : null,
    avgOneYearReturn: oneYearCount > 0 ? oneYearSum / oneYearCount : null,
    avgThreeYearReturn: threeYearCount > 0 ? threeYearSum / threeYearCount : null,
    totalRevenue: totalRevenue > 0 ? totalRevenue : null,
    totalNetIncome: totalNetIncome !== 0 ? totalNetIncome : null,
    totalOperatingCashflow: totalOperatingCashflow !== 0 ? totalOperatingCashflow : null,
    positionsWithFundamentals,
    fundsMutualExcluded,
  };
}

// ============== Main Component ==============
export default function AnalyticsPage() {
  const { enrichedPositions, positions, accounts, loading, metadata, quotes } = useData();
  const { session } = useAuth();
  const formatCurrency = useFormatCurrency();

  // Main tab state
  const [mainTab, setMainTab] = useState<MainTab>('overview');

  // Overview state
  const [fundamentals, setFundamentals] = useState<Map<string, FundamentalsData>>(new Map());
  const [loadingFundamentals, setLoadingFundamentals] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [benchmarkPeriod, setBenchmarkPeriod] = useState<Period>('1y');
  const [portfolioCumReturns, setPortfolioCumReturns] = useState<{ date: string; value: number }[]>([]);
  const [benchmarkCumReturns, setBenchmarkCumReturns] = useState<{ date: string; value: number }[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  // ETF state
  const [etfTab, setEtfTab] = useState<ETFTab>('overlap');
  const [etfHoldings, setEtfHoldings] = useState<ETFHolding[]>([]);
  const [loadingETF, setLoadingETF] = useState(false);
  const [etfError, setEtfError] = useState<string | null>(null);

  // Risk state
  const [riskTab, setRiskTab] = useState<RiskTab>('correlation');
  const [historicalData, setHistoricalData] = useState<Record<string, { date: string; close: number }[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(null);
  const [volatility, setVolatility] = useState<number>(0);
  const [beta, setBeta] = useState<number>(1);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(0);
  const [factorExposure, setFactorExposure] = useState<FactorExposure | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);

  // Rebalancing state
  const [targets, setTargets] = useState<TargetAllocation[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [allocationType, setAllocationType] = useState<AllocationType>('sector');
  const [editingTargets, setEditingTargets] = useState<Map<string, number>>(new Map());
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetWeight, setNewTargetWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [driftThreshold, setDriftThreshold] = useState(2);
  const [selectedIndex, setSelectedIndex] = useState<IndexName>('SPY');

  const symbolsKey = useMemo(
    () => enrichedPositions.map(p => p.symbol).sort().join(','),
    [enrichedPositions]
  );

  const symbols = enrichedPositions.map(p => p.symbol);

  const totalCashBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + (a.cash_balance || 0), 0),
    [accounts]
  );

  const totalPortfolioValue = useMemo(
    () => enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0) + totalCashBalance,
    [enrichedPositions, totalCashBalance]
  );

  const etfPositions = useMemo(
    () => enrichedPositions.filter((p) => p.asset_type === 'etf'),
    [enrichedPositions]
  );

  // ============== Overview Effects ==============
  useEffect(() => {
    async function fetchFundamentals() {
      if (!symbolsKey) return;
      setLoadingFundamentals(true);
      try {
        const symbols = symbolsKey.split(',');
        const data = await getFundamentals(symbols);
        setFundamentals(data);
      } catch (error) {
        console.error('Error fetching fundamentals:', error);
      } finally {
        setLoadingFundamentals(false);
      }
    }
    fetchFundamentals();
  }, [symbolsKey]);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const txs = await getTransactions();
        setTransactions(txs);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    }
    fetchTransactions();
  }, []);

  const enrichedPositionsRef = useRef(enrichedPositions);
  enrichedPositionsRef.current = enrichedPositions;

  const fetchBenchmarkData = useCallback(async (period: Period) => {
    const currentPositions = enrichedPositionsRef.current;
    if (currentPositions.length === 0) return;

    setLoadingBenchmark(true);
    try {
      const benchmarkRes = await fetch(`/api/portfolio/market-data/benchmark?symbol=SPY&period=${period}`);
      const benchmarkData = await benchmarkRes.json();

      if (benchmarkData.cumulativeReturns) {
        setBenchmarkCumReturns(benchmarkData.cumulativeReturns);
      }

      const benchmarkHistorical: HistoricalPrice[] = (benchmarkData.historical || []).map(
        (h: { date: string; close: number; open: number; high: number; low: number; adjClose?: number; volume: number }) => ({
          ...h,
          adjClose: h.adjClose || h.close,
        })
      );

      const topPositions = [...currentPositions]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 15);

      const periodDays = { '1m': 30, '3m': 90, '6m': 180, 'ytd': 365, '1y': 365 };
      const fromDate = new Date();
      if (period === 'ytd') {
        fromDate.setMonth(0, 1);
      } else {
        fromDate.setDate(fromDate.getDate() - periodDays[period]);
      }
      const fromStr = fromDate.toISOString().split('T')[0];

      const positionHistories = await Promise.all(
        topPositions.map(async (pos) => {
          try {
            const prices = await getHistoricalPrices(pos.symbol, fromStr);
            return { symbol: pos.symbol, weight: pos.weight, prices };
          } catch {
            return { symbol: pos.symbol, weight: pos.weight, prices: [] };
          }
        })
      );

      const dateReturnsMap = new Map<string, { totalWeight: number; weightedReturn: number }>();
      const totalTrackedWeight = positionHistories.reduce((sum, p) => sum + p.weight, 0);
      const minWeightThreshold = totalTrackedWeight * 0.6;

      for (const { weight, prices } of positionHistories) {
        if (prices.length < 2) continue;
        const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1].close;
          const curr = sorted[i].close;
          if (prev <= 0 || curr <= 0) continue;
          const dailyReturn = (curr - prev) / prev;
          if (Math.abs(dailyReturn) > 0.5) continue;
          const date = sorted[i].date;
          const existing = dateReturnsMap.get(date) || { totalWeight: 0, weightedReturn: 0 };
          dateReturnsMap.set(date, {
            totalWeight: existing.totalWeight + weight,
            weightedReturn: existing.weightedReturn + dailyReturn * weight,
          });
        }
      }

      const dates = [...dateReturnsMap.keys()].sort();
      const portfolioCum: { date: string; value: number }[] = [];
      let cumValue = 100;
      let lastValidWeight = 0;
      let lastValidCumValue = 100;
      let consecutiveSkips = 0;
      const MAX_CONSECUTIVE_SKIPS = 5;

      for (const date of dates) {
        const entry = dateReturnsMap.get(date)!;
        if (entry.totalWeight < minWeightThreshold) {
          consecutiveSkips++;
          continue;
        }
        if (lastValidWeight > 0 && Math.abs(entry.totalWeight - lastValidWeight) > totalTrackedWeight * 0.3) {
          lastValidWeight = entry.totalWeight;
          consecutiveSkips++;
          continue;
        }
        lastValidWeight = entry.totalWeight;

        const avgReturn = entry.weightedReturn / entry.totalWeight;
        if (Math.abs(avgReturn) > 0.10) {
          consecutiveSkips++;
          continue;
        }

        const newCumValue = cumValue * (1 + avgReturn);
        const cumChange = (newCumValue - lastValidCumValue) / lastValidCumValue;
        if (cumChange < -0.08) {
          consecutiveSkips++;
          if (consecutiveSkips > MAX_CONSECUTIVE_SKIPS) {
            cumValue = lastValidCumValue;
            consecutiveSkips = 0;
          }
          continue;
        }

        consecutiveSkips = 0;
        cumValue = newCumValue;
        lastValidCumValue = cumValue;
        portfolioCum.push({ date, value: cumValue });
      }

      setPortfolioCumReturns(portfolioCum);

      const portfolioReturns: number[] = [];
      for (const date of dates) {
        const entry = dateReturnsMap.get(date)!;
        if (entry.totalWeight > 0) {
          portfolioReturns.push(entry.weightedReturn / entry.totalWeight);
        }
      }

      const benchmarkReturns = calculateDailyReturns(benchmarkHistorical);
      const minLen = Math.min(portfolioReturns.length, benchmarkReturns.length);
      const alignedPortfolio = portfolioReturns.slice(-minLen);
      const alignedBenchmark = benchmarkReturns.slice(-minLen);

      if (alignedPortfolio.length > 5) {
        const metrics = calculateRiskMetrics(alignedPortfolio, alignedBenchmark);
        setRiskMetrics(metrics);
      }
    } catch (error) {
      console.error('Error fetching benchmark data:', error);
    } finally {
      setLoadingBenchmark(false);
    }
  }, []);

  const positionCount = enrichedPositions.length;
  useEffect(() => {
    if (!loading && positionCount > 0) {
      fetchBenchmarkData(benchmarkPeriod);
    }
  }, [loading, positionCount, benchmarkPeriod, fetchBenchmarkData]);

  // ============== ETF Effects ==============
  const fetchETFHoldings = useCallback(async () => {
    if (etfPositions.length === 0) {
      setLoadingETF(false);
      return;
    }

    try {
      setLoadingETF(true);
      setEtfError(null);

      const symbols = etfPositions.map((p) => p.symbol).join(',');
      const response = await fetch(`/api/portfolio/market-data/etf-holdings?symbols=${symbols}`);

      if (!response.ok) {
        throw new Error('Failed to fetch ETF holdings');
      }

      const data = await response.json();
      const allHoldings: ETFHolding[] = [];
      for (const etf of data.etfs) {
        for (const holding of etf.holdings) {
          allHoldings.push({
            id: `${etf.etfSymbol}-${holding.symbol}`,
            etf_symbol: etf.etfSymbol,
            holding_symbol: holding.symbol,
            holding_name: holding.name,
            weight: holding.weight,
            sector: holding.sector,
            fetched_at: etf.fetchedAt,
          });
        }
      }

      setEtfHoldings(allHoldings);
    } catch (err) {
      console.error('Error fetching ETF holdings:', err);
      setEtfError('Failed to load ETF holdings data');
    } finally {
      setLoadingETF(false);
    }
  }, [etfPositions]);

  useEffect(() => {
    if (mainTab === 'etf' && etfHoldings.length === 0) {
      fetchETFHoldings();
    }
  }, [mainTab, etfHoldings.length, fetchETFHoldings]);

  // ============== Risk Effects ==============
  useEffect(() => {
    async function fetchHistoricalDataForRisk() {
      if (symbols.length === 0 || mainTab !== 'risk') return;

      setLoadingHistory(true);
      try {
        const symbolsWithBenchmark = [...new Set([...symbols, 'SPY'])];
        const response = await fetch(
          `/api/portfolio/market-data/historical-bulk?symbols=${symbolsWithBenchmark.join(',')}`
        );

        if (response.ok) {
          const data = await response.json();
          setHistoricalData(data);
        }
      } catch (error) {
        console.error('Error fetching historical data:', error);
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchHistoricalDataForRisk();
  }, [symbols.join(','), mainTab]);

  useEffect(() => {
    if (Object.keys(historicalData).length === 0 || enrichedPositions.length === 0) return;

    const corrMatrix = calculateCorrelationMatrix(historicalData, symbols);
    setCorrelation(corrMatrix);

    const vol = calculatePortfolioVolatility(historicalData, enrichedPositions);
    setVolatility(vol);

    const portfolioBeta = calculatePortfolioBeta(historicalData, enrichedPositions, 'SPY');
    setBeta(portfolioBeta);

    const mdd = calculateMaxDrawdown(historicalData, enrichedPositions);
    setMaxDrawdown(mdd);

    const quotesMap = new Map<string, { pe: number | null; eps: number | null; marketCap: number | null }>();
    quotes.forEach((quote, symbol) => {
      quotesMap.set(symbol, { pe: quote.pe, eps: quote.eps, marketCap: quote.marketCap });
    });
    const factors = calculateFactorExposure(enrichedPositions, metadata as Map<string, AssetMetadata>, quotesMap);
    setFactorExposure(factors);

    const scenarioResults = runAllScenarios(enrichedPositions, metadata as Map<string, AssetMetadata>);
    setScenarios(scenarioResults);
  }, [historicalData, enrichedPositions, quotes, metadata, symbols]);

  // ============== Rebalancing Effects ==============
  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const data = await db.getTargetAllocations();
      setTargets(data || []);
    } catch (error) {
      console.error('Error loading targets:', error);
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'rebalancing') {
      loadTargets();
    }
  }, [mainTab, loadTargets]);

  // ============== Computed Values ==============
  const summary = useMemo(
    () => calculatePortfolioSummary(enrichedPositions, totalCashBalance),
    [enrichedPositions, totalCashBalance]
  );

  const sectorAllocation = useMemo(
    () => calculateSectorAllocation(enrichedPositions, totalCashBalance),
    [enrichedPositions, totalCashBalance]
  );

  const geographicAllocation = useMemo(
    () => calculateGeographicAllocation(enrichedPositions),
    [enrichedPositions]
  );

  const assetTypeAllocation = useMemo(
    () => calculateAssetTypeAllocation(enrichedPositions, totalCashBalance),
    [enrichedPositions, totalCashBalance]
  );

  const cashFlows = useMemo(() => {
    return transactions
      .filter(tx => ['deposit', 'withdrawal', 'dividend', 'fee'].includes(tx.type))
      .map(tx => ({
        date: tx.transaction_date,
        amount: tx.type === 'withdrawal' ? -tx.total_amount : tx.total_amount,
        type: tx.type as 'deposit' | 'withdrawal' | 'dividend' | 'fee',
      }));
  }, [transactions]);

  const netInvestedData = useMemo(
    () => calculateNetInvested(transactions),
    [transactions]
  );

  const performance = useMemo(
    () => calculatePerformanceMetrics(enrichedPositions, undefined, cashFlows.length > 0 ? cashFlows : undefined),
    [enrichedPositions, cashFlows]
  );

  const portfolioMetrics = useMemo(
    () => calculatePortfolioMetrics(enrichedPositions, fundamentals),
    [enrichedPositions, fundamentals]
  );

  const regionAllocation = useMemo(() => {
    const regionMap = new Map<string, { value: number; weight: number; count: number }>();
    for (const geo of geographicAllocation) {
      const existing = regionMap.get(geo.region) || { value: 0, weight: 0, count: 0 };
      regionMap.set(geo.region, {
        value: existing.value + geo.value,
        weight: existing.weight + geo.weight,
        count: existing.count + geo.count,
      });
    }
    return Array.from(regionMap.entries())
      .map(([region, data]) => ({ name: region, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [geographicAllocation]);

  const positionsWithFundamentals = useMemo(() => {
    return enrichedPositions.map(pos => ({
      ...pos,
      fundamentals: fundamentals.get(pos.symbol.toUpperCase()),
    })).sort((a, b) => b.marketValue - a.marketValue);
  }, [enrichedPositions, fundamentals]);

  // ETF Analysis
  const etfAnalysis: OverlapAnalysis | null = useMemo(() => {
    if (etfHoldings.length === 0 || etfPositions.length === 0) return null;
    return analyzeETFOverlap(etfPositions, etfHoldings, totalPortfolioValue);
  }, [etfHoldings, etfPositions, totalPortfolioValue]);

  const etfSummary = etfAnalysis ? calculateExposureSummary(etfAnalysis) : null;

  // Thematic Analysis
  const thematicAnalysis = useMemo(() => {
    const metadataMap = new Map<string, { name?: string; industry?: string; sector?: string }>();
    for (const pos of enrichedPositions) {
      const meta = pos.metadata;
      metadataMap.set(pos.symbol.toUpperCase(), {
        name: meta?.name,
        industry: meta?.industry || undefined,
        sector: meta?.sector || undefined,
      });
    }
    return analyzeThematicExposure(enrichedPositions, metadataMap);
  }, [enrichedPositions]);

  // Rebalancing
  const currentTargets = useMemo(
    () => targets.filter(t => t.allocation_type === allocationType),
    [targets, allocationType]
  );

  const totalTargetWeight = useMemo(
    () => currentTargets.reduce((sum, t) => sum + t.target_weight, 0),
    [currentTargets]
  );

  const currentAllocations = useMemo(() => {
    if (allocationType === 'sector') {
      return sectorAllocation.map(s => ({ name: s.sector, weight: s.weight, value: s.value }));
    }
    return assetTypeAllocation.map(a => ({
      name: a.assetType.charAt(0).toUpperCase() + a.assetType.slice(1),
      weight: a.weight,
      value: a.value,
    }));
  }, [allocationType, sectorAllocation, assetTypeAllocation]);

  const driftAnalysis = useMemo((): DriftItem[] => {
    const allNames = new Set<string>();
    currentAllocations.forEach(a => allNames.add(a.name));
    currentTargets.forEach(t => allNames.add(t.name));

    return [...allNames].map(name => {
      const current = currentAllocations.find(a => a.name === name);
      const target = currentTargets.find(t => t.name === name);
      const currentWeight = current?.weight || 0;
      const targetWeight = target?.target_weight || 0;
      const drift = currentWeight - targetWeight;
      const currentValue = current?.value || 0;
      const targetValue = totalPortfolioValue * (targetWeight / 100);
      const adjustmentDollars = targetValue - currentValue;

      return {
        name,
        currentWeight,
        targetWeight,
        drift,
        currentValue,
        action: Math.abs(drift) < driftThreshold ? 'hold' as const :
                drift > 0 ? 'sell' as const : 'buy' as const,
        adjustmentDollars,
      };
    }).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  }, [currentAllocations, currentTargets, totalPortfolioValue, driftThreshold]);

  const indexDriftAnalysis = useMemo((): DriftItem[] => {
    const indexWeights = INDEX_SECTOR_WEIGHTS[selectedIndex];
    const allSectors = new Set<string>();
    sectorAllocation.forEach(s => allSectors.add(s.sector));
    Object.keys(indexWeights).forEach(s => allSectors.add(s));

    return [...allSectors].map(sector => {
      const current = sectorAllocation.find(s => s.sector === sector);
      const currentWeight = current?.weight || 0;
      const targetWeight = indexWeights[sector] || 0;
      const drift = currentWeight - targetWeight;
      const currentValue = current?.value || 0;
      const targetValue = totalPortfolioValue * (targetWeight / 100);
      const adjustmentDollars = targetValue - currentValue;

      return {
        name: sector,
        currentWeight,
        targetWeight,
        drift,
        currentValue,
        action: Math.abs(drift) < driftThreshold ? 'hold' as const :
                drift > 0 ? 'sell' as const : 'buy' as const,
        adjustmentDollars,
      };
    }).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  }, [sectorAllocation, selectedIndex, totalPortfolioValue, driftThreshold]);

  // ============== Handlers ==============
  const handleAddTarget = async () => {
    if (!newTargetName.trim() || !newTargetWeight) return;
    setSaving(true);
    try {
      await db.upsertTargetAllocation({
        allocation_type: allocationType,
        name: newTargetName.trim(),
        target_weight: parseFloat(newTargetWeight),
      });
      setNewTargetName('');
      setNewTargetWeight('');
      await loadTargets();
    } catch (error) {
      console.error('Error saving target:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTarget = async (target: TargetAllocation) => {
    const newWeight = editingTargets.get(target.id);
    if (newWeight === undefined) return;
    setSaving(true);
    try {
      await db.upsertTargetAllocation({
        allocation_type: target.allocation_type,
        name: target.name,
        target_weight: newWeight,
      });
      setEditingTargets(prev => {
        const next = new Map(prev);
        next.delete(target.id);
        return next;
      });
      await loadTargets();
    } catch (error) {
      console.error('Error updating target:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await db.deleteTargetAllocation(id);
      await loadTargets();
    } catch (error) {
      console.error('Error deleting target:', error);
    }
  };

  const handleLoadPreset = async (presetName: PresetName) => {
    const preset = SECTOR_PRESETS[presetName];
    if (!preset) return;
    setSaving(true);
    try {
      const existingSectorTargets = targets.filter(t => t.allocation_type === 'sector');
      await Promise.all(existingSectorTargets.map(t => db.deleteTargetAllocation(t.id)));
      await Promise.all(
        Object.entries(preset).map(([name, weight]) =>
          db.upsertTargetAllocation({
            allocation_type: 'sector',
            name,
            target_weight: weight,
          })
        )
      );
      await loadTargets();
    } catch (error) {
      console.error('Error loading preset:', error);
    } finally {
      setSaving(false);
    }
  };

  // ============== Render ==============
  if (loading) {
    return <Loading message="Loading analytics..." />;
  }

  if (enrichedPositions.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Add positions to see analytics</p>
        </div>
        <Card className="py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No positions to analyze. Add some positions first.</p>
        </Card>
      </div>
    );
  }

  const mainTabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'themes' as const, label: 'Themes', icon: Sparkles },
    { id: 'etf' as const, label: 'ETF Overlap', icon: Layers },
    { id: 'risk' as const, label: 'Risk Analysis', icon: Shield },
    { id: 'rebalancing' as const, label: 'Rebalancing', icon: Scale },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Portfolio performance, risk analysis, and rebalancing tools
        </p>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors',
                mainTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============== OVERVIEW TAB ============== */}
      {mainTab === 'overview' && (
        <div className="space-y-8">
          {/* Portfolio Summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            <Card className="p-4">
              <MetricCard label="Total Value" value={summary.totalValue} format="currency" />
            </Card>
            <Card className="p-4">
              <MetricCard label="Net Invested" value={netInvestedData.netInvested > 0 ? netInvestedData.netInvested : summary.totalCost} format="currency" />
            </Card>
            <Card className="p-4">
              <MetricCard label="Total Gain/Loss" value={summary.totalGainLoss} format="currency" colorCode />
            </Card>
            <Card className="p-4">
              <MetricCard label="Total Return" value={performance.totalReturnPercent} format="percent" colorCode />
            </Card>
            <Card className="p-4">
              <MetricCard label="Day Change" value={summary.dayChangePercent} format="percent" colorCode />
            </Card>
            <Card className="p-4">
              <MetricCard label="Positions" value={summary.positionCount} />
            </Card>
          </div>

          {/* Cash Flow Metrics */}
          {transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Summary</CardTitle>
                <CardDescription>Track deposits, withdrawals, and investment performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Deposits</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(netInvestedData.netDeposits)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Withdrawals</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(netInvestedData.netWithdrawals)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Net Invested</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(netInvestedData.netInvested)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dividends Received</p>
                    <p className="text-lg font-semibold text-green-500">{formatCurrency(netInvestedData.totalDividends)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Time-Weighted Return</p>
                    <p className={cn('text-lg font-semibold', performance.timeWeightedReturn >= 0 ? 'text-green-500' : 'text-red-500')}>
                      {performance.timeWeightedReturn >= 0 ? '+' : ''}{performance.timeWeightedReturn.toFixed(2)}%
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Money-Weighted Return</p>
                    <p className={cn('text-lg font-semibold', performance.moneyWeightedReturn >= 0 ? 'text-green-500' : 'text-red-500')}>
                      {performance.moneyWeightedReturn >= 0 ? '+' : ''}{performance.moneyWeightedReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Portfolio Valuation */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Valuation & Fundamentals</CardTitle>
              <CardDescription>
                Weighted average metrics across your holdings
                {portfolioMetrics.fundsMutualExcluded > 0 && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({portfolioMetrics.fundsMutualExcluded} mutual fund{portfolioMetrics.fundsMutualExcluded > 1 ? 's' : ''} excluded)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingFundamentals ? (
                <p className="text-gray-500">Loading fundamentals...</p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Valuation</h4>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                      <MetricCard label="P/E Ratio" value={portfolioMetrics.weightedPE} format="ratio" />
                      <MetricCard label="Forward P/E" value={portfolioMetrics.weightedForwardPE} format="ratio" />
                      <MetricCard label="EV/EBITDA" value={portfolioMetrics.weightedEvEbitda} format="ratio" />
                      <MetricCard label="Dividend Yield" value={portfolioMetrics.weightedDividendYield} format="percent" />
                      <MetricCard label="Beta" value={portfolioMetrics.weightedBeta} />
                      <MetricCard label="Day Change" value={summary.dayChangePercent} format="percent" colorCode />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Profitability & Growth</h4>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                      <MetricCard label="Revenue Growth" value={portfolioMetrics.weightedRevenueGrowth} format="percent" colorCode />
                      <MetricCard label="Profit Margin" value={portfolioMetrics.weightedProfitMargin} format="percent" colorCode />
                      <MetricCard label="Return on Equity" value={portfolioMetrics.weightedROE} format="percent" colorCode />
                      <MetricCard label="Return on Assets" value={portfolioMetrics.weightedROA} format="percent" colorCode />
                      <MetricCard label="Annualized Return" value={performance.annualizedReturn} format="percent" colorCode />
                      <MetricCard label="Total Return" value={performance.totalReturnPercent} format="percent" colorCode />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Benchmark Chart */}
          <BenchmarkChart
            portfolioData={portfolioCumReturns}
            benchmarkData={benchmarkCumReturns}
            benchmarkSymbol="SPY"
            loading={loadingBenchmark}
            onPeriodChange={setBenchmarkPeriod}
            currentPeriod={benchmarkPeriod}
          />

          {/* Risk Metrics */}
          {riskMetrics && <RiskMetricsCard metrics={riskMetrics} loading={loadingBenchmark} />}

          {/* Allocation Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Sector Allocation</CardTitle></CardHeader>
              <CardContent>
                <AllocationChart
                  data={sectorAllocation.map(s => ({ name: s.sector, value: s.value, weight: s.weight }))}
                  type="sector"
                  height={300}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Geographic Allocation (Region)</CardTitle></CardHeader>
              <CardContent>
                <AllocationChart
                  data={regionAllocation.map(r => ({ name: r.name, value: r.value, weight: r.weight }))}
                  type="region"
                  height={300}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Asset Type Allocation</CardTitle></CardHeader>
              <CardContent>
                <AllocationChart
                  data={assetTypeAllocation.map(a => ({
                    name: a.assetType.charAt(0).toUpperCase() + a.assetType.slice(1),
                    value: a.value,
                    weight: a.weight,
                  }))}
                  height={300}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Geographic Allocation (Country)</CardTitle></CardHeader>
              <CardContent>
                <AllocationChart
                  data={geographicAllocation.slice(0, 10).map(g => ({ name: g.country, value: g.value, weight: g.weight }))}
                  height={300}
                />
              </CardContent>
            </Card>
          </div>

          {/* Position Fundamentals Table */}
          <Card>
            <CardHeader>
              <CardTitle>Position Fundamentals</CardTitle>
              <CardDescription>Detailed metrics for each holding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Weight</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">P/E</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">EV/EBITDA</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Rev Growth</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Profit Margin</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">ROE</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Div Yield</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">1Y Return</th>
                      <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Beta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionsWithFundamentals.slice(0, 20).map(pos => {
                      const isMutualFund = pos.fundamentals?.quoteType === 'MUTUALFUND';
                      return (
                        <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 font-medium text-gray-900 dark:text-white">
                            <span className="flex items-center gap-1">
                              {pos.symbol}
                              {isMutualFund && <span className="text-xs text-gray-400">(Fund)</span>}
                            </span>
                          </td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-300">{pos.weight.toFixed(1)}%</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-300">{pos.fundamentals?.peRatio?.toFixed(1) || '—'}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-300">{pos.fundamentals?.evToEbitda?.toFixed(1) || '—'}</td>
                          <td className={cn('py-2 text-right', pos.fundamentals?.revenueGrowth ? pos.fundamentals.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500' : 'text-gray-600 dark:text-gray-300')}>
                            {pos.fundamentals?.revenueGrowth !== null && pos.fundamentals?.revenueGrowth !== undefined ? `${pos.fundamentals.revenueGrowth >= 0 ? '+' : ''}${pos.fundamentals.revenueGrowth.toFixed(1)}%` : '—'}
                          </td>
                          <td className={cn('py-2 text-right', pos.fundamentals?.profitMargin ? pos.fundamentals.profitMargin >= 0 ? 'text-green-500' : 'text-red-500' : 'text-gray-600 dark:text-gray-300')}>
                            {pos.fundamentals?.profitMargin !== null && pos.fundamentals?.profitMargin !== undefined ? `${pos.fundamentals.profitMargin.toFixed(1)}%` : '—'}
                          </td>
                          <td className={cn('py-2 text-right', pos.fundamentals?.returnOnEquity ? pos.fundamentals.returnOnEquity >= 0 ? 'text-green-500' : 'text-red-500' : 'text-gray-600 dark:text-gray-300')}>
                            {pos.fundamentals?.returnOnEquity !== null && pos.fundamentals?.returnOnEquity !== undefined ? `${pos.fundamentals.returnOnEquity.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-300">{pos.fundamentals?.dividendYield ? `${pos.fundamentals.dividendYield.toFixed(2)}%` : '—'}</td>
                          <td className={cn('py-2 text-right', pos.fundamentals?.oneYearReturn ? pos.fundamentals.oneYearReturn >= 0 ? 'text-green-500' : 'text-red-500' : 'text-gray-600 dark:text-gray-300')}>
                            {pos.fundamentals?.oneYearReturn !== null && pos.fundamentals?.oneYearReturn !== undefined ? `${pos.fundamentals.oneYearReturn >= 0 ? '+' : ''}${pos.fundamentals.oneYearReturn.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-300">{pos.fundamentals?.beta?.toFixed(2) || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============== THEMES TAB ============== */}
      {mainTab === 'themes' && (
        <div className="space-y-6">
          {/* Theme Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {thematicAnalysis.exposures.slice(0, 6).map((exposure) => {
              const level = getThemeWeightLevel(exposure.totalWeight);
              return (
                <Card key={exposure.theme.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: exposure.theme.color }} />
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{exposure.theme.name}</h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{exposure.theme.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{exposure.totalWeight.toFixed(1)}%</p>
                        <p className={cn('text-xs font-medium', level.color)}>{level.label}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-1">
                        {exposure.positions.slice(0, 5).map((pos) => (
                          <span key={pos.symbol} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {pos.symbol}
                          </span>
                        ))}
                        {exposure.positions.length > 5 && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            +{exposure.positions.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* All Themes Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Theme Exposure Distribution</CardTitle>
              <CardDescription>Portfolio weight allocated to each investment theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {thematicAnalysis.exposures.map((exposure) => (
                  <div key={exposure.theme.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: exposure.theme.color }} />
                        <span className="font-medium text-gray-700 dark:text-gray-300">{exposure.theme.name}</span>
                        <span className="text-gray-400">({exposure.positionCount})</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">{exposure.totalWeight.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(exposure.totalWeight, 100)}%`, backgroundColor: exposure.theme.color }}
                      />
                    </div>
                  </div>
                ))}
                {thematicAnalysis.exposures.length === 0 && (
                  <p className="py-4 text-center text-gray-500 dark:text-gray-400">No positions matched any investment themes</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Theme Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Theme Details</CardTitle>
              <CardDescription>Positions in each theme with their weights (a position may appear in multiple themes)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {thematicAnalysis.exposures.map((exposure) => (
                  <ThemeDetail key={exposure.theme.id} exposure={exposure} formatCurrency={formatCurrency} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Uncategorized Positions */}
          {thematicAnalysis.uncategorized.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Uncategorized Positions
                </CardTitle>
                <CardDescription>
                  Positions that don&apos;t match any investment theme ({thematicAnalysis.uncategorized.reduce((sum, p) => sum + p.weight, 0).toFixed(1)}% of portfolio)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {thematicAnalysis.uncategorized.map((pos) => (
                    <span key={pos.symbol} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800">
                      <span className="font-medium text-gray-900 dark:text-white">{pos.symbol}</span>
                      <span className="text-gray-500 dark:text-gray-400">({pos.weight.toFixed(1)}%)</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Theme Legend */}
          <Card>
            <CardHeader>
              <CardTitle>Available Themes</CardTitle>
              <CardDescription>Investment themes tracked by the analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {INVESTMENT_THEMES.map((theme) => {
                  const exposure = thematicAnalysis.exposures.find((e) => e.theme.id === theme.id);
                  const hasExposure = exposure && exposure.positionCount > 0;
                  return (
                    <div key={theme.id} className={cn('flex items-start gap-3 rounded-lg border p-3', hasExposure ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-200 opacity-60 dark:border-gray-700')}>
                      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: theme.color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{theme.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{theme.description}</p>
                        {hasExposure && (
                          <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                            {exposure.positionCount} position{exposure.positionCount !== 1 ? 's' : ''} · {exposure.totalWeight.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============== ETF OVERLAP TAB ============== */}
      {mainTab === 'etf' && (
        <div className="space-y-6">
          {etfPositions.length === 0 ? (
            <Card className="py-12 text-center">
              <Layers className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">No ETFs in your portfolio</p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">Add some ETF positions to analyze their holdings overlap</p>
            </Card>
          ) : loadingETF ? (
            <div className="flex h-96 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading ETF holdings...</span>
            </div>
          ) : etfError ? (
            <Card className="p-6">
              <p className="text-red-600 dark:text-red-400">{etfError}</p>
              <button onClick={fetchETFHoldings} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Retry</button>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              {etfSummary && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Layers className="h-4 w-4" />
                      Overlapping Stocks
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{etfSummary.totalOverlappingStocks}</div>
                    <p className="text-xs text-gray-500">Stocks held by 2+ ETFs</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <AlertTriangle className="h-4 w-4" />
                      Overlap Exposure
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{etfSummary.totalOverlappingExposure.toFixed(1)}%</div>
                    <p className="text-xs text-gray-500">Portfolio in duplicated holdings</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Info className="h-4 w-4" />
                      Top Overlap
                    </div>
                    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{etfSummary.topOverlap?.symbol || '-'}</div>
                    <p className="text-xs text-gray-500">{etfSummary.topOverlap ? `${etfSummary.topOverlap.exposure.toFixed(1)}% total exposure` : 'No overlap detected'}</p>
                  </Card>
                </div>
              )}

              {/* ETF Sub-tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex gap-6">
                  {[
                    { id: 'overlap' as const, label: 'Overlapping Holdings' },
                    { id: 'concentration' as const, label: 'Concentration Risk' },
                    { id: 'matrix' as const, label: 'ETF Overlap Matrix' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setEtfTab(tab.id)}
                      className={cn(
                        'border-b-2 py-3 text-sm font-medium transition-colors',
                        etfTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* ETF Tab Content */}
              {etfTab === 'overlap' && etfAnalysis && (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Stock</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">ETFs</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Total Exposure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {etfAnalysis.overlappingHoldings.slice(0, 20).map((holding) => {
                          const level = getConcentrationLevel(holding.totalExposure);
                          return (
                            <tr key={holding.symbol}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 dark:text-white">{holding.symbol}</div>
                                <div className="text-sm text-gray-500">{holding.name}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {holding.etfs.map((etf) => (
                                    <span key={etf.etf} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                      {etf.etf} ({etf.weight.toFixed(1)}%)
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={cn('font-medium', level.color)}>{holding.totalExposure.toFixed(2)}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {etfTab === 'concentration' && etfAnalysis && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Stocks with significant concentration across your portfolio. Red indicates &gt;5% exposure, yellow indicates 3-5%.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {etfAnalysis.concentrationRisks.slice(0, 15).map((risk) => {
                      const level = getConcentrationLevel(risk.exposure);
                      return (
                        <Card key={risk.symbol} className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">{risk.symbol}</span>
                            <span className={cn('text-lg font-bold', level.color)}>{risk.exposure.toFixed(1)}%</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">{risk.name}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {risk.sources.map((source) => (
                              <span key={source.etf} className="text-xs text-gray-400">
                                {source.etf}: {source.contribution.toFixed(1)}%
                              </span>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {etfTab === 'matrix' && etfAnalysis && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Percentage of holdings overlap between each pair of ETFs. Higher values indicate more redundancy.
                  </p>
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">ETF</th>
                            {etfAnalysis.overlapMatrix.etfs.map((etf) => (
                              <th key={etf} className="px-4 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">{etf}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {etfAnalysis.overlapMatrix.etfs.map((etf, i) => (
                            <tr key={etf}>
                              <td className="sticky left-0 bg-gray-50 px-4 py-3 font-medium text-gray-900 dark:bg-gray-800 dark:text-white">{etf}</td>
                              {etfAnalysis.overlapMatrix.matrix[i].map((overlap, j) => (
                                <td key={j} className="px-4 py-3 text-center">
                                  {i === j ? (
                                    <span className="text-gray-300 dark:text-gray-600">-</span>
                                  ) : (
                                    <span className={cn(
                                      'inline-flex h-8 w-12 items-center justify-center rounded text-sm font-medium',
                                      overlap >= 70 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                      overlap >= 50 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                      overlap >= 30 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    )}>
                                      {overlap.toFixed(0)}%
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============== RISK ANALYSIS TAB ============== */}
      {mainTab === 'risk' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Volatility (Annualized)</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {loadingHistory ? '...' : `${(volatility * 100).toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                    <TrendingDown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Beta</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {loadingHistory ? '...' : beta.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown (1Y)</p>
                    <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                      {loadingHistory ? '...' : `-${(maxDrawdown * 100).toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totalPortfolioValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Sub-tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-4">
              {[
                { id: 'correlation' as const, label: 'Correlation', icon: Activity },
                { id: 'factors' as const, label: 'Factor Exposure', icon: TrendingDown },
                { id: 'scenarios' as const, label: 'Stress Testing', icon: AlertTriangle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRiskTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                    riskTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Risk Tab Content */}
          <Card>
            <CardHeader>
              <CardTitle>
                {riskTab === 'correlation' && 'Position Correlation Matrix'}
                {riskTab === 'factors' && 'Factor Exposure Analysis'}
                {riskTab === 'scenarios' && 'Stress Test Scenarios'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loading message="Calculating risk metrics..." />
                </div>
              ) : (
                <>
                  {riskTab === 'correlation' && correlation && <CorrelationHeatmap data={correlation} />}
                  {riskTab === 'factors' && factorExposure && <FactorExposureChart data={factorExposure} />}
                  {riskTab === 'scenarios' && scenarios.length > 0 && <ScenarioTable scenarios={scenarios} totalPortfolioValue={totalPortfolioValue} />}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============== REBALANCING TAB ============== */}
      {mainTab === 'rebalancing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 dark:text-gray-400">Drift threshold:</label>
              <Select
                value={String(driftThreshold)}
                onChange={(e) => setDriftThreshold(Number(e.target.value))}
                options={[
                  { value: '1', label: '1%' },
                  { value: '2', label: '2%' },
                  { value: '3', label: '3%' },
                  { value: '5', label: '5%' },
                ]}
              />
            </div>
          </div>

          {/* Allocation Type Toggle */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 w-fit">
            {([
              { value: 'sector' as const, label: 'By Sector' },
              { value: 'asset_type' as const, label: 'By Asset Type' },
              { value: 'vs_index' as const, label: 'vs Index' },
            ]).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setAllocationType(tab.value)}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  allocationType === tab.value
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Index Comparison View */}
          {allocationType === 'vs_index' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Compare to Index
                    </CardTitle>
                    <CardDescription>See how your sector allocation compares to major indices</CardDescription>
                  </div>
                  <Select
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(e.target.value as IndexName)}
                    options={[
                      { value: 'SPY', label: 'S&P 500 (SPY)' },
                      { value: 'QQQ', label: 'NASDAQ 100 (QQQ)' },
                      { value: 'ACWI', label: 'MSCI ACWI (Global)' },
                    ]}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {indexDriftAnalysis.map(item => (
                    <div key={item.name} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          item.action === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          item.action === 'sell' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        )}>
                          {item.action === 'buy' ? 'Under' : item.action === 'sell' ? 'Over' : 'OK'}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-xs text-gray-500">You</span>
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(item.currentWeight, 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{item.currentWeight.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16 text-xs text-gray-500">{selectedIndex}</span>
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-400 dark:bg-gray-600 rounded-full" style={{ width: `${Math.min(item.targetWeight, 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs font-medium text-gray-500">{item.targetWeight.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <span className={cn('text-xs font-medium', item.drift > 0 ? 'text-red-500' : item.drift < 0 ? 'text-green-500' : 'text-gray-500')}>
                          {item.drift >= 0 ? '+' : ''}{item.drift.toFixed(1)}% vs {selectedIndex}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-red-500">{indexDriftAnalysis.filter(d => d.action === 'sell').length}</p>
                      <p className="text-xs text-gray-500">Overweight sectors</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-500">{indexDriftAnalysis.filter(d => d.action === 'hold').length}</p>
                      <p className="text-xs text-gray-500">On target</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">{indexDriftAnalysis.filter(d => d.action === 'buy').length}</p>
                      <p className="text-xs text-gray-500">Underweight sectors</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Custom Targets View */}
          {allocationType !== 'vs_index' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Target Allocations Editor */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Target Allocations</CardTitle>
                      <CardDescription>
                        Set your desired allocation targets
                        {totalTargetWeight > 0 && (
                          <span className={cn('ml-2 font-medium', Math.abs(totalTargetWeight - 100) < 0.1 ? 'text-green-600' : 'text-yellow-600')}>
                            (Total: {totalTargetWeight.toFixed(1)}%)
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    {allocationType === 'sector' && (
                      <Select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleLoadPreset(e.target.value as PresetName);
                        }}
                        options={[
                          { value: '', label: 'Load Preset...' },
                          { value: 'S&P 500 Sectors', label: 'S&P 500 Weights' },
                          { value: 'Equal Weight Sectors', label: 'Equal Weight' },
                          { value: 'Conservative', label: 'Conservative' },
                          { value: 'Growth Focus', label: 'Growth Focus' },
                        ]}
                        className="text-sm"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTargets ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentTargets.map(target => {
                        const isEditing = editingTargets.has(target.id);
                        const editValue = editingTargets.get(target.id) ?? target.target_weight;
                        return (
                          <div key={target.id} className="flex items-center gap-2">
                            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{target.name}</span>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={isEditing ? editValue : target.target_weight}
                              onChange={(e) => setEditingTargets(prev => new Map(prev).set(target.id, parseFloat(e.target.value) || 0))}
                              className="w-20 text-right text-sm"
                            />
                            <span className="text-sm text-gray-500">%</span>
                            {isEditing && (
                              <Button variant="outline" onClick={() => handleSaveTarget(target)} disabled={saving} className="px-2">
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="outline" onClick={() => handleDeleteTarget(target.id)} className="px-2 text-red-500 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                      <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                        <Input
                          placeholder={allocationType === 'sector' ? 'Sector name' : 'Asset type'}
                          value={newTargetName}
                          onChange={(e) => setNewTargetName(e.target.value)}
                          className="flex-1 text-sm"
                        />
                        <Input
                          type="number"
                          placeholder="%"
                          min="0"
                          max="100"
                          step="0.5"
                          value={newTargetWeight}
                          onChange={(e) => setNewTargetWeight(e.target.value)}
                          className="w-20 text-right text-sm"
                        />
                        <Button onClick={handleAddTarget} disabled={saving || !newTargetName.trim() || !newTargetWeight}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {totalTargetWeight > 0 && Math.abs(totalTargetWeight - 100) > 0.1 && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-yellow-50 p-2 text-sm text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                          <AlertTriangle className="h-4 w-4" />
                          Target weights sum to {totalTargetWeight.toFixed(1)}%, not 100%
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Drift Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Drift Analysis</CardTitle>
                  <CardDescription>Current vs target allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  {currentTargets.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">Set target allocations to see drift analysis</div>
                  ) : (
                    <div className="space-y-3">
                      {driftAnalysis.map(item => (
                        <div key={item.name} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                            <span className={cn(
                              'flex items-center gap-1 text-sm font-medium',
                              item.action === 'buy' ? 'text-green-600 dark:text-green-400' :
                              item.action === 'sell' ? 'text-red-600 dark:text-red-400' :
                              'text-gray-500'
                            )}>
                              {item.action === 'buy' && <ArrowUp className="h-3 w-3" />}
                              {item.action === 'sell' && <ArrowDown className="h-3 w-3" />}
                              {item.action === 'hold' ? 'On target' : item.action === 'buy' ? 'Underweight' : 'Overweight'}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>Current: {item.currentWeight.toFixed(1)}%</span>
                            <span>Target: {item.targetWeight.toFixed(1)}%</span>
                            <span className={cn('font-medium', item.drift > 0 ? 'text-red-500' : item.drift < 0 ? 'text-green-500' : 'text-gray-500')}>
                              Drift: {item.drift >= 0 ? '+' : ''}{item.drift.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="rounded-full bg-blue-500" style={{ width: `${Math.min(item.currentWeight, 100)}%` }} />
                          </div>
                          <div className="relative mt-0.5">
                            <div className="absolute top-0 h-2 w-0.5 bg-red-500" style={{ left: `${Math.min(item.targetWeight, 100)}%` }} title="Target" />
                          </div>
                          {item.action !== 'hold' && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {item.action === 'buy' ? 'Buy' : 'Sell'}{' '}
                              <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Math.abs(item.adjustmentDollars))}</span>
                              {' '}to reach target
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
