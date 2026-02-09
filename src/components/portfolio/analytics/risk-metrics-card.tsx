'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { RiskMetrics } from '@/types/portfolio';
import { cn } from '@/lib/portfolio/utils';
import { TrendingUp, TrendingDown, Activity, Shield, Target, BarChart3 } from 'lucide-react';

interface RiskMetricsCardProps {
  metrics: RiskMetrics;
  loading?: boolean;
}

function MetricItem({
  label,
  value,
  format = 'number',
  icon: Icon,
  description,
  colorCode = false,
  invertColor = false,
}: {
  label: string;
  value: number;
  format?: 'number' | 'percent' | 'ratio';
  icon?: React.ElementType;
  description?: string;
  colorCode?: boolean;
  invertColor?: boolean;
}) {
  const formatValue = () => {
    switch (format) {
      case 'percent':
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
      case 'ratio':
        return value.toFixed(2);
      default:
        return value.toFixed(2);
    }
  };

  const getColorClass = () => {
    if (!colorCode) return 'text-gray-900 dark:text-white';
    const isPositive = invertColor ? value < 0 : value >= 0;
    return isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
      {Icon && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className={cn('text-lg font-semibold', getColorClass())}>
          {formatValue()}
        </p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{description}</p>
        )}
      </div>
    </div>
  );
}

export function RiskMetricsCard({ metrics, loading }: RiskMetricsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Metrics</CardTitle>
          <CardDescription>Portfolio risk analysis vs benchmark</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Metrics</CardTitle>
        <CardDescription>Portfolio risk analysis vs benchmark (SPY)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Primary Metrics - Alpha & Beta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Alpha</span>
              </div>
              <p className={cn(
                'mt-2 text-3xl font-bold',
                metrics.alpha >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                {metrics.alpha >= 0 ? '+' : ''}{metrics.alpha.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Excess return vs benchmark
              </p>
            </div>
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Beta</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {metrics.beta.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {metrics.beta > 1 ? 'More volatile than market' : metrics.beta < 1 ? 'Less volatile than market' : 'Market-like volatility'}
              </p>
            </div>
          </div>

          {/* Risk-Adjusted Returns */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Risk-Adjusted Returns
            </h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricItem
                label="Sharpe Ratio"
                value={metrics.sharpeRatio}
                format="ratio"
                icon={Target}
                description={metrics.sharpeRatio > 1 ? 'Good' : metrics.sharpeRatio > 0.5 ? 'Average' : 'Low'}
                colorCode
              />
              <MetricItem
                label="Sortino Ratio"
                value={metrics.sortinoRatio}
                format="ratio"
                icon={Shield}
                description="Downside risk adjusted"
                colorCode
              />
              <MetricItem
                label="Information Ratio"
                value={metrics.informationRatio}
                format="ratio"
                icon={BarChart3}
                colorCode
              />
              <MetricItem
                label="R-Squared"
                value={metrics.rSquared * 100}
                format="percent"
                description={metrics.rSquared > 0.7 ? 'High correlation' : 'Low correlation'}
              />
            </div>
          </div>

          {/* Risk Measures */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Risk Measures
            </h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricItem
                label="Volatility (Ann.)"
                value={metrics.volatility}
                format="percent"
                icon={Activity}
              />
              <MetricItem
                label="Max Drawdown"
                value={-metrics.maxDrawdown}
                format="percent"
                icon={TrendingDown}
                colorCode
                invertColor
              />
              <MetricItem
                label="VaR (95%)"
                value={-metrics.var95}
                format="percent"
                description="Daily loss at 95% confidence"
                colorCode
                invertColor
              />
              <MetricItem
                label="Tracking Error"
                value={metrics.trackingError}
                format="percent"
                description="Deviation from benchmark"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
