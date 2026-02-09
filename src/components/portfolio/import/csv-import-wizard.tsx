'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Modal } from '@/components/portfolio/ui/modal';
import { Button } from '@/components/portfolio/ui/button';
import { Select } from '@/components/portfolio/ui/select';
import { parseCSV, aggregatePositions, validatePositions, detectBrokerFormat } from '@/lib/portfolio/csv-parsers';
import type { Account } from '@/types/portfolio';

interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (positions: {
    symbol: string;
    shares: number;
    costBasis: number;
    assetType: string;
    accountId: string;
  }[]) => Promise<void>;
  accounts: Account[];
}

type Step = 'upload' | 'preview' | 'account' | 'confirm';

interface ParsedPosition {
  symbol: string;
  shares: number;
  costBasis: number;
  purchaseDate?: string;
  assetType?: string;
}

export function CSVImportWizard({ isOpen, onClose, onImport, accounts }: CSVImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [broker, setBroker] = useState<string>('unknown');
  const [positions, setPositions] = useState<ParsedPosition[]>([]);
  const [invalidPositions, setInvalidPositions] = useState<{ position: ParsedPosition; reason: string }[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setBroker('unknown');
    setPositions([]);
    setInvalidPositions([]);
    setSelectedAccount(accounts[0]?.id || '');
    setError(null);
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);

      // Read and parse the file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const result = parseCSV(text);

        if (!result.success) {
          setError(result.errors.join(', '));
          return;
        }

        setBroker(result.broker);
        const aggregated = aggregatePositions(result.positions);
        const { valid, invalid } = validatePositions(aggregated);

        setPositions(valid);
        setInvalidPositions(invalid);
        setStep('preview');
      };
      reader.readAsText(selectedFile);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      // Simulate file input change
      const input = document.createElement('input');
      input.type = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      const changeEvent = {
        target: { files: dataTransfer.files },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(changeEvent);
    }
  }, [handleFileChange]);

  const handleImport = async () => {
    if (!selectedAccount || positions.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(
        positions.map((p) => ({
          symbol: p.symbol,
          shares: p.shares,
          costBasis: p.costBasis,
          assetType: p.assetType || 'stock',
          accountId: selectedAccount,
        }))
      );
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const brokerNames: Record<string, string> = {
    schwab: 'Charles Schwab',
    fidelity: 'Fidelity',
    vanguard: 'Vanguard',
    tdameritrade: 'TD Ameritrade',
    robinhood: 'Robinhood',
    etrade: 'E*TRADE',
    merrill: 'Merrill Edge',
    generic: 'Generic Format',
    unknown: 'Unknown Format',
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Import Positions from CSV" size="lg">
      <div className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {['Upload', 'Preview', 'Account', 'Confirm'].map((label, index) => {
            const steps: Step[] = ['upload', 'preview', 'account', 'confirm'];
            const currentIndex = steps.indexOf(step);
            const isActive = index === currentIndex;
            const isComplete = index < currentIndex;

            return (
              <div key={label} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
                  }`}
                >
                  {isComplete ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                {index < 3 && (
                  <div className={`mx-2 h-0.5 w-12 ${index < currentIndex ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/30">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Drag and drop your CSV file here, or
            </p>
            <label className="mt-2 inline-block">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <span className="cursor-pointer text-blue-500 hover:text-blue-600">browse to upload</span>
            </label>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Supported formats: Schwab, Fidelity, Vanguard, TD Ameritrade, Robinhood, E*TRADE, Merrill Edge
            </p>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">{file?.name}</span>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {brokerNames[broker]}
              </span>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Shares</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Cost Basis</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, index) => (
                    <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.symbol}</td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{p.shares.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(p.costBasis)}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.assetType || 'stock'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Found {positions.length} valid positions
              {invalidPositions.length > 0 && ` (${invalidPositions.length} invalid skipped)`}
            </p>

            {invalidPositions.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-yellow-600 dark:text-yellow-400">
                  Show skipped positions
                </summary>
                <ul className="mt-2 list-inside list-disc text-gray-500 dark:text-gray-400">
                  {invalidPositions.map((inv, index) => (
                    <li key={index}>
                      {inv.position.symbol}: {inv.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Step 3: Select Account */}
        {step === 'account' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select the account to import {positions.length} positions into:
            </p>
            <Select
              label="Target Account"
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Existing positions with the same symbol will NOT be updated. New positions will be created.
            </p>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <h4 className="font-medium text-gray-900 dark:text-white">Import Summary</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Positions to import</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{positions.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Target account</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {accounts.find((a) => a.id === selectedAccount)?.name}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Total cost basis</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(positions.reduce((sum, p) => sum + p.costBasis, 0))}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              This action cannot be undone. You may need to delete positions manually if imported incorrectly.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'upload') {
                reset();
                onClose();
              } else if (step === 'preview') setStep('upload');
              else if (step === 'account') setStep('preview');
              else if (step === 'confirm') setStep('account');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 'upload' ? 'Cancel' : 'Back'}
          </Button>
          <Button
            onClick={() => {
              if (step === 'preview') setStep('account');
              else if (step === 'account') setStep('confirm');
              else if (step === 'confirm') handleImport();
            }}
            disabled={
              (step === 'preview' && positions.length === 0) ||
              (step === 'account' && !selectedAccount) ||
              isImporting
            }
          >
            {isImporting ? 'Importing...' : step === 'confirm' ? 'Import Positions' : 'Next'}
            {!isImporting && step !== 'confirm' && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
