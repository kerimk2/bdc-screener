'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowRight,
  Briefcase,
  Target,
} from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/portfolio/ui/card';
import { StatsCard } from '@/components/portfolio/ui/stats-card';
import { Loading } from '@/components/portfolio/ui/loading';
import { AllocationChart } from '@/components/portfolio/charts/allocation-chart';
import {
  calculatePortfolioSummary,
  calculateSectorAllocation,
  calculateAssetTypeAllocation,
} from '@/lib/portfolio/calculations';
import { calculateGoalProgress } from '@/lib/portfolio/goal-projections';
import { getFinancialGoals, getGoalAccounts } from '@/lib/portfolio/supabase';
import { useFormatCurrency, useBlinding } from '@/components/portfolio/providers/blinding-provider';
import { cn } from '@/lib/portfolio/utils';
import type { FinancialGoal, GoalAccount } from '@/types/portfolio';

export default function Dashboard() {
  const { enrichedPositions, accounts, loading } = useData();
  const formatCurrency = useFormatCurrency();
  const { isBlinded } = useBlinding();

  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [goalAccounts, setGoalAccounts] = useState<GoalAccount[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);

  const totalCashBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + (a.cash_balance || 0), 0),
    [accounts]
  );

  const totalValue = useMemo(
    () => enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0) + totalCashBalance,
    [enrichedPositions, totalCashBalance]
  );

  // Load goals
  const loadGoals = useCallback(async () => {
    try {
      const [goalsData, goalAccountsData] = await Promise.all([
        getFinancialGoals(),
        getGoalAccounts(),
      ]);
      setGoals(goalsData || []);
      setGoalAccounts(goalAccountsData || []);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Calculate value for a goal based on linked accounts
  const getGoalValue = useCallback((goalId: string): number => {
    const linkedAccountIds = goalAccounts
      .filter((ga) => ga.goal_id === goalId)
      .map((ga) => ga.account_id);

    if (linkedAccountIds.length === 0) {
      return totalValue;
    }

    const linkedPositionsValue = enrichedPositions
      .filter((p) => linkedAccountIds.includes(p.account_id))
      .reduce((sum, p) => sum + p.marketValue, 0);

    const linkedCashValue = accounts
      .filter((a) => linkedAccountIds.includes(a.id))
      .reduce((sum, a) => sum + a.cash_balance, 0);

    return linkedPositionsValue + linkedCashValue;
  }, [goalAccounts, enrichedPositions, accounts, totalValue]);

  const summary = useMemo(
    () => calculatePortfolioSummary(enrichedPositions, totalCashBalance),
    [enrichedPositions, totalCashBalance]
  );

  const sectorAllocation = useMemo(
    () => calculateSectorAllocation(enrichedPositions, totalCashBalance),
    [enrichedPositions, totalCashBalance]
  );

  const assetTypeAllocation = useMemo(
    () => calculateAssetTypeAllocation(enrichedPositions, totalCashBalance),
    [enrichedPositions, totalCashBalance]
  );

  const topGainers = useMemo(
    () =>
      [...enrichedPositions]
        .sort((a, b) => b.totalReturnPercent - a.totalReturnPercent)
        .slice(0, 5),
    [enrichedPositions]
  );

  const topLosers = useMemo(
    () =>
      [...enrichedPositions]
        .sort((a, b) => a.totalReturnPercent - b.totalReturnPercent)
        .slice(0, 5),
    [enrichedPositions]
  );

  // Calculate total return including DRIP
  const totalReturn = useMemo(() => {
    const total = enrichedPositions.reduce((sum, p) => sum + p.totalReturn, 0);
    const totalCost = enrichedPositions.reduce((sum, p) => sum + p.cost_basis, 0);
    const percent = totalCost > 0 ? (total / totalCost) * 100 : 0;
    return { total, percent };
  }, [enrichedPositions]);

  if (loading) {
    return <Loading message="Loading portfolio..." />;
  }

  const hasPositions = enrichedPositions.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your portfolio performance
        </p>
      </div>

      {!hasPositions ? (
        /* Empty State */
        <Card className="py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            No positions yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Get started by adding your first account and positions.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/accounts"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Account
            </Link>
            <Link
              href="/positions"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Add Position
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Value"
              value={formatCurrency(summary.totalValue)}
              change={summary.dayChangePercent}
              changeLabel="today"
              icon={<DollarSign className="h-5 w-5" />}
            />
            <StatsCard
              title="Total Return"
              value={formatCurrency(totalReturn.total)}
              change={totalReturn.percent}
              icon={
                totalReturn.total >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )
              }
            />
            <StatsCard
              title="Day Change"
              value={formatCurrency(summary.dayChange)}
              change={summary.dayChangePercent}
              icon={
                summary.dayChange >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )
              }
            />
            <StatsCard
              title="Positions"
              value={summary.positionCount.toString()}
              changeLabel={`across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
              icon={<PieChart className="h-5 w-5" />}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Sector Allocation */}
            <Card>
              <CardHeader>
                <CardTitle>Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart
                  data={sectorAllocation.map(s => ({
                    name: s.sector,
                    value: s.value,
                    weight: s.weight,
                  }))}
                  type="sector"
                />
              </CardContent>
            </Card>

            {/* Asset Type Allocation */}
            <Card>
              <CardHeader>
                <CardTitle>Asset Type Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart
                  data={assetTypeAllocation.map(a => ({
                    name: a.assetType.charAt(0).toUpperCase() + a.assetType.slice(1),
                    value: a.value,
                    weight: a.weight,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          {/* Top Movers */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Top Gainers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="h-4 w-4 text-green-500 sm:h-5 sm:w-5" />
                  Top Gainers
                </CardTitle>
                <Link
                  href="/positions"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 sm:text-sm"
                >
                  View all <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 sm:space-y-3">
                  {topGainers.map(position => (
                    <div
                      key={position.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800 sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {position.symbol}
                        </p>
                        <p className="hidden truncate text-xs text-gray-500 dark:text-gray-400 sm:block">
                          {position.metadata?.name || position.symbol}
                        </p>
                      </div>
                      <div className="ml-3 text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(position.marketValue)}
                        </p>
                        <p className="text-xs font-medium text-green-500 sm:text-sm">
                          +{position.totalReturnPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {topGainers.length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      No positions yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Losers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingDown className="h-4 w-4 text-red-500 sm:h-5 sm:w-5" />
                  Top Losers
                </CardTitle>
                <Link
                  href="/positions"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 sm:text-sm"
                >
                  View all <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 sm:space-y-3">
                  {topLosers.filter(p => p.totalReturnPercent < 0).map(position => (
                    <div
                      key={position.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800 sm:px-4 sm:py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {position.symbol}
                        </p>
                        <p className="hidden truncate text-xs text-gray-500 dark:text-gray-400 sm:block">
                          {position.metadata?.name || position.symbol}
                        </p>
                      </div>
                      <div className="ml-3 text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(position.marketValue)}
                        </p>
                        <p className="text-xs font-medium text-red-500 sm:text-sm">
                          {position.totalReturnPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                  {topLosers.filter(p => p.totalReturnPercent < 0).length === 0 && (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      No losing positions
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Goals */}
          {!goalsLoading && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Target className="h-4 w-4 text-blue-500 sm:h-5 sm:w-5" />
                  Financial Goals
                </CardTitle>
                <Link
                  href="/goals"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 sm:text-sm"
                >
                  {goals.length > 0 ? 'Manage' : 'Set Goals'} <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                {goals.length === 0 ? (
                  <div className="py-6 text-center">
                    <Target className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      Set financial goals to track your progress toward retirement, savings, or other targets.
                    </p>
                    <Link
                      href="/goals"
                      className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Create your first goal <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.slice(0, 3).map((goal) => {
                      const linkedValue = getGoalValue(goal.id);
                      const progress = calculateGoalProgress(goal, linkedValue);
                      const yearsToGo = progress.daysRemaining / 365;
                      const timeLabel = yearsToGo >= 1
                        ? `${yearsToGo.toFixed(1)}y left`
                        : `${Math.ceil(progress.daysRemaining / 30)}mo left`;

                      return (
                        <div
                          key={goal.id}
                          className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800 sm:p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: goal.color }}
                              />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {goal.name}
                              </span>
                            </div>
                            <span
                              className={cn(
                                'text-xs font-medium px-2 py-0.5 rounded-full',
                                progress.isOnTrack
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              )}
                            >
                              {progress.isOnTrack ? 'On Track' : 'Behind'}
                            </span>
                          </div>
                          <div className="mb-2">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(progress.percentComplete, 100)}%`,
                                  backgroundColor: goal.color,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              {isBlinded ? '•••••' : formatCurrency(progress.currentValue)} of{' '}
                              {isBlinded ? '•••••' : formatCurrency(progress.targetAmount)}
                            </span>
                            <span>{progress.percentComplete.toFixed(0)}% • {timeLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                    {goals.length > 3 && (
                      <Link
                        href="/goals"
                        className="block text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        +{goals.length - 3} more goal{goals.length - 3 > 1 ? 's' : ''}
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Holdings Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Holdings</CardTitle>
              <Link
                href="/positions"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 sm:text-sm"
              >
                Manage <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </Link>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="whitespace-nowrap pb-3 pr-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                          Symbol
                        </th>
                        <th className="whitespace-nowrap pb-3 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                          Shares
                        </th>
                        <th className="whitespace-nowrap pb-3 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                          Price
                        </th>
                        <th className="whitespace-nowrap pb-3 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                          Value
                        </th>
                        <th className="hidden whitespace-nowrap pb-3 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 sm:table-cell sm:text-sm">
                          Cost Basis
                        </th>
                        <th className="whitespace-nowrap pb-3 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                          Return
                        </th>
                        <th className="hidden whitespace-nowrap pb-3 pl-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 md:table-cell sm:text-sm">
                          Weight
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrichedPositions.slice(0, 10).map(position => (
                        <tr
                          key={position.id}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="whitespace-nowrap py-3 pr-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {position.symbol}
                              </p>
                              <p className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">
                                {position.metadata?.name || ''}
                              </p>
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-3 px-2 text-right text-sm text-gray-900 dark:text-white">
                            <div>
                              {position.dripShares !== position.shares ? (
                                <>
                                  <span>{position.dripShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                  <p className="text-[10px] text-green-600 dark:text-green-400">
                                    +{(position.dripShares - position.shares).toFixed(2)} DRIP
                                  </p>
                                </>
                              ) : (
                                position.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-3 px-2 text-right text-sm text-gray-900 dark:text-white">
                            {formatCurrency(position.currentPrice)}
                          </td>
                          <td className="whitespace-nowrap py-3 px-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(position.marketValue)}
                          </td>
                          <td className="hidden whitespace-nowrap py-3 px-2 text-right text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                            {formatCurrency(position.cost_basis)}
                          </td>
                          <td className="whitespace-nowrap py-3 px-2 text-right">
                            <span
                              className={cn(
                                'text-sm font-medium',
                                position.totalReturn >= 0
                                  ? 'text-green-500'
                                  : 'text-red-500'
                              )}
                            >
                              {position.totalReturn >= 0 ? '+' : ''}
                              {position.totalReturnPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="hidden whitespace-nowrap py-3 pl-2 text-right text-sm text-gray-900 dark:text-white md:table-cell">
                            {position.weight.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
