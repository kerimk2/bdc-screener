'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  X,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Banknote,
  Receipt,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/portfolio/ui/card';
import { cn } from '@/lib/portfolio/utils';
import {
  getTrades,
  createTrade,
  updateTrade,
  deleteTrade,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
} from '@/lib/portfolio/supabase';
import { useData } from '@/components/portfolio/providers/data-provider';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import type { Transaction, TransactionType, TransactionSummary } from '@/types/portfolio';

interface Trade {
  id: string;
  symbol: string;
  action: string;
  shares: number;
  price: number;
  trade_date: string;
  position_id: string | null;
  thesis: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TradeStats {
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  totalBuyValue: number;
  totalSellValue: number;
  uniqueSymbols: number;
  recentTrades: number;
}

const EMPTY_TRADE_FORM = {
  symbol: '',
  action: 'buy' as string,
  shares: '',
  price: '',
  trade_date: new Date().toISOString().split('T')[0],
  thesis: '',
  notes: '',
};

const EMPTY_TRANSACTION_FORM = {
  type: 'dividend' as TransactionType,
  symbol: '',
  account_id: '',
  shares: '',
  price_per_share: '',
  total_amount: '',
  fees: '',
  cost_basis: '',
  transaction_date: new Date().toISOString().split('T')[0],
  description: '',
  notes: '',
};

const TRANSACTION_TYPES: { value: TransactionType; label: string; icon: typeof DollarSign }[] = [
  { value: 'dividend', label: 'Dividend', icon: DollarSign },
  { value: 'drip', label: 'DRIP Reinvestment', icon: RefreshCw },
  { value: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
  { value: 'withdrawal', label: 'Withdrawal', icon: ArrowUpFromLine },
  { value: 'fee', label: 'Fee', icon: Receipt },
  { value: 'interest', label: 'Interest', icon: Banknote },
  { value: 'buy', label: 'Buy', icon: TrendingUp },
  { value: 'sell', label: 'Sell', icon: TrendingDown },
];

function calculateTradeStats(trades: Trade[]): TradeStats {
  const buys = trades.filter((t) => t.action === 'buy');
  const sells = trades.filter((t) => t.action === 'sell');
  const symbols = new Set(trades.map((t) => t.symbol));
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = trades.filter((t) => new Date(t.trade_date) >= thirtyDaysAgo);

  return {
    totalTrades: trades.length,
    buyCount: buys.length,
    sellCount: sells.length,
    totalBuyValue: buys.reduce((sum, t) => sum + t.shares * t.price, 0),
    totalSellValue: sells.reduce((sum, t) => sum + t.shares * t.price, 0),
    uniqueSymbols: symbols.size,
    recentTrades: recent.length,
  };
}

function getTransactionIcon(type: TransactionType) {
  const config = TRANSACTION_TYPES.find((t) => t.value === type);
  return config?.icon || DollarSign;
}

function getTransactionColor(type: TransactionType) {
  switch (type) {
    case 'buy':
    case 'drip':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'sell':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    case 'dividend':
    case 'interest':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'deposit':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    case 'withdrawal':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
    case 'fee':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function JournalPage() {
  const { positions, accounts } = useData();
  const formatCurrency = useFormatCurrency();

  // Tab state
  const [activeTab, setActiveTab] = useState<'trades' | 'transactions'>('trades');

  // Trades state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState(EMPTY_TRADE_FORM);

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionForm, setTransactionForm] = useState(EMPTY_TRANSACTION_FORM);

  // Shared state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [sortField, setSortField] = useState<string>('trade_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      const data = await getTrades();
      setTrades(data as Trade[]);
    } catch (err) {
      console.error('Error fetching trades:', err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const [data, summary] = await Promise.all([
        getTransactions(),
        getTransactionSummary(),
      ]);
      setTransactions(data as Transaction[]);
      setTransactionSummary(summary);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTrades(), fetchTransactions()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTrades, fetchTransactions]);

  // Trade handlers
  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeForm.symbol || !tradeForm.shares || !tradeForm.price) return;

    setSaving(true);
    try {
      const tradeData = {
        symbol: tradeForm.symbol.toUpperCase(),
        action: tradeForm.action,
        shares: parseFloat(tradeForm.shares),
        price: parseFloat(tradeForm.price),
        trade_date: tradeForm.trade_date,
        thesis: tradeForm.thesis || null,
        notes: tradeForm.notes || null,
      };

      if (editingTradeId) {
        await updateTrade(editingTradeId, tradeData);
      } else {
        await createTrade(tradeData);
      }

      setTradeForm(EMPTY_TRADE_FORM);
      setShowTradeForm(false);
      setEditingTradeId(null);
      await fetchTrades();
    } catch (err) {
      console.error('Error saving trade:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setTradeForm({
      symbol: trade.symbol,
      action: trade.action,
      shares: String(trade.shares),
      price: String(trade.price),
      trade_date: trade.trade_date,
      thesis: trade.thesis || '',
      notes: trade.notes || '',
    });
    setEditingTradeId(trade.id);
    setShowTradeForm(true);
  };

