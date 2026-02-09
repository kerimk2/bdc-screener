'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  DollarSign,
  Gem,
  Fuel,
  Wheat,
  Bitcoin,
  Factory,
  Globe,
  Newspaper,
  Brain,
  ExternalLink,
  Clock,
  Users,
  Star,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Loading } from '@/components/portfolio/ui/loading';
import { useData } from '@/components/portfolio/providers/data-provider';
import { InsiderActivityCard } from '@/components/portfolio/intelligence/insider-activity-card';
import { AnalystRatingsCard } from '@/components/portfolio/intelligence/analyst-ratings-card';
import { ShortInterestCard } from '@/components/portfolio/intelligence/short-interest-card';
import { getNews } from '@/lib/portfolio/market-data';
import { getRelativeTime } from '@/lib/portfolio/utils';
import { cn } from '@/lib/portfolio/utils';
import type { NewsItem, InsiderTransaction, AnalystRating } from '@/types/portfolio';

// ============== Types ==============
type MainTab = 'overview' | 'news' | 'intelligence';
type NewsSortMode = 'importance' | 'recent';
type IntelligenceTab = 'insider' | 'analyst' | 'short';

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface YieldCurvePoint {
  tenor: string;
  months: number;
  yield: number;
  change: number;
}

interface CurrencyData {
  pair: string;
  name: string;
  rate: number;
  change: number;
  changePercent: number;
}

interface CommodityData {
  symbol: string;
  name: string;
  category: 'precious_metals' | 'energy' | 'agriculture' | 'crypto' | 'industrial';
  price: number;
  change: number;
  changePercent: number;
  monthChangePercent: number;
  ytdChangePercent: number;
  unit: string;
}

interface MarketOverviewData {
  indices: IndexData[];
  commodities: CommodityData[];
  treasuryYields: YieldCurvePoint[];
  currencies: CurrencyData[];
  marketStatus: 'pre-market' | 'open' | 'after-hours' | 'closed';
  lastUpdated: string;
}

interface InsiderData {
  transactions: InsiderTransaction[];
  summaryBySymbol: Record<string, { buys: number; sells: number; netShares: number; netValue: number }>;
  totalBuys: number;
  totalSells: number;
  netValue: number;
}

interface AnalystData {
  ratings: AnalystRating[];
  summary: {
    averageRating: string;
    averageScore: number;
    averageUpside: number | null;
    totalAnalystsCovering: number;
    strongBuys: number;
    buys: number;
    holds: number;
    sells: number;
  };
}

interface ShortInterestData {
  shortInterest: {
    symbol: string;
    shortPercentOfFloat: number | null;
    shortRatio: number | null;
    sharesShort: number | null;
    sharesShortPriorMonth: number | null;
    shortPercentChange: number | null;
    floatShares: number | null;
    daysTocover: number | null;
  }[];
  summary: {
    averageShortPercent: number | null;
    highShortInterestCount: number;
    increasingShortCount: number;
    positionsWithData: number;
  };
}

