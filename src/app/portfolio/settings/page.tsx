'use client';

import { useState } from 'react';
import { Moon, Sun, Monitor, Lock, Database, Download, Upload } from 'lucide-react';
import { useTheme } from '@/components/portfolio/providers/theme-provider';
import { useData } from '@/components/portfolio/providers/data-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Input } from '@/components/portfolio/ui/input';
import { cn } from '@/lib/portfolio/utils';
import { CSVImportWizard } from '@/components/portfolio/import/csv-import-wizard';
import * as db from '@/lib/portfolio/supabase';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { accounts, enrichedPositions, watchlist, refreshData } = useData();
  const [investorPassword, setInvestorPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleImportPositions = async (positions: {
    symbol: string;
    shares: number;
    costBasis: number;
    assetType: string;
    accountId: string;
  }[]) => {
    // Import positions one by one
    for (const pos of positions) {
      await db.createPosition({
        account_id: pos.accountId,
        symbol: pos.symbol.toUpperCase(),
        asset_type: pos.assetType,
        shares: pos.shares,
        cost_basis: pos.costBasis,
        purchase_date: new Date().toISOString().split('T')[0],
      });
    }
    // Refresh data after import
    await refreshData();
    setImportSuccess(true);
    setTimeout(() => setImportSuccess(false), 5000);
  };

  const handleSavePassword = () => {
    // In a real app, this would hash and save to the database
    localStorage.setItem('investorPassword', investorPassword);
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 3000);
  };

  const exportData = () => {
    const data = {
      accounts,
      positions: enrichedPositions.map(p => ({
        account_id: p.account_id,
        symbol: p.symbol,
        asset_type: p.asset_type,
        shares: p.shares,
        cost_basis: p.cost_basis,
        purchase_date: p.purchase_date,
        notes: p.notes,
      })),
      watchlist,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Customize your portfolio app
        </p>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Choose your preferred theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                <Sun className="h-6 w-6 text-yellow-500" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Light</span>
            </button>

            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 shadow-sm">
                <Moon className="h-6 w-6 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Dark</span>
            </button>

            <button
              onClick={() => setTheme('system')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                theme === 'system'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-white to-gray-800 shadow-sm">
                <Monitor className="h-6 w-6 text-gray-600" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">System</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Investor Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Investor Access
          </CardTitle>
          <CardDescription>
            Set a password for the read-only investor view
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-4">
            <Input
              type="password"
              label="Investor Password"
              placeholder="Enter password for investor view"
              value={investorPassword}
              onChange={e => setInvestorPassword(e.target.value)}
            />
            <div className="flex items-center gap-4">
              <Button onClick={handleSavePassword} disabled={!investorPassword}>
                Save Password
              </Button>
              {passwordSaved && (
                <span className="text-sm text-green-500">Password saved!</span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Share the investor view link with prospective investors. They&apos;ll need this
              password to access your portfolio.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>Import, export, and manage your portfolio data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button onClick={() => setShowImportWizard(true)} disabled={accounts.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                Import from CSV
              </Button>
              <Button onClick={exportData} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export All Data
              </Button>
              {importSuccess && (
                <span className="text-sm text-green-500">Positions imported successfully!</span>
              )}
            </div>
            {accounts.length === 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Create an account first to import positions.
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Import positions from broker CSVs (Schwab, Fidelity, Vanguard, TD Ameritrade, Robinhood, E*TRADE, Merrill) or export a JSON backup.
            </p>

            <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-medium text-gray-900 dark:text-white">Statistics</h4>
              <div className="mt-2 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {accounts.length}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Accounts</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {enrichedPositions.length}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Positions</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {watchlist.length}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Watchlist</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <p><strong>PortfolioView</strong> - Personal Portfolio Monitoring</p>
            <p>Built with Next.js, Supabase, and Tailwind CSS</p>
            <p>Market data provided by Financial Modeling Prep</p>
          </div>
        </CardContent>
      </Card>

      {/* CSV Import Wizard */}
      <CSVImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImport={handleImportPositions}
        accounts={accounts}
      />
    </div>
  );
}
