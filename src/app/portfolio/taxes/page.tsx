'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Loading } from '@/components/portfolio/ui/loading';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import { cn } from '@/lib/portfolio/utils';
import {
  calculateTaxImplications,
  formatTaxTreatment,
  formatGainType,
  TaxablePosition,
} from '@/lib/portfolio/tax-calculations';
import {
  Shield,
  ShieldCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Scissors,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type SortField = 'symbol' | 'marketValue' | 'gainLoss' | 'gainLossPercent' | 'daysUntilLongTerm';
type SortDirection = 'asc' | 'desc';

export default function TaxesPage() {
  const { enrichedPositions, accounts, loading } = useData();
  const formatCurrency = useFormatCurrency();
  const [assumedIncome, setAssumedIncome] = useState(100000);
  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAllPositions, setShowAllPositions] = useState(false);

  const { positions: taxPositions, summary } = useMemo(
    () => calculateTaxImplications(enrichedPositions, accounts, assumedIncome),
    [enrichedPositions, accounts, assumedIncome]
  );

  // Sort positions
  const sortedPositions = useMemo(() => {
    const sorted = [...taxPositions].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'symbol':
          return sortDirection === 'asc'
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case 'marketValue':
          aVal = a.marketValue;
          bVal = b.marketValue;
          break;
        case 'gainLoss':
          aVal = a.gainLoss;
          bVal = b.gainLoss;
          break;
        case 'gainLossPercent':
          aVal = a.gainLossPercent;
          bVal = b.gainLossPercent;
          break;
        case 'daysUntilLongTerm':
          aVal = a.daysUntilLongTerm;
          bVal = b.daysUntilLongTerm;
          break;
        default:
          return 0;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [taxPositions, sortField, sortDirection]);

  // Filter to taxable positions only for the detailed view
  const taxablePositions = sortedPositions.filter(p => p.taxTreatment === 'taxable');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="inline h-4 w-4" />
    ) : (
      <ChevronDown className="inline h-4 w-4" />
    );
  };

  if (loading) {
    return <Loading message="Loading tax data..." />;
  }

  if (enrichedPositions.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Implications</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Add positions to see tax analysis
          </p>
        </div>
        <Card className="py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No positions to analyze. Add some positions first.
          </p>
        </Card>
      </div>
    );
  }

  const totalPortfolioValue = summary.taxDeferredValue + summary.taxFreeValue + summary.taxableValue;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Implications</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Understand the tax treatment of your positions and potential liabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Assumed Income:</label>
          <select
            value={assumedIncome}
            onChange={(e) => setAssumedIncome(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value={50000}>$50,000</option>
            <option value={75000}>$75,000</option>
            <option value={100000}>$100,000</option>
            <option value={150000}>$150,000</option>
            <option value={200000}>$200,000</option>
            <option value={300000}>$300,000</option>
            <option value={500000}>$500,000</option>
          </select>
        </div>
      </div>

      {/* Account Type Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tax-Deferred (401k, IRA)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.taxDeferredValue)}
              </p>
              <p className="text-xs text-gray-500">
                {totalPortfolioValue > 0
                  ? ((summary.taxDeferredValue / totalPortfolioValue) * 100).toFixed(1)
                  : 0}% of portfolio
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
              <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tax-Free (Roth IRA)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.taxFreeValue)}
              </p>
              <p className="text-xs text-gray-500">
                {totalPortfolioValue > 0
                  ? ((summary.taxFreeValue / totalPortfolioValue) * 100).toFixed(1)
                  : 0}% of portfolio
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900">
              <Wallet className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Taxable (Brokerage)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(summary.taxableValue)}
              </p>
              <p className="text-xs text-gray-500">
                {totalPortfolioValue > 0
                  ? ((summary.taxableValue / totalPortfolioValue) * 100).toFixed(1)
                  : 0}% of portfolio
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Gains Summary (Taxable Accounts Only) */}
      {summary.taxableValue > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unrealized Gains & Losses (Taxable Accounts)</CardTitle>
            <CardDescription>
              Capital gains classification based on holding period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Long-Term Gains</p>
                </div>
                <p className="mt-1 text-2xl font-semibold text-green-600">
                  {formatCurrency(summary.longTermGains)}
                </p>
                <p className="text-xs text-gray-500">Held &gt; 1 year (0-20% tax)</p>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Long-Term Losses</p>
                </div>
                <p className="mt-1 text-2xl font-semibold text-red-600">
                  -{formatCurrency(summary.longTermLosses)}
                </p>
                <p className="text-xs text-gray-500">Can offset gains</p>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Short-Term Gains</p>
                </div>
                <p className="mt-1 text-2xl font-semibold text-green-600">
                  {formatCurrency(summary.shortTermGains)}
                </p>
                <p className="text-xs text-gray-500">Held ≤ 1 year (ordinary income)</p>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Short-Term Losses</p>
                </div>
                <p className="mt-1 text-2xl font-semibold text-red-600">
                  -{formatCurrency(summary.shortTermLosses)}
                </p>
                <p className="text-xs text-gray-500">Can offset gains</p>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Net Unrealized Gain/Loss</p>
                  <p className={cn(
                    'text-2xl font-semibold',
                    summary.netUnrealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {summary.netUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(summary.netUnrealizedGainLoss)}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Est. LTCG Tax</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    {formatCurrency(summary.estimatedLTCGTax)}
                  </p>
                  <p className="text-xs text-gray-500">At {assumedIncome >= 518900 ? '20%' : assumedIncome >= 47025 ? '15%' : '0%'} rate</p>
                </div>

                <div className="rounded-lg bg-orange-50 p-4 dark:bg-orange-950/30">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Est. STCG Tax</p>
                  <p className="text-2xl font-semibold text-orange-600">
                    {formatCurrency(summary.estimatedSTCGTax)}
                  </p>
                  <p className="text-xs text-gray-500">At marginal income rate</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Loss Harvesting Opportunities */}
      {summary.harvestingCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-purple-500" />
              Tax Loss Harvesting Opportunities
            </CardTitle>
            <CardDescription>
              Positions with losses that could be sold to offset gains (be aware of wash sale rules)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg bg-purple-50 p-3 dark:bg-purple-950/30">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                <strong>Potential Tax Savings:</strong> Up to {formatCurrency(summary.potentialTaxSavings)} by harvesting losses
              </p>
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                Losses can offset capital gains plus up to $3,000 of ordinary income per year
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 text-left font-medium text-gray-500">Symbol</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Market Value</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Loss</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Loss %</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.harvestingCandidates.slice(0, 10).map((pos) => (
                    <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-medium text-gray-900 dark:text-white">{pos.symbol}</td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                        {formatCurrency(pos.marketValue)}
                      </td>
                      <td className="py-2 text-right text-red-600">
                        {formatCurrency(pos.gainLoss)}
                      </td>
                      <td className="py-2 text-right text-red-600">
                        {pos.gainLossPercent.toFixed(2)}%
                      </td>
                      <td className="py-2 text-right">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          pos.gainType === 'long_term'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        )}>
                          {formatGainType(pos.gainType)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
              <p>
                <strong>Wash Sale Rule:</strong> If you sell a security at a loss and buy a substantially identical security within 30 days before or after the sale, the loss is disallowed for tax purposes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approaching Long-Term Status */}
      {summary.approachingLongTerm.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Approaching Long-Term Status
            </CardTitle>
            <CardDescription>
              Positions with gains that will qualify for lower long-term rates soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 text-left font-medium text-gray-500">Symbol</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Gain</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Days Until LTCG</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Potential Tax Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.approachingLongTerm.map((pos) => {
                    // Calculate tax difference between STCG and LTCG
                    const stcgRate = assumedIncome >= 191950 ? 0.32 : assumedIncome >= 100525 ? 0.24 : 0.22;
                    const ltcgRate = assumedIncome >= 518900 ? 0.20 : assumedIncome >= 47025 ? 0.15 : 0;
                    const savings = pos.gainLoss * (stcgRate - ltcgRate);

                    return (
                      <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-medium text-gray-900 dark:text-white">{pos.symbol}</td>
                        <td className="py-2 text-right text-green-600">
                          +{formatCurrency(pos.gainLoss)}
                        </td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                          <span className="font-medium">{pos.daysUntilLongTerm}</span> days
                        </td>
                        <td className="py-2 text-right text-blue-600">
                          ~{formatCurrency(savings)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Consider waiting until these positions qualify for long-term capital gains treatment before selling.
            </p>
          </CardContent>
        </Card>
      )}

      {/* All Taxable Positions */}
      {taxablePositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Taxable Account Positions</CardTitle>
            <CardDescription>
              Detailed tax information for each position in taxable accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th
                      className="pb-2 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('symbol')}
                    >
                      Symbol <SortIcon field="symbol" />
                    </th>
                    <th className="pb-2 text-left font-medium text-gray-500">Account</th>
                    <th
                      className="pb-2 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('marketValue')}
                    >
                      Value <SortIcon field="marketValue" />
                    </th>
                    <th
                      className="pb-2 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('gainLoss')}
                    >
                      Gain/Loss <SortIcon field="gainLoss" />
                    </th>
                    <th
                      className="pb-2 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('gainLossPercent')}
                    >
                      % <SortIcon field="gainLossPercent" />
                    </th>
                    <th className="pb-2 text-center font-medium text-gray-500">Type</th>
                    <th
                      className="pb-2 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('daysUntilLongTerm')}
                    >
                      Days to LTCG <SortIcon field="daysUntilLongTerm" />
                    </th>
                    <th className="pb-2 text-right font-medium text-gray-500">Est. Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllPositions ? taxablePositions : taxablePositions.slice(0, 15)).map((pos) => (
                    <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-medium text-gray-900 dark:text-white">{pos.symbol}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300 text-xs">
                        {pos.account?.name || 'Unknown'}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(pos.marketValue)}
                      </td>
                      <td className={cn(
                        'py-2 text-right font-medium',
                        pos.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {pos.gainLoss >= 0 ? '+' : ''}{formatCurrency(pos.gainLoss)}
                      </td>
                      <td className={cn(
                        'py-2 text-right',
                        pos.gainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {pos.gainLossPercent >= 0 ? '+' : ''}{pos.gainLossPercent.toFixed(1)}%
                      </td>
                      <td className="py-2 text-center">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          pos.gainType === 'long_term'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        )}>
                          {pos.gainType === 'long_term' ? 'LT' : 'ST'}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                        {pos.daysUntilLongTerm === 0 ? (
                          <span className="text-green-600">Qualified</span>
                        ) : (
                          <span>{pos.daysUntilLongTerm}d</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-300">
                        {pos.estimatedTax > 0 ? formatCurrency(pos.estimatedTax) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {taxablePositions.length > 15 && (
              <button
                onClick={() => setShowAllPositions(!showAllPositions)}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showAllPositions ? 'Show less' : `Show all ${taxablePositions.length} positions`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tax-Advantaged Positions Summary */}
      {(summary.taxDeferredValue > 0 || summary.taxFreeValue > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Tax-Advantaged Account Positions</CardTitle>
            <CardDescription>
              These positions grow tax-deferred or tax-free
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 text-left font-medium text-gray-500">Symbol</th>
                    <th className="pb-2 text-left font-medium text-gray-500">Account</th>
                    <th className="pb-2 text-center font-medium text-gray-500">Tax Treatment</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Value</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions
                    .filter(p => p.taxTreatment !== 'taxable')
                    .slice(0, showAllPositions ? undefined : 10)
                    .map((pos) => (
                      <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-medium text-gray-900 dark:text-white">{pos.symbol}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-300 text-xs">
                          {pos.account?.name || 'Unknown'}
                        </td>
                        <td className="py-2 text-center">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            pos.taxTreatment === 'tax_free'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          )}>
                            {formatTaxTreatment(pos.taxTreatment)}
                          </span>
                        </td>
                        <td className="py-2 text-right text-gray-900 dark:text-white">
                          {formatCurrency(pos.marketValue)}
                        </td>
                        <td className={cn(
                          'py-2 text-right',
                          pos.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {pos.gainLoss >= 0 ? '+' : ''}{formatCurrency(pos.gainLoss)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Panel */}
      <Card className="bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-2">Tax Information Disclaimer</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-300 text-xs">
                <li>• Estimates based on 2024 federal tax brackets (single filer). State taxes not included.</li>
                <li>• Long-term capital gains rates: 0%, 15%, or 20% depending on income.</li>
                <li>• Short-term capital gains are taxed at your ordinary income rate.</li>
                <li>• Net Investment Income Tax (3.8%) applies if income exceeds $200,000.</li>
                <li>• This is for informational purposes only. Consult a tax professional for advice.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
