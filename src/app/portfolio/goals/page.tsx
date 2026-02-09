'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Target, Camera, TrendingUp } from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Loading } from '@/components/portfolio/ui/loading';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import { GoalProgressCard } from '@/components/portfolio/goals/goal-progress-card';
import { GoalFormModal } from '@/components/portfolio/goals/goal-form-modal';
import { PortfolioHistoryChart } from '@/components/portfolio/goals/portfolio-history-chart';
import {
  getFinancialGoals,
  createFinancialGoal,
  updateFinancialGoal,
  deleteFinancialGoal,
  getGoalAccounts,
  linkAccountToGoal,
  unlinkAccountFromGoal,
  getPortfolioSnapshots,
  createPortfolioSnapshot,
} from '@/lib/portfolio/supabase';
import { calculateSectorAllocation } from '@/lib/portfolio/calculations';
import type { FinancialGoal, PortfolioSnapshot, GoalAccount } from '@/types/portfolio';

export default function GoalsPage() {
  const { accounts, enrichedPositions, loading: dataLoading } = useData();
  const formatCurrency = useFormatCurrency();

  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [goalAccounts, setGoalAccounts] = useState<GoalAccount[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [takingSnapshot, setTakingSnapshot] = useState(false);

  const totalValue = enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCash = accounts.reduce((sum, a) => sum + a.cash_balance, 0);

  // Load goals and snapshots
  const loadData = useCallback(async () => {
    try {
      const [goalsData, goalAccountsData, snapshotsData] = await Promise.all([
        getFinancialGoals(),
        getGoalAccounts(),
        getPortfolioSnapshots({ limit: 365 }),
      ]);
      setGoals(goalsData || []);
      setGoalAccounts(goalAccountsData || []);
      setSnapshots(snapshotsData || []);
    } catch (error) {
      console.error('Error loading goals data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate value for a goal based on linked accounts
  const getGoalValue = (goalId: string): number => {
    const linkedAccountIds = goalAccounts
      .filter((ga) => ga.goal_id === goalId)
      .map((ga) => ga.account_id);

    if (linkedAccountIds.length === 0) {
      return totalValue + totalCash;
    }

    const linkedPositionsValue = enrichedPositions
      .filter((p) => linkedAccountIds.includes(p.account_id))
      .reduce((sum, p) => sum + p.marketValue, 0);

    const linkedCashValue = accounts
      .filter((a) => linkedAccountIds.includes(a.id))
      .reduce((sum, a) => sum + a.cash_balance, 0);

    return linkedPositionsValue + linkedCashValue;
  };

  // Get linked account IDs for a goal
  const getLinkedAccountIds = (goalId: string): string[] => {
    return goalAccounts.filter((ga) => ga.goal_id === goalId).map((ga) => ga.account_id);
  };

  // Save goal
  const handleSaveGoal = async (
    goalData: Partial<FinancialGoal>,
    linkedAccountIds: string[]
  ) => {
    if (editingGoal) {
      // Update existing goal
      await updateFinancialGoal(editingGoal.id, goalData);

      // Update linked accounts
      const currentLinks = goalAccounts.filter((ga) => ga.goal_id === editingGoal.id);
      const currentAccountIds = currentLinks.map((ga) => ga.account_id);

      // Remove unlinked accounts
      for (const accountId of currentAccountIds) {
        if (!linkedAccountIds.includes(accountId)) {
          await unlinkAccountFromGoal(editingGoal.id, accountId);
        }
      }

      // Add new links
      for (const accountId of linkedAccountIds) {
        if (!currentAccountIds.includes(accountId)) {
          await linkAccountToGoal(editingGoal.id, accountId);
        }
      }
    } else {
      // Create new goal
      const newGoal = await createFinancialGoal(goalData as {
        name: string;
        target_amount: number;
        target_date: string;
      });

      // Link accounts
      for (const accountId of linkedAccountIds) {
        await linkAccountToGoal(newGoal.id, accountId);
      }
    }

    await loadData();
    setEditingGoal(null);
  };

  // Delete goal
  const handleDeleteGoal = async () => {
    if (editingGoal) {
      await deleteFinancialGoal(editingGoal.id);
      await loadData();
      setEditingGoal(null);
      setIsModalOpen(false);
    }
  };

  // Take snapshot
  const handleTakeSnapshot = async () => {
    setTakingSnapshot(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const dayChange = enrichedPositions.reduce((sum, p) => sum + p.dayChange, 0);
      const sectorAllocation = calculateSectorAllocation(enrichedPositions);

      await createPortfolioSnapshot({
        snapshot_date: today,
        total_value: totalValue + totalCash,
        cash_balance: totalCash,
        positions_data: enrichedPositions.map((p) => ({
          symbol: p.symbol,
          shares: p.shares,
          value: p.marketValue,
        })),
        sector_allocation: sectorAllocation.map((s) => ({
          sector: s.sector,
          weight: s.weight,
        })),
        daily_change: (dayChange / (totalValue || 1)) * 100,
      });

      await loadData();
    } catch (error) {
      console.error('Error taking snapshot:', error);
    } finally {
      setTakingSnapshot(false);
    }
  };

  if (loading || dataLoading) {
    return <Loading message="Loading goals..." />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Goals</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Set savings targets (retirement, house, education) and track your progress over time
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleTakeSnapshot}
            disabled={takingSnapshot || enrichedPositions.length === 0}
            title="Save today's portfolio value to track history"
          >
            <Camera className="mr-2 h-4 w-4" />
            {takingSnapshot ? 'Saving...' : 'Take Snapshot'}
          </Button>
          <Button onClick={() => {
            setEditingGoal(null);
            setIsModalOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Goals</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {goals.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Portfolio</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(totalValue + totalCash)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                <Camera className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Snapshots</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {snapshots.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Set Your Financial Goals
          </h3>
          <p className="mt-2 max-w-md mx-auto text-gray-500 dark:text-gray-400">
            Create goals like &quot;Retirement Fund&quot;, &quot;House Down Payment&quot;, or &quot;College Savings&quot;
            with target amounts and dates. Link specific accounts to each goal and track your progress over time.
          </p>
          <div className="mt-4 text-sm text-gray-400 dark:text-gray-500 space-y-1">
            <p>• Set target amounts and deadlines</p>
            <p>• Link specific accounts to each goal</p>
            <p>• Take snapshots to build portfolio history</p>
          </div>
          <Button className="mt-6" onClick={() => {
            setEditingGoal(null);
            setIsModalOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Goal
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalProgressCard
              key={goal.id}
              goal={goal}
              linkedAccountsValue={getGoalValue(goal.id)}
              onEdit={() => {
                setEditingGoal(goal);
                setIsModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Portfolio History */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio History</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="py-8 text-center">
              <Camera className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                No snapshots yet. Click &quot;Take Snapshot&quot; to save today&apos;s portfolio value.
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Take snapshots regularly to track your portfolio growth over time.
              </p>
            </div>
          ) : (
            <>
              <PortfolioHistoryChart snapshots={snapshots} height={300} />
              <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {snapshots.length} snapshot{snapshots.length > 1 ? 's' : ''}{' '}
                {snapshots.length > 1 && (
                  <>
                    from {new Date(snapshots[snapshots.length - 1].snapshot_date).toLocaleDateString()} to{' '}
                    {new Date(snapshots[0].snapshot_date).toLocaleDateString()}
                  </>
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Goal Form Modal */}
      <GoalFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        onDelete={editingGoal ? handleDeleteGoal : undefined}
        goal={editingGoal}
        accounts={accounts}
        linkedAccountIds={editingGoal ? getLinkedAccountIds(editingGoal.id) : []}
      />
    </div>
  );
}
