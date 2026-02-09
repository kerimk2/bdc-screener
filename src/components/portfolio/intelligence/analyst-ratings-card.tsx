'use client';

import { useBlinding } from '@/components/portfolio/providers/blinding-provider';
import type { AnalystRating } from '@/types/portfolio';

interface AnalystRatingsCardProps {
  ratings: AnalystRating[];
  summary: {
    averageRating: string;
    averageScore: number;
    averageUpside: number | null;
    totalAnalystsCovering: number;
    strongBuys: number;
    buys: number;
    holds: number;
    sells: number;
  };
}

function getRatingBadgeColor(rating: string): string {
  switch (rating) {
    case 'Strong Buy':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'Buy':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'Hold':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Sell':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 'Strong Sell':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function AnalystRatingsCard({ ratings, summary }: AnalystRatingsCardProps) {
  const { isBlinded } = useBlinding();

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Rating</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{summary.averageRating}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Upside</p>
          <p className={`mt-1 text-lg font-semibold ${summary.averageUpside && summary.averageUpside > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {summary.averageUpside !== null ? `${summary.averageUpside > 0 ? '+' : ''}${summary.averageUpside.toFixed(1)}%` : 'N/A'}
          </p>
        </div>
        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">Buy</p>
          <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">{summary.strongBuys + summary.buys}</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">Hold</p>
          <p className="mt-1 text-lg font-semibold text-yellow-600 dark:text-yellow-400">{summary.holds}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">Sell</p>
          <p className="mt-1 text-lg font-semibold text-red-600 dark:text-red-400">{summary.sells}</p>
        </div>
      </div>

      {/* Ratings Table */}
      {ratings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No analyst coverage data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                <th className="pb-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Rating</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Analysts</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Current</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Target</th>
                <th className="pb-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Upside</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={r.symbol} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{r.symbol}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRatingBadgeColor(r.rating)}`}>
                      {r.rating}
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-400">{r.totalAnalysts}</td>
                  <td className="py-3 text-right text-gray-900 dark:text-white">
                    {isBlinded ? '•••••' : `$${r.currentPrice.toFixed(2)}`}
                  </td>
                  <td className="py-3 text-right text-gray-900 dark:text-white">
                    {isBlinded ? '•••••' : r.targetPrice ? `$${r.targetPrice.toFixed(2)}` : '-'}
                  </td>
                  <td className={`py-3 text-right font-medium ${r.upside !== null && r.upside > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {r.upside !== null ? `${r.upside > 0 ? '+' : ''}${r.upside.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
