'use client';

import { Target, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/portfolio/ui/card';
import { useFormatCurrency, useBlinding } from '@/components/portfolio/providers/blinding-provider';
import { calculateGoalProgress } from '@/lib/portfolio/goal-projections';
import type { FinancialGoal } from '@/types/portfolio';

interface GoalProgressCardProps {
  goal: FinancialGoal;
  linkedAccountsValue: number;
  onEdit: () => void;
}

export function GoalProgressCard({ goal, linkedAccountsValue, onEdit }: GoalProgressCardProps) {
  const formatCurrency = useFormatCurrency();
  const { isBlinded } = useBlinding();

  const progress = calculateGoalProgress(goal, linkedAccountsValue);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const yearsToGo = progress.daysRemaining / 365;
  const timeLabel = yearsToGo >= 1
    ? `${yearsToGo.toFixed(1)} years left`
    : `${Math.ceil(progress.daysRemaining / 30)} months left`;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-lg"
      onClick={onEdit}
    >
      <CardContent className="pt-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg p-2"
              style={{ backgroundColor: `${goal.color}20` }}
            >
              <Target className="h-5 w-5" style={{ color: goal.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Target: {new Date(goal.target_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              progress.isOnTrack
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
          >
            {progress.isOnTrack ? 'On Track' : 'Behind'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Progress</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {progress.percentComplete.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(progress.percentComplete, 100)}%`,
                backgroundColor: goal.color,
              }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <DollarSign className="h-3 w-3" />
              Current
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {isBlinded ? '•••••' : formatCurrency(progress.currentValue)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Target className="h-3 w-3" />
              Target
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {isBlinded ? '•••••' : formatCurrency(progress.targetAmount)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <TrendingUp className="h-3 w-3" />
              Projected
            </div>
            <p className={`font-semibold ${
              progress.projectedValue >= progress.targetAmount
                ? 'text-green-600 dark:text-green-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              {isBlinded ? '•••••' : formatCurrency(progress.projectedValue)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="h-3 w-3" />
              Time
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">{timeLabel}</p>
          </div>
        </div>

        {/* Monthly Contribution Note */}
        {goal.monthly_contribution > 0 && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Contributing {isBlinded ? '•••••' : formatCurrency(goal.monthly_contribution)}/month at {goal.expected_return}% expected return
          </p>
        )}

        {/* Need to increase contributions */}
        {!progress.isOnTrack && progress.monthlyRequired > goal.monthly_contribution && (
          <div className="mt-4 rounded-lg bg-yellow-50 p-2 dark:bg-yellow-900/20">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Need {isBlinded ? '•••••' : formatCurrency(progress.monthlyRequired)}/month to reach goal on time
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
