import { Metadata } from 'next';
import { WatchlistDashboard } from '@/components/watchlist-dashboard';

export const metadata: Metadata = {
  title: 'Watchlist | FinTools',
  description: 'Analyze any stock ticker with AI-powered insights',
};

export default function WatchlistPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Stock Watchlist</h1>
          <p className="text-gray-600 mt-2">
            Paste stock tickers to get instant financial analysis and AI-powered insights.
          </p>
        </div>

        <WatchlistDashboard />
      </div>
    </main>
  );
}
