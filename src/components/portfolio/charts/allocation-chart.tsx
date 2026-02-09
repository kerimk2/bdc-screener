'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useBlinding } from '@/components/portfolio/providers/blinding-provider';
import { getChartColor, getSectorColor, getRegionColor } from '@/lib/portfolio/utils';

interface AllocationChartProps {
  data: { name: string; value: number; weight: number }[];
  type?: 'sector' | 'region' | 'default';
  height?: number;
}

// Custom label renderer for pie slices
const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCustomLabel({ cx, cy, midAngle, outerRadius, payload }: any) {
  const weight = payload?.weight ?? 0;
  // Only show labels for slices >= 5% to avoid clutter
  if (weight < 5) return null;

  // Position label outside the pie slice
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-medium text-gray-700 dark:text-gray-300"
    >
      {`${weight.toFixed(1)}%`}
    </text>
  );
}

function AllocationTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { weight: number } }> }) {
  const { isBlinded } = useBlinding();
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {isBlinded ? '•••••' : `$${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {data.payload.weight.toFixed(2)}%
        </p>
      </div>
    );
  }
  return null;
}

export function AllocationChart({ data, type = 'default', height = 300 }: AllocationChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500 dark:text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const getColor = (entry: { name: string }, index: number) => {
    if (type === 'sector') {
      return getSectorColor(entry.name);
    }
    if (type === 'region') {
      return getRegionColor(entry.name);
    }
    return getChartColor(index);
  };

  // Create a map for quick lookup of weights by name
  const weightMap = new Map(data.map(d => [d.name, d.weight]));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="40%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={renderCustomLabel}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry, index)} />
          ))}
        </Pie>
        <Tooltip content={<AllocationTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ paddingLeft: '20px' }}
          formatter={(value: string) => {
            const weight = weightMap.get(value);
            return (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {value} <span className="font-medium text-gray-500 dark:text-gray-400">({weight?.toFixed(1)}%)</span>
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