// ============== Constants ==============
const STATUS_CONFIG = {
  'pre-market': { label: 'Pre-Market', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  'open': { label: 'Market Open', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  'after-hours': { label: 'After Hours', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  'closed': { label: 'Market Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};

const CATEGORY_CONFIG = {
  precious_metals: { label: 'Precious Metals', icon: Gem, color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
  energy: { label: 'Energy', icon: Fuel, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900' },
  agriculture: { label: 'Agriculture', icon: Wheat, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900' },
  crypto: { label: 'Crypto', icon: Bitcoin, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900' },
  industrial: { label: 'Industrial Metals', icon: Factory, color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

// ============== Helper Functions ==============
function formatLargeNumber(value: number): string {
  if (value >= 10000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCommodityPrice(price: number, category: string): string {
  if (category === 'crypto') {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 100) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// ============== Yield Curve Component ==============
function YieldCurveGraph({ yields }: { yields: YieldCurvePoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const sortedYields = [...yields].sort((a, b) => a.months - b.months);

  if (sortedYields.length < 2) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 40, bottom: 40, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const minYield = Math.min(...sortedYields.map(y => y.yield)) - 0.5;
  const maxYield = Math.max(...sortedYields.map(y => y.yield)) + 0.5;
  const maxMonths = sortedYields[sortedYields.length - 1].months;

  const xScale = (months: number) => padding.left + (months / maxMonths) * graphWidth;
  const yScale = (value: number) => padding.top + graphHeight - ((value - minYield) / (maxYield - minYield)) * graphHeight;

  const pathData = sortedYields
    .map((y, i) => `${i === 0 ? 'M' : 'L'} ${xScale(y.months)} ${yScale(y.yield)}`)
    .join(' ');

  const yTicks = [];
  const yStep = (maxYield - minYield) / 4;
  for (let i = 0; i <= 4; i++) {
    yTicks.push(minYield + i * yStep);
  }

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 220 }}>
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={padding.left} y1={yScale(tick)} x2={width - padding.right} y2={yScale(tick)} stroke="currentColor" strokeOpacity={0.1} />
            <text x={padding.left - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500 text-[10px]">
              {tick.toFixed(2)}%
            </text>
          </g>
        ))}
        {sortedYields.map((y, i) => (
          <text key={i} x={xScale(y.months)} y={height - padding.bottom + 20} textAnchor="middle" className="fill-gray-500 text-[10px] font-medium">
            {y.tenor}
          </text>
        ))}
        <path d={pathData} fill="none" stroke="#3B82F6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {sortedYields.map((y, i) => (
          <g key={i}>
            <circle cx={xScale(y.months)} cy={yScale(y.yield)} r={6} fill="#3B82F6" stroke="white" strokeWidth={2} />
            <text x={xScale(y.months)} y={yScale(y.yield) - 12} textAnchor="middle" className="fill-gray-700 dark:fill-gray-300 text-[10px] font-semibold">
              {y.yield.toFixed(2)}%
            </text>
          </g>
        ))}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="currentColor" strokeOpacity={0.2} />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="currentColor" strokeOpacity={0.2} />
      </svg>
    </div>
  );
}

// ============== Commodities Component ==============
function CommoditiesSection({ commodities }: { commodities: CommodityData[] }) {
  const groupedCommodities = useMemo(() => {
    const groups: Record<string, CommodityData[]> = {};
    for (const commodity of commodities) {
      if (!groups[commodity.category]) groups[commodity.category] = [];
      groups[commodity.category].push(commodity);
    }
    return groups;
  }, [commodities]);

  const categoryOrder = ['precious_metals', 'energy', 'agriculture', 'industrial', 'crypto'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Commodities</CardTitle>
        <CardDescription>Futures prices with daily, monthly, and year-to-date changes</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-6">
          {categoryOrder.map((category) => {
            const items = groupedCommodities[category];
            if (!items || items.length === 0) return null;

            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
            const IconComponent = config.icon;

            return (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={cn('rounded-md p-1.5', config.bgColor)}>
                    <IconComponent className={cn('h-4 w-4', config.color)} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{config.label}</h3>
                </div>
                <div className="-mx-4 overflow-x-auto sm:mx-0">
                  <div className="inline-block min-w-full align-middle sm:rounded-lg sm:border sm:border-gray-200 sm:dark:border-gray-700">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                          <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 sm:px-4">Name</th>
                          <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 sm:px-4">Price</th>
                          <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 sm:px-4">Day</th>
                          <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 sm:px-4">1M</th>
                          <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 sm:px-4">YTD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {items.map((commodity) => {
                          const isPositive = commodity.changePercent >= 0;
                          return (
                            <tr key={commodity.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{commodity.name}</p>
                                {commodity.unit && <p className="text-xs text-gray-400">{commodity.unit}</p>}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right sm:px-4 sm:py-3">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">${formatCommodityPrice(commodity.price, commodity.category)}</p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                                <div className="flex items-center justify-center gap-1">
                                  {isPositive ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                                  <span className={cn('text-sm font-semibold', isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                                    {isPositive ? '+' : ''}{commodity.changePercent.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                                <p className={cn('text-sm font-semibold text-center', commodity.monthChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                                  {commodity.monthChangePercent >= 0 ? '+' : ''}{commodity.monthChangePercent.toFixed(1)}%
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                                <p className={cn('text-sm font-semibold text-center', commodity.ytdChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                                  {commodity.ytdChangePercent >= 0 ? '+' : ''}{commodity.ytdChangePercent.toFixed(1)}%
                                </p>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== News Column Component ==============
function NewsColumn({
  title,
  subtitle,
  symbols,
  news,
  loading,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  symbols: string[];
  news: NewsItem[];
  loading: boolean;
  emptyMessage: string;
}) {
  if (loading) {
    return (
      <div className="flex-1">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="flex-1">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <Card className="py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Newspaper className="h-6 w-6 text-gray-400" />
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      {news.length === 0 ? (
        <Card className="py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Newspaper className="h-6 w-6 text-gray-400" />
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No recent news for these holdings</p>
        </Card>
      ) : (
        <div className="max-h-[calc(100vh-350px)] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {news.map((item, index) => (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {item.symbol}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">{item.title}</span>
                <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">{getRelativeTime(item.publishedDate)}</span>
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Main Component ==============
export default function MarketPage() {
  const { enrichedPositions, watchlist, loading: dataLoading } = useData();

  // Main tab state
  const [mainTab, setMainTab] = useState<MainTab>('overview');

  // Overview state
  const [overviewData, setOverviewData] = useState<MarketOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // News state
  const [portfolioNews, setPortfolioNews] = useState<NewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [loadingPortfolioNews, setLoadingPortfolioNews] = useState(true);
  const [loadingWatchlistNews, setLoadingWatchlistNews] = useState(true);
  const [newsSortMode, setNewsSortMode] = useState<NewsSortMode>('importance');

  // Intelligence state
  const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceTab>('insider');
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [insiderData, setInsiderData] = useState<InsiderData | null>(null);
  const [analystData, setAnalystData] = useState<AnalystData | null>(null);
  const [shortData, setShortData] = useState<ShortInterestData | null>(null);

  // Computed values
  const portfolioSymbols = enrichedPositions.map(p => p.symbol);
  const watchlistSymbols = watchlist.map(w => w.symbol);
  const portfolioKey = [...portfolioSymbols].sort().join(',');
  const watchlistKey = [...watchlistSymbols].sort().join(',');
  const intelligenceSymbols = enrichedPositions.map((p) => p.symbol).filter((s) => !s.includes('-'));

  // ============== Overview Effects ==============
  const fetchOverviewData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingOverview(true);

    try {
      const response = await fetch('/api/portfolio/market-data/market-overview');
      const result = await response.json();
      setOverviewData(result);
    } catch (error) {
      console.error('Error fetching market overview:', error);
    } finally {
      setLoadingOverview(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    const interval = setInterval(() => fetchOverviewData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ============== News Effects ==============
  useEffect(() => {
    async function fetchPortfolioNews() {
      const symbols = portfolioKey ? portfolioKey.split(',') : [];
      if (symbols.length === 0) {
        setPortfolioNews([]);
        setLoadingPortfolioNews(false);
        return;
      }
      setLoadingPortfolioNews(true);
      try {
        const newsData = await getNews(symbols, 50, newsSortMode);
        setPortfolioNews(newsData);
      } catch (error) {
        console.error('Error fetching portfolio news:', error);
      } finally {
        setLoadingPortfolioNews(false);
      }
    }

    if (!dataLoading && mainTab === 'news') {
      fetchPortfolioNews();
    }
  }, [dataLoading, portfolioKey, newsSortMode, mainTab]);

  useEffect(() => {
    async function fetchWatchlistNews() {
      const symbols = watchlistKey ? watchlistKey.split(',') : [];
      if (symbols.length === 0) {
        setWatchlistNews([]);
        setLoadingWatchlistNews(false);
        return;
      }
      setLoadingWatchlistNews(true);
      try {
        const newsData = await getNews(symbols, 50, newsSortMode);
        setWatchlistNews(newsData);
      } catch (error) {
        console.error('Error fetching watchlist news:', error);
      } finally {
        setLoadingWatchlistNews(false);
      }
    }

    if (!dataLoading && mainTab === 'news') {
      fetchWatchlistNews();
    }
  }, [dataLoading, watchlistKey, newsSortMode, mainTab]);

  // ============== Intelligence Effects ==============
  const fetchIntelligenceData = async (tab: IntelligenceTab) => {
    if (intelligenceSymbols.length === 0) return;

    setLoadingIntelligence(true);
    try {
      const symbolsParam = intelligenceSymbols.join(',');

      switch (tab) {
        case 'insider': {
          const response = await fetch(`/api/portfolio/market-data/insider-activity?symbols=${symbolsParam}`);
          if (response.ok) {
            const data = await response.json();
            setInsiderData(data);
          }
          break;
        }
        case 'analyst': {
          const response = await fetch(`/api/portfolio/market-data/analyst-ratings?symbols=${symbolsParam}`);
          if (response.ok) {
            const data = await response.json();
            setAnalystData(data);
          }
          break;
        }
        case 'short': {
          const response = await fetch(`/api/portfolio/market-data/short-interest?symbols=${symbolsParam}`);
          if (response.ok) {
            const data = await response.json();
            setShortData(data);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error fetching ${tab} data:`, error);
    } finally {
      setLoadingIntelligence(false);
    }
  };

  useEffect(() => {
    if (!dataLoading && intelligenceSymbols.length > 0 && mainTab === 'intelligence') {
      const hasData =
        (intelligenceTab === 'insider' && insiderData) ||
        (intelligenceTab === 'analyst' && analystData) ||
        (intelligenceTab === 'short' && shortData);

      if (!hasData) {
        fetchIntelligenceData(intelligenceTab);
      }
    }
  }, [intelligenceTab, dataLoading, intelligenceSymbols.join(','), mainTab]);

  // ============== Render ==============
  const mainTabs = [
    { id: 'overview' as const, label: 'Overview', icon: Globe },
    { id: 'news' as const, label: 'News', icon: Newspaper },
    { id: 'intelligence' as const, label: 'Intelligence', icon: Brain },
  ];

  const statusConfig = overviewData ? STATUS_CONFIG[overviewData.marketStatus] : STATUS_CONFIG.closed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Market</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Overview, news, and intelligence</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium sm:px-3 sm:text-sm', statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors',
                mainTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============== OVERVIEW TAB ============== */}
      {mainTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          {loadingOverview ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Refresh button */}
              <div className="flex justify-end">
                <button
                  onClick={() => fetchOverviewData(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3 sm:text-sm"
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                  Refresh
                </button>
              </div>

              {/* Major Indices */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
                {overviewData?.indices.map((index) => {
                  const isPositive = index.change >= 0;
                  const isVix = index.symbol === '^VIX';

                  return (
                    <Card key={index.symbol} className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{index.name}</p>
                          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white sm:text-2xl">
                            {isVix ? index.price.toFixed(2) : formatLargeNumber(index.price)}
                          </p>
                        </div>
                        <div className={cn(
                          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10',
                          isVix ? 'bg-purple-100 dark:bg-purple-900' : isPositive ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                        )}>
                          {isVix ? (
                            <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400 sm:h-5 sm:w-5" />
                          ) : isPositive ? (
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 sm:h-5 sm:w-5" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 sm:h-5 sm:w-5" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-2">
                        <span className={cn('text-xs font-medium sm:text-sm', isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                          {isPositive ? '+' : ''}{index.change.toFixed(2)}
                        </span>
                        <span className={cn(
                          'rounded px-1 py-0.5 text-xs font-medium sm:px-1.5',
                          isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        )}>
                          {isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Treasury Yields */}
              <Card>
                <CardHeader>
                  <CardTitle>US Treasury Yield Curve</CardTitle>
                  <CardDescription>Current yield curve shape and individual tenor yields</CardDescription>
                </CardHeader>
                <CardContent>
                  {overviewData && overviewData.treasuryYields.length >= 2 && <YieldCurveGraph yields={overviewData.treasuryYields} />}
                  <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {overviewData?.treasuryYields.map((treasury) => {
                      const isPositive = treasury.change >= 0;
                      return (
                        <div key={treasury.tenor} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{treasury.tenor} Treasury</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{treasury.yield.toFixed(3)}%</p>
                          <span className={cn('mt-1 inline-block text-xs font-medium', isPositive ? 'text-red-500' : 'text-green-500')}>
                            {isPositive ? '+' : ''}{treasury.change.toFixed(3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {overviewData && overviewData.treasuryYields.length >= 2 && (
                    <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {(() => {
                          const shortTerm = overviewData.treasuryYields.find(y => y.months <= 12);
                          const longTerm = overviewData.treasuryYields.find(y => y.months >= 120);
                          if (!shortTerm || !longTerm) return 'Insufficient data for curve analysis';
                          const spread = longTerm.yield - shortTerm.yield;
                          if (spread < -0.5) return `Deeply inverted yield curve (${spread.toFixed(2)}% spread). Historically signals recession risk.`;
                          if (spread < 0) return `Inverted yield curve (${spread.toFixed(2)}% spread). Short-term rates exceed long-term rates.`;
                          if (spread < 0.5) return `Flat yield curve (${spread.toFixed(2)}% spread). Often indicates economic uncertainty.`;
                          return `Normal yield curve (${spread.toFixed(2)}% spread). Long-term rates higher than short-term.`;
                        })()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Currencies */}
              {overviewData?.currencies && overviewData.currencies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Major Currencies
                    </CardTitle>
                    <CardDescription>Foreign exchange rates vs USD</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      {overviewData.currencies.map((currency) => {
                        const isPositive = currency.changePercent >= 0;
                        const isUsdBase = currency.pair.startsWith('USD/');
                        return (
                          <div key={currency.pair} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{currency.pair}</p>
                              {isPositive ? (
                                <TrendingUp className={cn('h-4 w-4', isUsdBase ? 'text-green-500' : 'text-red-500')} />
                              ) : (
                                <TrendingDown className={cn('h-4 w-4', isUsdBase ? 'text-red-500' : 'text-green-500')} />
                              )}
                            </div>
                            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{currency.rate.toFixed(4)}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={cn('text-xs font-medium', isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                                {isPositive ? '+' : ''}{currency.changePercent.toFixed(2)}%
                              </span>
                              <span className="text-xs text-gray-400">{currency.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Commodities */}
              {overviewData?.commodities && overviewData.commodities.length > 0 && <CommoditiesSection commodities={overviewData.commodities} />}

              {/* Last Updated */}
              {overviewData?.lastUpdated && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Last updated: {new Date(overviewData.lastUpdated).toLocaleString()}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ============== NEWS TAB ============== */}
      {mainTab === 'news' && (
        <div className="space-y-6">
          {/* Sort Mode Toggle */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <button
                onClick={() => setNewsSortMode('importance')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  newsSortMode === 'importance'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                )}
              >
                <TrendingUp className="h-4 w-4" />
                Important
              </button>
              <button
                onClick={() => setNewsSortMode('recent')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  newsSortMode === 'recent'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                )}
              >
                <Clock className="h-4 w-4" />
                Recent
              </button>
            </div>
          </div>

          {/* News Columns */}
          <div className="flex gap-6">
            <NewsColumn
              title="Portfolio"
              subtitle={`${portfolioSymbols.length} holdings`}
              symbols={portfolioSymbols}
              news={portfolioNews}
              loading={loadingPortfolioNews}
              emptyMessage="Add positions to see portfolio news"
            />
            <NewsColumn
              title="Watchlist"
              subtitle={`${watchlistSymbols.length} symbols`}
              symbols={watchlistSymbols}
              news={watchlistNews}
              loading={loadingWatchlistNews}
              emptyMessage="Add symbols to your watchlist"
            />
          </div>
        </div>
      )}

      {/* ============== INTELLIGENCE TAB ============== */}
      {mainTab === 'intelligence' && (
        <div className="space-y-6">
          {enrichedPositions.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No positions to analyze</h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Add positions to your portfolio to see market intelligence.</p>
            </Card>
          ) : (
            <>
              {/* Refresh button */}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => fetchIntelligenceData(intelligenceTab)} disabled={loadingIntelligence}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', loadingIntelligence && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card
                  className={cn('cursor-pointer transition-shadow hover:shadow-md', intelligenceTab === 'insider' && 'ring-2 ring-blue-500')}
                  onClick={() => setIntelligenceTab('insider')}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Insider Activity</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {insiderData ? `${insiderData.totalBuys + insiderData.totalSells} txns` : '...'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn('cursor-pointer transition-shadow hover:shadow-md', intelligenceTab === 'analyst' && 'ring-2 ring-blue-500')}
                  onClick={() => setIntelligenceTab('analyst')}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                        <Star className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Analyst Coverage</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {analystData ? analystData.summary.averageRating : '...'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn('cursor-pointer transition-shadow hover:shadow-md', intelligenceTab === 'short' && 'ring-2 ring-blue-500')}
                  onClick={() => setIntelligenceTab('short')}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900">
                        <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Avg Short Interest</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {shortData ? `${shortData.summary.averageShortPercent?.toFixed(1) || '0'}%` : '...'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Intelligence Sub-tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex gap-4">
                  {[
                    { id: 'insider' as const, label: 'Insider Activity', icon: Users },
                    { id: 'analyst' as const, label: 'Analyst Ratings', icon: Star },
                    { id: 'short' as const, label: 'Short Interest', icon: TrendingDown },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setIntelligenceTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                        intelligenceTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {intelligenceTab === 'insider' && 'Insider Trading Activity'}
                    {intelligenceTab === 'analyst' && 'Analyst Ratings & Price Targets'}
                    {intelligenceTab === 'short' && 'Short Interest Analysis'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingIntelligence ? (
                    <div className="flex items-center justify-center py-12">
                      <Loading message="Loading intelligence data..." />
                    </div>
                  ) : (
                    <>
                      {intelligenceTab === 'insider' && insiderData && (
                        <InsiderActivityCard transactions={insiderData.transactions} summaryBySymbol={insiderData.summaryBySymbol} />
                      )}
                      {intelligenceTab === 'analyst' && analystData && (
                        <AnalystRatingsCard ratings={analystData.ratings} summary={analystData.summary} />
                      )}
                      {intelligenceTab === 'short' && shortData && (
                        <ShortInterestCard shortInterest={shortData.shortInterest} summary={shortData.summary} />
                      )}
                      {!loadingIntelligence &&
                        ((intelligenceTab === 'insider' && !insiderData) ||
                          (intelligenceTab === 'analyst' && !analystData) ||
                          (intelligenceTab === 'short' && !shortData)) && (
                          <div className="py-12 text-center text-gray-500 dark:text-gray-400">Click Refresh to load data</div>
                        )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
