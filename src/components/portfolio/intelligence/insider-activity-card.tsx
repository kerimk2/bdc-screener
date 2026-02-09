'use client';

import { TrendingUp, TrendingDown, User } from 'lucide-react';
import { useBlinding } from '@/components/portfolio/providers/blinding-provider';
import type { InsiderTransaction } from '@/types/portfolio';

interface InsiderActivityCardProps {
  transactions: InsiderTransaction[];
  summaryBySymbol: Record<string, { buys: number; sells: number; netShares: number; netValue: number }>;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatShares(shares: number): string {
  if (shares >= 1e6) return `${(shares / 1e6).toFixed(1)}M`;
  if (shares >= 1e3) return `${(shares / 1e3).toFixed(0)}K`;
  return shares.toLocaleString();
}

export function InsiderActivityCard({ transactions, summaryBySymbol }: InsiderActivityCardProps) {
  const { isBlinded } = useBlinding();

  const netValue = Object.values(summaryBySymbol).reduce((sum, s) => sum + s.netValue, 0);
  const totalBuys = Object.values(summaryBySymbol).reduce((sum, s) => sum + s.buys, 0);
  const totalSells = Object.values(summaryBySymbol).reduce((sum, s) => sum + s.sells, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Buy Transactions</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{totalBuys}</p>
        </div>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Sell Transactions</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{totalSells}</p>
        </div>
        <div className={`rounded-lg p-4 ${netValue >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Net Activity</span>
          </div>
          <p className={`mt-1 text-xl font-semibold ${netValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isBlinded ? '•••••' : (netValue >= 0 ? '+' : '') + formatCurrency(netValue)}
          </p>
        </div>
      </div>

      {/* By Symbol Summary */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">By Position</h4>
        <div className="space-y-2">
          {Object.entries(summaryBySymbol)
            .filter(([, data]) => data.buys > 0 || data.sells > 0)
            .sort((a, b) => Math.abs(b[1].netValue) - Math.abs(a[1].netValue))
            .slice(0, 10)
            .map(([symbol, data]) => (
              <div key={symbol} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <span className="font-medium text-gray-900 dark:text-white">{symbol}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 dark:text-green-400">+{data.buys}</span>
                  <span className="text-red-600 dark:text-red-400">-{data.sells}</span>
                  <span className={`font-medium ${data.netValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isBlinded ? '•••••' : formatCurrency(data.netValue)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Recent Transactions</h4>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No recent insider transactions</p>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 15).map((tx, index) => (
              <div key={index} className="flex items-start justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-1.5 ${tx.type === 'Buy' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <User className={`h-4 w-4 ${tx.type === 'Buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {tx.symbol} - {tx.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tx.relation} · {tx.date}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${tx.type === 'Buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {tx.type} {formatShares(tx.shares)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isBlinded ? '•••••' : formatCurrency(tx.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
