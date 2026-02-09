'use client';

import { useState } from 'react';
import { Plus, Trash2, Eye, TrendingUp, TrendingDown, ListPlus } from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardContent } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Input } from '@/components/portfolio/ui/input';
import { Modal } from '@/components/portfolio/ui/modal';
import { Loading } from '@/components/portfolio/ui/loading';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import { cn } from '@/lib/portfolio/utils';

export default function WatchlistPage() {
  const { watchlist, quotes, loading, addToWatchlist, removeFromWatchlist } = useData();
  const formatCurrency = useFormatCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkSymbols, setBulkSymbols] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ added: number; total: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;

    setIsSubmitting(true);
    try {
      await addToWatchlist({
        symbol: newSymbol.toUpperCase(),
        target_price: targetPrice ? parseFloat(targetPrice) : null,
        notes: notes || null,
      });
      setIsModalOpen(false);
      setNewSymbol('');
      setTargetPrice('');
      setNotes('');
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkSymbols.trim()) return;

    // Parse symbols: split by comma, space, newline, or semicolon
    const symbols = bulkSymbols
      .split(/[\s,;\n]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0 && /^[A-Z0-9.-]+$/.test(s));

    // Remove duplicates and existing watchlist items
    const existingSymbols = new Set(watchlist.map(w => w.symbol.toUpperCase()));
    const uniqueSymbols = [...new Set(symbols)].filter(s => !existingSymbols.has(s));

    if (uniqueSymbols.length === 0) {
      alert('No new symbols to add. They may already be in your watchlist.');
      return;
    }

    setIsSubmitting(true);
    setBulkProgress({ added: 0, total: uniqueSymbols.length });

    try {
      for (let i = 0; i < uniqueSymbols.length; i++) {
        await addToWatchlist({
          symbol: uniqueSymbols[i],
          target_price: null,
          notes: null,
        });
        setBulkProgress({ added: i + 1, total: uniqueSymbols.length });
      }
      setIsBulkModalOpen(false);
      setBulkSymbols('');
    } catch (error) {
      console.error('Error bulk adding to watchlist:', error);
    } finally {
      setIsSubmitting(false);
      setBulkProgress(null);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeFromWatchlist(id);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  if (loading) {
    return <Loading message="Loading watchlist..." />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Watchlist
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Track stocks you&apos;re interested in
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkModalOpen(true)}>
            <ListPlus className="mr-2 h-4 w-4" />
            Bulk Add
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Symbol
          </Button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Eye className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Your watchlist is empty
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Add symbols to track stocks you&apos;re interested in.
          </p>
          <Button className="mt-6" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Symbol
          </Button>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      Symbol
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Price
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Change
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Target
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                      Notes
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map(item => {
                    const quote = quotes.get(item.symbol.toUpperCase());
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-4">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {item.symbol}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {quote?.name || ''}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 text-right text-gray-900 dark:text-white">
                          {quote ? formatCurrency(quote.price) : '-'}
                        </td>
                        <td className="py-4 text-right">
                          {quote ? (
                            <div className="flex items-center justify-end gap-1">
                              {quote.change >= 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span
                                className={cn(
                                  'font-medium',
                                  quote.change >= 0 ? 'text-green-500' : 'text-red-500'
                                )}
                              >
                                {quote.changesPercentage >= 0 ? '+' : ''}
                                {quote.changesPercentage.toFixed(2)}%
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-4 text-right text-gray-900 dark:text-white">
                          {item.target_price ? formatCurrency(item.target_price) : '-'}
                        </td>
                        <td className="py-4 text-gray-500 dark:text-gray-400">
                          {item.notes || '-'}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add to Watchlist"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Symbol"
            placeholder="e.g., AAPL"
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            required
          />
          <Input
            label="Target Price (optional)"
            type="number"
            step="any"
            placeholder="150.00"
            value={targetPrice}
            onChange={e => setTargetPrice(e.target.value)}
          />
          <Input
            label="Notes (optional)"
            placeholder="Any notes..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
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
              {isSubmitting ? 'Adding...' : 'Add to Watchlist'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => !isSubmitting && setIsBulkModalOpen(false)}
        title="Bulk Add to Watchlist"
      >
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Symbols
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              rows={5}
              placeholder="Enter symbols separated by commas, spaces, or new lines:&#10;AAPL, MSFT, GOOGL&#10;AMZN NVDA META&#10;TSLA"
              value={bulkSymbols}
              onChange={e => setBulkSymbols(e.target.value.toUpperCase())}
              disabled={isSubmitting}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Separate symbols with commas, spaces, or new lines. Duplicates and existing watchlist items will be skipped.
            </p>
          </div>
          {bulkProgress && (
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">
                  Adding symbols...
                </span>
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {bulkProgress.added} / {bulkProgress.total}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${(bulkProgress.added / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !bulkSymbols.trim()}>
              {isSubmitting ? 'Adding...' : 'Add All'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
