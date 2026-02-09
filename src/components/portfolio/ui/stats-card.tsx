import { cn } from '@/lib/portfolio/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
}: StatsCardProps) {
  const determinedTrend = trend || (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        {icon && (
          <div className="text-gray-400 dark:text-gray-500">{icon}</div>
        )}
      </div>

      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
        {value}
      </p>

      {(change !== undefined || changeLabel) && (
        <div className="mt-2 flex items-center gap-1">
          {determinedTrend === 'up' && (
            <TrendingUp className="h-4 w-4 text-green-500" />
          )}
          {determinedTrend === 'down' && (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          {determinedTrend === 'neutral' && (
            <Minus className="h-4 w-4 text-gray-500" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              determinedTrend === 'up' && 'text-green-500',
              determinedTrend === 'down' && 'text-red-500',
              determinedTrend === 'neutral' && 'text-gray-500'
            )}
          >
            {change !== undefined && (change > 0 ? '+' : '')}
            {change !== undefined ? `${change.toFixed(2)}%` : ''}
          </span>
          {changeLabel && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
