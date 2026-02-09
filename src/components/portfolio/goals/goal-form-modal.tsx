'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/portfolio/ui/modal';
import { Button } from '@/components/portfolio/ui/button';
import { Input, Textarea } from '@/components/portfolio/ui/input';
import type { FinancialGoal, Account } from '@/types/portfolio';

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Partial<FinancialGoal>, linkedAccountIds: string[]) => Promise<void>;
  onDelete?: () => Promise<void>;
  goal?: FinancialGoal | null;
  accounts: Account[];
  linkedAccountIds?: string[];
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export function GoalFormModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  goal,
  accounts,
  linkedAccountIds = [],
}: GoalFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    target_date: '',
    initial_amount: '0',
    monthly_contribution: '0',
    expected_return: '7',
    notes: '',
    color: COLORS[0],
  });
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setFormData({
        name: goal.name,
        target_amount: goal.target_amount.toString(),
        target_date: goal.target_date,
        initial_amount: goal.initial_amount.toString(),
        monthly_contribution: goal.monthly_contribution.toString(),
        expected_return: goal.expected_return.toString(),
        notes: goal.notes || '',
        color: goal.color,
      });
      setSelectedAccounts(linkedAccountIds);
    } else {
      setFormData({
        name: '',
        target_amount: '',
        target_date: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        initial_amount: '0',
        monthly_contribution: '0',
        expected_return: '7',
        notes: '',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
      setSelectedAccounts([]);
    }
    setError(null);
  }, [goal, linkedAccountIds, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.target_amount || !formData.target_date) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(
        {
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          target_date: formData.target_date,
          initial_amount: parseFloat(formData.initial_amount) || 0,
          monthly_contribution: parseFloat(formData.monthly_contribution) || 0,
          expected_return: parseFloat(formData.expected_return) || 7,
          notes: formData.notes || null,
          color: formData.color,
        },
        selectedAccounts
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goal ? 'Edit Goal' : 'Create New Goal'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Goal Name"
          placeholder="e.g., Retirement, House Down Payment"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Target Amount"
            type="number"
            step="1000"
            placeholder="100000"
            value={formData.target_amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, target_amount: e.target.value }))}
            required
          />
          <Input
            label="Target Date"
            type="date"
            value={formData.target_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, target_date: e.target.value }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monthly Contribution"
            type="number"
            step="100"
            placeholder="500"
            value={formData.monthly_contribution}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, monthly_contribution: e.target.value }))
            }
          />
          <Input
            label="Expected Return (%)"
            type="number"
            step="0.5"
            placeholder="7"
            value={formData.expected_return}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, expected_return: e.target.value }))
            }
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Color
          </label>
          <div className="flex gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, color }))}
                className={`h-8 w-8 rounded-full transition-transform ${
                  formData.color === color ? 'scale-110 ring-2 ring-offset-2' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Link Accounts */}
        {accounts.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Link Accounts (optional)
            </label>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Track progress using the value of linked accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggleAccount(account.id)}
                  className={`rounded-lg border p-2 text-left text-sm transition-colors ${
                    selectedAccounts.includes(account.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}
                >
                  {account.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Textarea
          label="Notes (optional)"
          placeholder="Any notes about this goal..."
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={2}
        />

        <div className="flex justify-between gap-3 pt-4">
          <div>
            {goal && onDelete && (
              <Button type="button" variant="danger" onClick={onDelete}>
                Delete Goal
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : goal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
