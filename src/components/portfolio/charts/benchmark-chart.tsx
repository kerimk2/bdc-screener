'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { cn } from '@/lib/portfolio/utils';

type Period = '1m' | '3m' | '6m' | 'ytd' | '1y';

interface BenchmarkChartProps {
  portfolioData: { date: string; value: number }[];
  benchmarkData: { date: string; value: number }[];
  benchmarkSymbol?: string;
  loading?: boolean;
  onPeriodChange?: (period: Period) => void;
  currentPeriod?: Period;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
];

function BenchmarkTooltip({
  active,
  payload,
  label,
  benchmarkSymbol,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  benchmarkSymbol: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        {payload.map((entry, index) => {
          const returnVal = entry.value - 100;
          return (
            <p
              key={index}
              className="text-sm font-medium"
              style={{ color: entry.color }}
            >
              {entry.dataKey === 'portfolio' ? 'Portfolio' : benchmarkSymbol}:{' '}
              <span className={returnVal >= 0 ? 'text-green-600' : 'text-red-600'}>
                {returnVal >= 0 ? '+' : ''}{returnVal.toFixed(2)}%
              </span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
}

export function BenchmarkChart({
  portfolioData,
  benchmarkData,
  benchmarkSymbol = 'SPY',
  loading,
  onPeriodChange,
  currentPeriod = '1y',
}: BenchmarkChartProps) {
  // Merge portfolio and benchmark data by date using union of all dates
  // This ensures no gaps when dates don't match exactly
  const portfolioMap = new Map(portfolioData.map(d => [d.date, d.value]));
  const benchmarkMap = new Map(benchmarkData.map(d => [d.date, d.value]));

  // Get all unique dates from both datasets
  const allDates = [...new Set([...portfolioMap.keys(), ...benchmarkMap.keys()])].sort();

  // Build merged data with forward-filling for missing values
  let lastPortfolioValue: number | null = null;
  let lastBenchmarkValue: number | null = null;

  const mergedData = allDates.map((date) => {
    const portfolioValue = portfolioMap.get(date) ?? null;
    const benchmarkValue = benchmarkMap.get(date) ?? null;

    // Forward-fill missing values with last known value
    const portfolio = portfolioValue ?? lastPortfolioValue;
    const benchmark = benchmarkValue ?? lastBenchmarkValue;

    // Update last known values
    if (portfolioValue !== null) lastPortfolioValue = portfolioValue;
    if (benchmarkValue !== null) lastBenchmarkValue = benchmarkValue;

    return {
      date,
      portfolio,
      benchmark,
    };
  }).filter(d => d.portfolio !== null || d.benchmark !== null);

  // Calculate returns for summary
  const portfolioReturn = portfolioData.length > 1
    ? ((portfolioData[portfolioData.length - 1].value - 100) / 100) * 100
    : 0;
  const benchmarkReturn = benchmarkData.length > 1
    ? ((benchmarkData[benchmarkData.length - 1].value - 100) / 100) * 100
    : 0;
  const excessReturn = portfolioReturn - benchmarkReturn;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio vs Benchmark</CardTitle>
          <CardDescription>Comparing performance against {benchmarkSymbol}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio vs Benchmark</CardTitle>
            <CardDescription>Comparing performance against {benchmarkSymbol}</CardDescription>
          </div>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {PERIODS.map((period) => (
              <button
                key={period.value}
                onClick={() => onPeriodChange?.(period.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  currentPeriod === period.value
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                )}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Return Summary */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Portfolio</p>
            <p className={cn(
              'text-xl font-bold',
              portfolioReturn >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{benchmarkSymbol}</p>
            <p className={cn(
              'text-xl font-bold',
              benchmarkReturn >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-950">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Excess Return</p>
            <p className={cn(
              'text-xl font-bold',
              excessReturn >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {excessReturn >= 0 ? '+' : ''}{excessReturn.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Chart */}
        {mergedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value - 100).toFixed(0)}%`}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip content={<BenchmarkTooltip benchmarkSymbol={benchmarkSymbol} />} />
              <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="3 3" />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {value === 'portfolio' ? 'Portfolio' : benchmarkSymbol}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="#6b7280"
                strokeWidth={2}
                dot={false}
                name="benchmark"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="portfolio"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center py-16 text-gray-500">
            No data available for the selected period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
