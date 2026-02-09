import { FinancialGoal, PortfolioSnapshot } from '@/types/portfolio';

interface GoalProgress {
  currentValue: number;
  targetAmount: number;
  percentComplete: number;
  remainingAmount: number;
  projectedValue: number;
  projectedDate: Date;
  isOnTrack: boolean;
  monthlyRequired: number;
  daysRemaining: number;
}

// Calculate goal progress and projections
export function calculateGoalProgress(
  goal: FinancialGoal,
  linkedAccountsValue: number
): GoalProgress {
  const now = new Date();
  const targetDate = new Date(goal.target_date);

  const currentValue = linkedAccountsValue;
  const targetAmount = goal.target_amount;
  const percentComplete = Math.min((currentValue / targetAmount) * 100, 100);
  const remainingAmount = Math.max(targetAmount - currentValue, 0);

  // Calculate months remaining
  const daysRemaining = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const monthsRemaining = daysRemaining / 30;

  // Project future value with contributions and expected return
  const monthlyReturn = (goal.expected_return / 100) / 12;
  const monthlyContribution = goal.monthly_contribution;

  let projectedValue = currentValue;
  for (let i = 0; i < monthsRemaining; i++) {
    projectedValue = projectedValue * (1 + monthlyReturn) + monthlyContribution;
  }

  // Calculate required monthly contribution to meet goal
  const monthlyRequired = calculateRequiredContribution(
    currentValue,
    targetAmount,
    monthsRemaining,
    goal.expected_return / 100
  );

  // Determine if on track
  const isOnTrack = projectedValue >= targetAmount * 0.95; // Within 5% of goal

  // Calculate when goal will be reached at current pace
  const projectedDate = calculateProjectedDate(
    currentValue,
    targetAmount,
    monthlyContribution,
    goal.expected_return / 100
  );

  return {
    currentValue,
    targetAmount,
    percentComplete,
    remainingAmount,
    projectedValue,
    projectedDate,
    isOnTrack,
    monthlyRequired,
    daysRemaining,
  };
}

// Calculate required monthly contribution to reach goal
function calculateRequiredContribution(
  currentValue: number,
  targetAmount: number,
  monthsRemaining: number,
  annualReturn: number
): number {
  if (monthsRemaining <= 0) return 0;
  if (currentValue >= targetAmount) return 0;

  const monthlyReturn = annualReturn / 12;

  // Future value of current amount
  const fvCurrent = currentValue * Math.pow(1 + monthlyReturn, monthsRemaining);

  // Amount still needed
  const amountNeeded = targetAmount - fvCurrent;

  if (amountNeeded <= 0) return 0;

  // PMT formula: PMT = FV * r / ((1 + r)^n - 1)
  if (monthlyReturn === 0) {
    return amountNeeded / monthsRemaining;
  }

  const pmt = amountNeeded * monthlyReturn / (Math.pow(1 + monthlyReturn, monthsRemaining) - 1);
  return Math.max(0, pmt);
}

// Calculate when goal will be reached at current pace
function calculateProjectedDate(
  currentValue: number,
  targetAmount: number,
  monthlyContribution: number,
  annualReturn: number
): Date {
  if (currentValue >= targetAmount) {
    return new Date();
  }

  const monthlyReturn = annualReturn / 12;
  let value = currentValue;
  let months = 0;
  const maxMonths = 600; // 50 years max

  while (value < targetAmount && months < maxMonths) {
    value = value * (1 + monthlyReturn) + monthlyContribution;
    months++;
  }

  const projectedDate = new Date();
  projectedDate.setMonth(projectedDate.getMonth() + months);
  return projectedDate;
}

// Calculate portfolio value history from snapshots
export function calculatePortfolioHistory(
  snapshots: PortfolioSnapshot[]
): { date: string; value: number; change: number; changePercent: number }[] {
  if (snapshots.length === 0) return [];

  // Sort by date ascending
  const sorted = [...snapshots].sort((a, b) =>
    new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  return sorted.map((snapshot, index) => {
    const prevSnapshot = index > 0 ? sorted[index - 1] : null;
    const change = prevSnapshot ? snapshot.total_value - prevSnapshot.total_value : 0;
    const changePercent = prevSnapshot && prevSnapshot.total_value > 0
      ? (change / prevSnapshot.total_value) * 100
      : 0;

    return {
      date: snapshot.snapshot_date,
      value: snapshot.total_value,
      change,
      changePercent,
    };
  });
}

