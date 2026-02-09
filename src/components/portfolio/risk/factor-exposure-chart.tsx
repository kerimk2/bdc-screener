'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, ReferenceLine } from 'recharts';
import { FactorExposure } from '@/types/portfolio';

interface FactorExposureChartProps {
  data: FactorExposure;
}

const FACTOR_LABELS: Record<string, string> = {
  value: 'Value',
  growth: 'Growth',
  momentum: 'Momentum',
  quality: 'Quality',
};

function getFactorColor(value: number): string {
  if (value > 0.3) return '#10b981'; // green
  if (value > 0) return '#34d399';
  if (value > -0.3) return '#f87171';
  return '#ef4444'; // red
}

export function FactorExposureChart({ data }: FactorExposureChartProps) {
  const chartData = [
    { factor: 'Value', value: data.value, description: 'Exposure to undervalued stocks (low P/E)' },
    { factor: 'Growth', value: data.growth, description: 'Exposure to high-growth companies' },
    { factor: 'Momentum', value: data.momentum, description: 'Exposure to recent price trends' },
    { factor: 'Quality', value: data.quality, description: 'Exposure to profitable companies' },
  ];

  const sizeData = [
    { name: 'Large Cap', value: data.size.large, color: '#3b82f6' },
    { name: 'Mid Cap', value: data.size.mid, color: '#8b5cf6' },
    { name: 'Small Cap', value: data.size.small, color: '#ec4899' },
  ];

  return (
    <div className="space-y-6">
      {/* Factor Bars */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Factor Tilts
        </h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[-1, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#9ca3af"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="factor"
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [`${(Number(value) * 100).toFixed(0)}%`, 'Exposure']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                }}
              />
              <ReferenceLine x={0} stroke="#9ca3af" />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getFactorColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Size Breakdown */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Market Cap Exposure
        </h4>
        <div className="space-y-3">
          {sizeData.map((item) => (
            <div key={item.name} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                {item.name}
              </div>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${item.value * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <div className="w-16 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                {(item.value * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Factor Descriptions */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Understanding Factors
        </h4>
        <dl className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
          <div>
            <dt className="font-medium inline">Value:</dt>
            <dd className="inline ml-1">Favors stocks with low valuations (P/E, P/B)</dd>
          </div>
          <div>
            <dt className="font-medium inline">Growth:</dt>
            <dd className="inline ml-1">Favors companies with high earnings growth</dd>
          </div>
          <div>
            <dt className="font-medium inline">Momentum:</dt>
            <dd className="inline ml-1">Favors stocks with strong recent performance</dd>
          </div>
          <div>
            <dt className="font-medium inline">Quality:</dt>
            <dd className="inline ml-1">Favors profitable, stable companies</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
