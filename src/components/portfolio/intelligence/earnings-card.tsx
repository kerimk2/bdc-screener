'use client';

import { Calendar, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import type { EarningsEstimate } from '@/types/portfolio';

interface EarningsCardProps {
  earnings: EarningsEstimate[];
  upcomingEarnings: { symbol: string; date: string; daysUntil: number }[];
  summary: {
    symbolsWithUpcoming: number;
    nextEarningsDate: string | null;
    nextEarningsSymbol: string | null;
    historicalBeatRate: number | null;
    totalReportsAnalyzed: number;
  };
}

function formatEPS(value: number | null): string {
  if (value === null) return 'N/A';
  return `$${value.toFixed(2)}`;
}

export function EarningsCard({ earnings, upcomingEarnings, summary }: EarningsCardProps) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Upcoming</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
            {summary.symbolsWithUpcoming}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">in next 30 days</p>
        </div>
        {summary.nextEarningsDate && (
          <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Next Report</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-purple-600 dark:text-purple-400">
              {summary.nextEarningsSymbol}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(summary.nextEarningsDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}
        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Beat Rate</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
            {summary.historicalBeatRate !== null ? `${summary.historicalBeatRate.toFixed(0)}%` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {summary.totalReportsAnalyzed} reports
          </p>
        </div>
      </div>

      {/* Upcoming Earnings Calendar */}
      {upcomingEarnings.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Earnings Calendar</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEarnings.map((e) => (
              <div key={e.symbol} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <span className="font-medium text-gray-900 dark:text-white">{e.symbol}</span>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {e.daysUntil === 0 ? 'Today' : e.daysUntil === 1 ? 'Tomorrow' : `${e.daysUntil} days`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earnings History by Position */}
      <div>
        <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Recent Earnings History</h4>
        {earnings.filter(e => e.history.length > 0).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No earnings history available</p>
        ) : (
          <div className="space-y-4">
            {earnings
              .filter((e) => e.history.length > 0)
              .slice(0, 10)
              .map((e) => (
                <div key={e.symbol} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{e.symbol}</span>
                    {e.nextEarningsDate && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Next: {new Date(e.nextEarningsDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {e.history.slice(0, 4).map((h, idx) => {
                      const beat = h.actual !== null && h.estimated !== null && h.actual > h.estimated;
                      const miss = h.actual !== null && h.estimated !== null && h.actual < h.estimated;
                      return (
                        <div
                          key={idx}
                          className={`rounded p-2 ${
                            beat ? 'bg-green-50 dark:bg-green-900/20' : miss ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'
                          }`}
                        >
                          <p className="font-medium text-gray-600 dark:text-gray-400">{h.quarter}</p>
                          <div className="mt-1 flex items-center gap-1">
                            {beat ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : miss ? (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : null}
                            <span className={beat ? 'text-green-600 dark:text-green-400' : miss ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                              {formatEPS(h.actual)}
                            </span>
                          </div>
                          <p className="text-gray-400">Est: {formatEPS(h.estimated)}</p>
                          {h.surprisePercent !== null && (
                            <p className={`text-xs ${h.surprisePercent > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {h.surprisePercent > 0 ? '+' : ''}{h.surprisePercent.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
