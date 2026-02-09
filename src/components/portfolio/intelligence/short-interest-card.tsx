'use client';

import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface ShortInterestData {
  symbol: string;
  shortPercentOfFloat: number | null;
  shortRatio: number | null;
  sharesShort: number | null;
  sharesShortPriorMonth: number | null;
  shortPercentChange: number | null;
  floatShares: number | null;
  daysTocover: number | null;
}

interface ShortInterestCardProps {
  shortInterest: ShortInterestData[];
  summary: {
    averageShortPercent: number | null;
    highShortInterestCount: number;
    increasingShortCount: number;
    positionsWithData: number;
  };
}

function formatNumber(value: number | null): string {
  if (value === null) return '-';
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toLocaleString();
}

function getShortInterestLevel(percent: number | null): { label: string; color: string } {
  if (percent === null) return { label: '-', color: 'text-gray-500' };
  if (percent >= 20) return { label: 'Very High', color: 'text-red-600 dark:text-red-400' };
  if (percent >= 10) return { label: 'High', color: 'text-orange-600 dark:text-orange-400' };
  if (percent >= 5) return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
  return { label: 'Low', color: 'text-green-600 dark:text-green-400' };
}

export function ShortInterestCard({ shortInterest, summary }: ShortInterestCardProps) {
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Short %</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {summary.averageShortPercent !== null ? `${summary.averageShortPercent.toFixed(1)}%` : 'N/A'}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">High Short (&gt;10%)</p>
          <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">
            {summary.highShortInterestCount}
          </p>
        </div>
        <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">Short Increasing</p>
          <p className="mt-1 text-lg font-semibold text-orange-600 dark:text-orange-400">
            {summary.increasingShortCount}
          </p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">Positions w/ Data</p>
          <p className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
            {summary.positionsWithData}
          </p>
        </div>
      </div>

      {/* Short Interest Table */}
      {shortInterest.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No short interest data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Short % Float</th>
                <th className="pb-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Level</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Days to Cover</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Shares Short</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">MoM Change</th>
              </tr>
            </thead>
            <tbody>
              {shortInterest.map((d) => {
                const level = getShortInterestLevel(d.shortPercentOfFloat);
                return (
                  <tr key={d.symbol} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{d.symbol}</span>
                        {d.shortPercentOfFloat !== null && d.shortPercentOfFloat >= 20 && (
                          <span title="Very high short interest">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`py-3 text-right font-medium ${level.color}`}>
                      {d.shortPercentOfFloat !== null ? `${d.shortPercentOfFloat.toFixed(1)}%` : '-'}
                    </td>
                    <td className={`py-3 text-sm ${level.color}`}>
                      {level.label}
                    </td>
                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                      {d.daysTocover !== null ? d.daysTocover.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                      {formatNumber(d.sharesShort)}
                    </td>
                    <td className="py-3 text-right">
                      {d.shortPercentChange !== null ? (
                        <span className={`flex items-center justify-end gap-1 ${d.shortPercentChange > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {d.shortPercentChange > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {d.shortPercentChange > 0 ? '+' : ''}{d.shortPercentChange.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Note */}
      <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Short interest</strong> shows the percentage of shares sold short relative to float.
          High short interest (&gt;10%) can indicate bearish sentiment but may also lead to short squeezes.
          Days to cover shows how many days of average volume it would take to cover all short positions.
        </p>
      </div>
    </div>
  );
}
