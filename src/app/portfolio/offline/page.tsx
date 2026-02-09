'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        <WifiOff className="h-10 w-10 text-gray-400 dark:text-gray-500" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
        You're Offline
      </h1>

      <p className="mb-8 max-w-md text-gray-500 dark:text-gray-400">
        It looks like you've lost your internet connection. Some features may not be available
        until you're back online.
      </p>

      <div className="space-y-4">
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
        >
          <RefreshCw className="h-5 w-5" />
          Try Again
        </button>

        <p className="text-sm text-gray-400 dark:text-gray-500">
          Your cached data should still be visible on the dashboard.
        </p>
      </div>

      <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
          While Offline, You Can:
        </h2>
        <ul className="space-y-2 text-left text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            View your last known portfolio value
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            See your positions and allocations
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Access cached analytics
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
            Prices may be outdated
          </li>
        </ul>
      </div>
    </div>
  );
}