  const handleDeleteTrade = async (id: string) => {
    try {
      await deleteTrade(id);
      setDeleteConfirmId(null);
      await fetchTrades();
    } catch (err) {
      console.error('Error deleting trade:', err);
    }
  };

  // Transaction handlers
  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionForm.total_amount && !transactionForm.shares) return;

    setSaving(true);
    try {
      const needsSymbol = ['buy', 'sell', 'dividend', 'drip'].includes(transactionForm.type);
      const needsShares = ['buy', 'sell', 'drip'].includes(transactionForm.type);

      const transactionData = {
        type: transactionForm.type,
        symbol: needsSymbol ? transactionForm.symbol.toUpperCase() || null : null,
        account_id: transactionForm.account_id || null,
        shares: needsShares ? parseFloat(transactionForm.shares) || null : null,
        price_per_share: transactionForm.price_per_share ? parseFloat(transactionForm.price_per_share) : null,
        total_amount: parseFloat(transactionForm.total_amount) || 0,
        fees: parseFloat(transactionForm.fees) || 0,
        cost_basis: transactionForm.cost_basis ? parseFloat(transactionForm.cost_basis) : null,
        transaction_date: transactionForm.transaction_date,
        description: transactionForm.description || null,
        notes: transactionForm.notes || null,
      };

      // Calculate realized P/L for sells
      if (transactionForm.type === 'sell' && transactionForm.cost_basis) {
        const proceeds = transactionData.total_amount - (transactionData.fees || 0);
        const costBasis = parseFloat(transactionForm.cost_basis);
        (transactionData as { realized_pnl?: number }).realized_pnl = proceeds - costBasis;
      }

      if (editingTransactionId) {
        await updateTransaction(editingTransactionId, transactionData);
      } else {
        await createTransaction(transactionData);
      }

      setTransactionForm(EMPTY_TRANSACTION_FORM);
      setShowTransactionForm(false);
      setEditingTransactionId(null);
      await fetchTransactions();
    } catch (err) {
      console.error('Error saving transaction:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionForm({
      type: transaction.type,
      symbol: transaction.symbol || '',
      account_id: transaction.account_id || '',
      shares: transaction.shares?.toString() || '',
      price_per_share: transaction.price_per_share?.toString() || '',
      total_amount: transaction.total_amount?.toString() || '',
      fees: transaction.fees?.toString() || '',
      cost_basis: transaction.cost_basis?.toString() || '',
      transaction_date: transaction.transaction_date,
      description: transaction.description || '',
      notes: transaction.notes || '',
    });
    setEditingTransactionId(transaction.id);
    setShowTransactionForm(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      setDeleteConfirmId(null);
      await fetchTransactions();
    } catch (err) {
      console.error('Error deleting transaction:', err);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'trade_date' || field === 'transaction_date' ? 'desc' : 'asc');
    }
  };

  // Filter and sort trades
  const filteredTrades = trades
    .filter((t) => {
      if (filterSymbol && !t.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
      if (filterType && t.action !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'trade_date') {
        return dir * (new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());
      }
      if (sortField === 'shares' || sortField === 'price') {
        return dir * (a[sortField as 'shares' | 'price'] - b[sortField as 'shares' | 'price']);
      }
      return dir * a[sortField as 'symbol'].localeCompare(b[sortField as 'symbol']);
    });

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter((t) => {
      if (filterSymbol && t.symbol && !t.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
      if (filterType && t.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      return dir * (new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    });

  const tradeStats = calculateTradeStats(trades);
  const positionSymbols = [...new Set((positions || []).map((p) => p.symbol))].sort();

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trade Journal</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Track trades and portfolio activity</p>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trade Journal</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Track trades and portfolio activity</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'trades') {
              setTradeForm(EMPTY_TRADE_FORM);
              setEditingTradeId(null);
              setShowTradeForm(!showTradeForm);
              setShowTransactionForm(false);
            } else {
              setTransactionForm(EMPTY_TRANSACTION_FORM);
              setEditingTransactionId(null);
              setShowTransactionForm(!showTransactionForm);
              setShowTradeForm(false);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {(activeTab === 'trades' ? showTradeForm : showTransactionForm) ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {(activeTab === 'trades' ? showTradeForm : showTransactionForm)
            ? 'Cancel'
            : activeTab === 'trades'
            ? 'Log Trade'
            : 'Add Transaction'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('trades');
              setFilterType('');
            }}
            className={cn(
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
              activeTab === 'trades'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            Trades
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
              {trades.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('transactions');
              setFilterType('');
            }}
            className={cn(
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            )}
          >
            Transaction History
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
              {transactions.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Trade Entry Form */}
      {activeTab === 'trades' && showTradeForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTradeId ? 'Edit Trade' : 'Log New Trade'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTradeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    value={tradeForm.symbol}
                    onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    list="symbol-list"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <datalist id="symbol-list">
                    {positionSymbols.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Action *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTradeForm({ ...tradeForm, action: 'buy' })}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        tradeForm.action === 'buy'
                          ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
                      )}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeForm({ ...tradeForm, action: 'sell' })}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        tradeForm.action === 'sell'
                          ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
                      )}
                    >
                      Sell
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Trade Date *
                  </label>
                  <input
                    type="date"
                    value={tradeForm.trade_date}
                    onChange={(e) => setTradeForm({ ...tradeForm, trade_date: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Shares *
                  </label>
                  <input
                    type="number"
                    value={tradeForm.shares}
                    onChange={(e) => setTradeForm({ ...tradeForm, shares: e.target.value })}
                    placeholder="100"
                    step="any"
                    min="0"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Price per Share *
                  </label>
                  <input
                    type="number"
                    value={tradeForm.price}
                    onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })}
                    placeholder="150.00"
                    step="any"
                    min="0"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {tradeForm.shares && tradeForm.price && (
                <div className="rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Value: </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(parseFloat(tradeForm.shares) * parseFloat(tradeForm.price))}
                  </span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Thesis
                </label>
                <input
                  type="text"
                  value={tradeForm.thesis}
                  onChange={(e) => setTradeForm({ ...tradeForm, thesis: e.target.value })}
                  placeholder="Why did you make this trade?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  value={tradeForm.notes}
                  onChange={(e) => setTradeForm({ ...tradeForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTradeForm(false);
                    setEditingTradeId(null);
                    setTradeForm(EMPTY_TRADE_FORM);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingTradeId ? 'Update Trade' : 'Log Trade'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transaction Entry Form */}
      {activeTab === 'transactions' && showTransactionForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTransactionId ? 'Edit Transaction' : 'Add Transaction'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Transaction Type *
                  </label>
                  <select
                    value={transactionForm.type}
                    onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value as TransactionType })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    {TRANSACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={transactionForm.transaction_date}
                    onChange={(e) => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Account
                  </label>
                  <select
                    value={transactionForm.account_id}
                    onChange={(e) => setTransactionForm({ ...transactionForm, account_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {['buy', 'sell', 'dividend', 'drip'].includes(transactionForm.type) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Symbol {['buy', 'sell', 'drip'].includes(transactionForm.type) ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      value={transactionForm.symbol}
                      onChange={(e) => setTransactionForm({ ...transactionForm, symbol: e.target.value.toUpperCase() })}
                      placeholder="AAPL"
                      list="symbol-list-tx"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <datalist id="symbol-list-tx">
                      {positionSymbols.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  {['buy', 'sell', 'drip'].includes(transactionForm.type) && (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Shares
                        </label>
                        <input
                          type="number"
                          value={transactionForm.shares}
                          onChange={(e) => setTransactionForm({ ...transactionForm, shares: e.target.value })}
                          placeholder="100"
                          step="any"
                          min="0"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Price per Share
                        </label>
                        <input
                          type="number"
                          value={transactionForm.price_per_share}
                          onChange={(e) => setTransactionForm({ ...transactionForm, price_per_share: e.target.value })}
                          placeholder="150.00"
                          step="any"
                          min="0"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    value={transactionForm.total_amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, total_amount: e.target.value })}
                    placeholder="1500.00"
                    step="any"
                    min="0"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fees
                  </label>
                  <input
                    type="number"
                    value={transactionForm.fees}
                    onChange={(e) => setTransactionForm({ ...transactionForm, fees: e.target.value })}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {transactionForm.type === 'sell' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cost Basis (for P/L)
                    </label>
                    <input
                      type="number"
                      value={transactionForm.cost_basis}
                      onChange={(e) => setTransactionForm({ ...transactionForm, cost_basis: e.target.value })}
                      placeholder="1200.00"
                      step="any"
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {transactionForm.type === 'sell' && transactionForm.total_amount && transactionForm.cost_basis && (
                <div className="rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Realized P/L: </span>
                  {(() => {
                    const proceeds = parseFloat(transactionForm.total_amount) - (parseFloat(transactionForm.fees) || 0);
                    const pnl = proceeds - parseFloat(transactionForm.cost_basis);
                    return (
                      <span className={cn('text-sm font-semibold', pnl >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {pnl >= 0 ? '+' : ''}
                        {formatCurrency(pnl)}
                      </span>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  placeholder="Brief description..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  value={transactionForm.notes}
                  onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransactionForm(false);
                    setEditingTransactionId(null);
                    setTransactionForm(EMPTY_TRANSACTION_FORM);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingTransactionId ? 'Update' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {activeTab === 'trades' ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Trades</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{tradeStats.totalTrades}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tradeStats.recentTrades} in last 30 days
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Buys / Sells</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              <span className="text-green-600">{tradeStats.buyCount}</span>
              {' / '}
              <span className="text-red-600">{tradeStats.sellCount}</span>
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Bought</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {formatCurrency(tradeStats.totalBuyValue)}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Sold</p>
            <p className="mt-1 text-2xl font-bold text-red-600">
              {formatCurrency(tradeStats.totalSellValue)}
            </p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {transactionSummary?.transactionCount || 0}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Deposits</p>
            <p className="mt-1 text-2xl font-bold text-purple-600">
              {formatCurrency(transactionSummary?.totalDeposits || 0)}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Withdrawals</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">
              {formatCurrency(transactionSummary?.totalWithdrawals || 0)}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Dividends Received</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {formatCurrency(transactionSummary?.totalDividends || 0)}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Realized P/L</p>
            <p className={cn(
              'mt-1 text-2xl font-bold',
              (transactionSummary?.totalRealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {(transactionSummary?.totalRealizedPnL || 0) >= 0 ? '+' : ''}
              {formatCurrency(transactionSummary?.totalRealizedPnL || 0)}
            </p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            placeholder="Filter by symbol..."
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {activeTab === 'trades' ? (
            <>
              <option value="">All Actions</option>
              <option value="buy">Buys Only</option>
              <option value="sell">Sells Only</option>
            </>
          ) : (
            <>
              <option value="">All Types</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </>
          )}
        </select>
        {(filterSymbol || filterType) && (
          <button
            onClick={() => {
              setFilterSymbol('');
              setFilterType('');
            }}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {activeTab === 'trades'
            ? `${filteredTrades.length} trade${filteredTrades.length !== 1 ? 's' : ''}`
            : `${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Trades Table */}
      {activeTab === 'trades' && (
        <Card>
          <CardContent className="p-0">
            {filteredTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <BookOpen className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium">No trades logged yet</p>
                <p className="mt-1 text-xs">Click &quot;Log Trade&quot; to record your first trade</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {[
                        { key: 'trade_date', label: 'Date' },
                        { key: 'symbol', label: 'Symbol' },
                        { key: 'action', label: 'Action' },
                        { key: 'shares', label: 'Shares' },
                        { key: 'price', label: 'Price' },
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className="cursor-pointer px-4 py-3 text-left font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <span className="flex items-center gap-1">
                            {label}
                            <SortIcon field={key} />
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        Thesis
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((trade) => (
                      <tr
                        key={trade.id}
                        className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {new Date(trade.trade_date + 'T00:00:00').toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {trade.symbol}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              trade.action === 'buy'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            )}
                          >
                            {trade.action === 'buy' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {trade.action.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {Number(trade.shares).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                          {formatCurrency(trade.price)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatCurrency(trade.shares * trade.price)}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-gray-600 dark:text-gray-400">
                          {trade.thesis || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditTrade(trade)}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {deleteConfirmId === trade.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteTrade(trade.id)}
                                  className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="rounded px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(trade.id)}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      {activeTab === 'transactions' && (
        <Card>
          <CardContent className="p-0">
            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Receipt className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium">No transactions recorded yet</p>
                <p className="mt-1 text-xs">Click &quot;Add Transaction&quot; to record dividends, deposits, and more</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th
                        onClick={() => handleSort('transaction_date')}
                        className="cursor-pointer px-4 py-3 text-left font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <span className="flex items-center gap-1">
                          Date
                          <SortIcon field="transaction_date" />
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Account</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Shares</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Amount</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">P/L</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Notes</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => {
                      const Icon = getTransactionIcon(tx.type);
                      return (
                        <tr
                          key={tx.id}
                          className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                        >
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            {new Date(tx.transaction_date + 'T00:00:00').toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                getTransactionColor(tx.type)
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {tx.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {tx.symbol || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {tx.account_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                            {tx.shares ? Number(tx.shares).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(tx.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {tx.realized_pnl !== null ? (
                              <span className={cn('font-medium', tx.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600')}>
                                {tx.realized_pnl >= 0 ? '+' : ''}
                                {formatCurrency(tx.realized_pnl)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-gray-600 dark:text-gray-400">
                            {tx.notes || tx.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditTransaction(tx)}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              {deleteConfirmId === tx.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="rounded px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(tx.id)}
                                  className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
