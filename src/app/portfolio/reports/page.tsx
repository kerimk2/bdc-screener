'use client';

import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Select } from '@/components/portfolio/ui/select';
import { Loading } from '@/components/portfolio/ui/loading';
import {
  calculatePortfolioSummary,
  calculateSectorAllocation,
  calculateGeographicAllocation,
  calculatePerformanceMetrics,
  formatCurrency as formatCurrencyRaw,
} from '@/lib/portfolio/calculations';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';

export default function ReportsPage() {
  const { enrichedPositions, accounts, loading } = useData();
  const formatCurrency = useFormatCurrency();
  const [selectedAccount, setSelectedAccount] = useState('all');

  const filteredPositions =
    selectedAccount === 'all'
      ? enrichedPositions
      : enrichedPositions.filter(p => p.account_id === selectedAccount);

  const filteredCashBalance =
    selectedAccount === 'all'
      ? accounts.reduce((sum, a) => sum + (a.cash_balance || 0), 0)
      : accounts.find(a => a.id === selectedAccount)?.cash_balance || 0;

  const summary = calculatePortfolioSummary(filteredPositions, filteredCashBalance);
  const sectorAllocation = calculateSectorAllocation(filteredPositions, filteredCashBalance);
  const geographicAllocation = calculateGeographicAllocation(filteredPositions);
  const performance = calculatePerformanceMetrics(filteredPositions);

  const generateCSV = () => {
    const headers = [
      'Symbol',
      'Account',
      'Asset Type',
      'Shares',
      'Cost Basis',
      'Current Price',
      'Market Value',
      'Gain/Loss',
      'Gain/Loss %',
      'Weight %',
      'Sector',
      'Country',
    ];

    const rows = filteredPositions.map(p => [
      p.symbol,
      accounts.find(a => a.id === p.account_id)?.name || '',
      p.asset_type,
      p.shares,
      p.cost_basis,
      p.currentPrice,
      p.marketValue,
      p.gainLoss,
      p.gainLossPercent.toFixed(2),
      p.weight.toFixed(2),
      p.metadata?.sector || '',
      p.metadata?.country || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateTextReport = () => {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let report = `PORTFOLIO REPORT\n`;
    report += `Generated: ${date}\n`;
    report += `${'='.repeat(50)}\n\n`;

    report += `SUMMARY\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `Total Value: ${formatCurrencyRaw(summary.totalValue)}\n`;
    report += `Total Cost: ${formatCurrencyRaw(summary.totalCost)}\n`;
    report += `Total Gain/Loss: ${formatCurrencyRaw(summary.totalGainLoss)} (${summary.totalGainLossPercent.toFixed(2)}%)\n`;
    report += `Total Positions: ${summary.positionCount}\n\n`;

    report += `PERFORMANCE\n`;
    report += `${'-'.repeat(30)}\n`;
    report += `Total Return: ${performance.totalReturnPercent.toFixed(2)}%\n`;
    report += `Annualized Return: ${performance.annualizedReturn.toFixed(2)}%\n\n`;

    report += `SECTOR ALLOCATION\n`;
    report += `${'-'.repeat(30)}\n`;
    sectorAllocation.forEach(s => {
      report += `${s.sector}: ${s.weight.toFixed(2)}% (${formatCurrencyRaw(s.value)})\n`;
    });
    report += `\n`;

    report += `GEOGRAPHIC ALLOCATION\n`;
    report += `${'-'.repeat(30)}\n`;
    geographicAllocation.slice(0, 10).forEach(g => {
      report += `${g.country}: ${g.weight.toFixed(2)}% (${formatCurrencyRaw(g.value)})\n`;
    });
    report += `\n`;

    report += `HOLDINGS\n`;
    report += `${'-'.repeat(30)}\n`;
    filteredPositions.forEach(p => {
      report += `${p.symbol}: ${p.shares} shares @ ${formatCurrencyRaw(p.currentPrice)} = ${formatCurrencyRaw(p.marketValue)} (${p.gainLossPercent >= 0 ? '+' : ''}${p.gainLossPercent.toFixed(2)}%)\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Loading message="Loading..." />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Reports
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Generate and download portfolio reports
        </p>
      </div>

      {enrichedPositions.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            No data for reports
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Add positions to generate reports.
          </p>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Select
                  label="Account"
                  options={[
                    { value: 'all', label: 'All Accounts' },
                    ...accounts.map(a => ({ value: a.id, label: a.name })),
                  ]}
                  value={selectedAccount}
                  onChange={e => setSelectedAccount(e.target.value)}
                  className="w-64"
                />
              </div>
            </CardContent>
          </Card>

          {/* Report Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Report Preview</CardTitle>
              <CardDescription>
                Summary of {filteredPositions.length} positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(summary.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(summary.totalCost)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Gain/Loss</p>
                  <p className={`text-2xl font-semibold ${summary.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(summary.totalGainLoss)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Return %</p>
                  <p className={`text-2xl font-semibold ${summary.totalGainLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {summary.totalGainLossPercent >= 0 ? '+' : ''}{summary.totalGainLossPercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Download Options */}
          <Card>
            <CardHeader>
              <CardTitle>Download Report</CardTitle>
              <CardDescription>
                Choose a format to download your portfolio report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={generateCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button variant="outline" onClick={generateTextReport}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Text Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
