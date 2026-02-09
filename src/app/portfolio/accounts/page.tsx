'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardContent } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Input } from '@/components/portfolio/ui/input';
import { Select } from '@/components/portfolio/ui/select';
import { Modal } from '@/components/portfolio/ui/modal';
import { Loading } from '@/components/portfolio/ui/loading';
import { getAccountTypeLabel } from '@/lib/portfolio/utils';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import type { Account } from '@/types/portfolio';

const accountTypes = [
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'ira', label: 'IRA' },
  { value: 'roth_ira', label: 'Roth IRA' },
  { value: '401k', label: '401(k)' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
];

export default function AccountsPage() {
  const {
    accounts,
    enrichedPositions,
    loading,
    createAccount,
    updateAccount,
    deleteAccount,
  } = useData();
  const formatCurrency = useFormatCurrency();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'brokerage', cash_balance: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData({ name: '', type: 'brokerage', cash_balance: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      cash_balance: account.cash_balance ? account.cash_balance.toString() : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const accountData = {
        name: formData.name,
        type: formData.type,
        cash_balance: formData.cash_balance ? parseFloat(formData.cash_balance) : 0,
      };
      if (editingAccount) {
        await updateAccount(editingAccount.id, accountData);
      } else {
        await createAccount(accountData);
      }
      setIsModalOpen(false);
      setFormData({ name: '', type: 'brokerage', cash_balance: '' });
      setEditingAccount(null);
    } catch (error) {
      console.error('Error saving account:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  const getAccountValue = (accountId: string) => {
    return enrichedPositions
      .filter(p => p.account_id === accountId)
      .reduce((sum, p) => sum + p.marketValue, 0);
  };

  const getAccountPositionCount = (accountId: string) => {
    return enrichedPositions.filter(p => p.account_id === accountId).length;
  };

  if (loading) {
    return <Loading message="Loading accounts..." />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Accounts
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage your brokerage and investment accounts
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            No accounts yet
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Create your first account to start tracking positions.
          </p>
          <Button className="mt-6" onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(account => {
            const value = getAccountValue(account.id);
            const positionCount = getAccountPositionCount(account.id);

            return (
              <Card key={account.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {account.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {getAccountTypeLabel(account.type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(account)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Invested
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Cash
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(account.cash_balance || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Total
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(value + (account.cash_balance || 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Account Name"
            placeholder="e.g., Fidelity IRA"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
          <Select
            label="Account Type"
            options={accountTypes}
            value={formData.type}
            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
          />
          <Input
            label="Cash Balance"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.cash_balance}
            onChange={e => setFormData(prev => ({ ...prev, cash_balance: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Account"
        size="sm"
      >
        <p className="text-gray-600 dark:text-gray-300">
          Are you sure you want to delete this account? All positions in this
          account will also be deleted. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            Delete Account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
