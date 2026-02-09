'use client';

import { CorrelationMatrix } from '@/types/portfolio';

interface CorrelationHeatmapProps {
  data: CorrelationMatrix;
}

function getCorrelationColor(value: number): string {
  // Red for negative, white for zero, green for positive
  if (value >= 0.7) return 'bg-green-600 text-white';
  if (value >= 0.4) return 'bg-green-400 text-white';
  if (value >= 0.1) return 'bg-green-200 text-gray-800';
  if (value >= -0.1) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  if (value >= -0.4) return 'bg-red-200 text-gray-800';
  if (value >= -0.7) return 'bg-red-400 text-white';
  return 'bg-red-600 text-white';
}

export function CorrelationHeatmap({ data }: CorrelationHeatmapProps) {
  const { symbols, matrix, highCorrelations } = data;

  if (symbols.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        No correlation data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400"></th>
                {symbols.map((symbol) => (
                  <th
                    key={symbol}
                    className="p-2 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((rowSymbol, rowIndex) => (
                <tr key={rowSymbol}>
                  <td className="p-2 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {rowSymbol}
                  </td>
                  {matrix[rowIndex].map((value, colIndex) => (
                    <td
                      key={`${rowSymbol}-${symbols[colIndex]}`}
                      className={`p-2 text-center text-xs font-medium ${getCorrelationColor(value)}`}
                      title={`${rowSymbol} / ${symbols[colIndex]}: ${value.toFixed(2)}`}
                    >
                      {rowIndex === colIndex ? '1.00' : value.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 text-xs">
        <span className="text-gray-600 dark:text-gray-400">Negative</span>
        <div className="flex gap-0.5">
          <div className="w-6 h-4 bg-red-600 rounded-l"></div>
          <div className="w-6 h-4 bg-red-400"></div>
          <div className="w-6 h-4 bg-red-200"></div>
          <div className="w-6 h-4 bg-gray-100 dark:bg-gray-700"></div>
          <div className="w-6 h-4 bg-green-200"></div>
          <div className="w-6 h-4 bg-green-400"></div>
          <div className="w-6 h-4 bg-green-600 rounded-r"></div>
        </div>
        <span className="text-gray-600 dark:text-gray-400">Positive</span>
      </div>

      {/* Correlation Analysis */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid md:grid-cols-2 gap-6">
        {/* High Correlations - WARNING: concentration risk */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Most Correlated Pairs (Top 10)
          </h4>
          {highCorrelations.length > 0 ? (
            <div className="space-y-2">
              {highCorrelations.map(({ pair, value }, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2"
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {pair[0]} / {pair[1]}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No highly correlated pairs found
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            <strong>High correlation</strong> means these assets move together.
            Consider reducing overlap to improve diversification.
          </p>
        </div>

        {/* Low Correlations - GOOD: diversification benefit */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Least Correlated / Negative Pairs (Top 10)
          </h4>
          {data.lowCorrelations && data.lowCorrelations.length > 0 ? (
            <div className="space-y-2">
              {data.lowCorrelations.map(({ pair, value }, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2"
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {pair[0]} / {pair[1]}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {value > 0 ? '+' : ''}{value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No low correlation pairs found
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            <strong>Low/negative correlation</strong> provides diversification benefits.
            These assets tend to move independently or in opposite directions.
          </p>
        </div>
      </div>

      {/* Explanation Panel */}
      <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          Understanding Correlations
        </h4>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <li><strong>+1.0:</strong> Perfect positive - assets move in lockstep</li>
          <li><strong>+0.5 to +0.9:</strong> Strong positive - assets usually move together, potential concentration risk</li>
          <li><strong>0 to +0.5:</strong> Low positive - some diversification benefit</li>
          <li><strong>-0.5 to 0:</strong> Low negative - good diversification, assets move independently</li>
          <li><strong>-1.0 to -0.5:</strong> Strong negative - excellent hedge, assets move in opposite directions</li>
        </ul>
      </div>
    </div>
  );
}
