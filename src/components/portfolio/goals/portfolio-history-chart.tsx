'use client';

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useBlinding } from '@/components/portfolio/providers/blinding-provider';
import { calculatePortfolioHistory } from '@/lib/portfolio/goal-projections';
import type { PortfolioSnapshot } from '@/types/portfolio';

interface PortfolioHistoryChartProps {
  snapshots: PortfolioSnapshot[];
  height?: number;
}

export function PortfolioHistoryChart({ snapshots, height = 300 }: PortfolioHistoryChartProps) {
  const { isBlinded } = useBlinding();

  if (snapshots.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 dark:text-gray-400"
        style={{ height }}
      >
        No snapshot data available. Take a snapshot to start tracking.
      </div>
    );
  }

  const data = calculatePortfolioHistory(snapshots);

  const formatValue = (value: number) => {
    if (isBlinded) return '•••••';
    return `$${(value / 1000).toFixed(0)}k`;
  };

  const formatTooltipValue = (value: number) => {
    if (isBlinded) return '•••••';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatValue}
          stroke="#9ca3af"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}
          formatter={(value, name) => [
            formatTooltipValue(Number(value)),
            name === 'value' ? 'Portfolio Value' : String(name),
          ]}
          labelFormatter={(label) =>
            new Date(label).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
