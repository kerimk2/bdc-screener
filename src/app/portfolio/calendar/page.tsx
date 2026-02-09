'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Globe,
  RefreshCw,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCcw,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/portfolio/utils';
import { useData } from '@/components/portfolio/providers/data-provider';
import { useFormatCurrency } from '@/components/portfolio/providers/blinding-provider';
import { useAuth } from '@/components/portfolio/providers/auth-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Input } from '@/components/portfolio/ui/input';
import { Modal } from '@/components/portfolio/ui/modal';
import { getFundamentals, FundamentalsData } from '@/lib/portfolio/market-data';
import { EnrichedPosition } from '@/types/portfolio';

// Helper to format date as YYYY-MM-DD in local timezone
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CalendarEvent {
  id: string;
  date: string;
  type: 'earnings' | 'ex_dividend' | 'dividend_pay' | 'economic' | 'investor_day';
  symbol?: string;
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

interface EarningsApiData {
  symbol: string;
  nextEarningsDate: string | null;
  currentQuarterEstimate: number | null;
}

interface EarningsEvent {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  hour: string;
}

interface DividendData {
  symbol: string;
  date: string;
  amount: number;
  payDate: string;
  recordDate: string;
  declarationDate: string;
  currency: string;
  frequency: string;
}

// Major economic events for 2026
const ECONOMIC_EVENTS: Omit<CalendarEvent, 'id'>[] = [
  { date: '2026-01-28', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-03-18', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-05-06', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-06-17', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-07-29', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-09-16', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-11-04', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-12-16', type: 'economic', title: 'FOMC Meeting', description: 'Federal Reserve interest rate decision', importance: 'high' },
  { date: '2026-02-06', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-03-06', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-04-03', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-05-01', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-06-05', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-07-02', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-08-07', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-09-04', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-10-02', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-11-06', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-12-04', type: 'economic', title: 'Jobs Report', description: 'Non-farm payrolls data', importance: 'high' },
  { date: '2026-02-11', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-03-11', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-04-14', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-05-12', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-06-10', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-07-14', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-08-12', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-09-15', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-10-13', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-11-12', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
  { date: '2026-12-10', type: 'economic', title: 'CPI Report', description: 'Consumer Price Index inflation data', importance: 'high' },
];

type MainTab = 'calendar' | 'earnings' | 'dividends';

export default function CalendarPage() {
  const { positions, enrichedPositions, watchlist, loading: dataLoading, toggleDrip, createReinvestment, deleteReinvestment, syncAllDrip } = useData();
  const { isDemo } = useAuth();
  const formatCurrency = useFormatCurrency();

  // Main tab state
  const [mainTab, setMainTab] = useState<MainTab>('calendar');

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [eventFilter, setEventFilter] = useState<'all' | 'earnings' | 'dividends' | 'economic'>('all');
  const [earningsApiData, setEarningsApiData] = useState<EarningsApiData[]>([]);
  const [calendarDividends, setCalendarDividends] = useState<DividendData[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // Earnings tab state
  const [upcomingEarnings, setUpcomingEarnings] = useState<EarningsEvent[]>([]);
  const [pastEarnings, setPastEarnings] = useState<EarningsEvent[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [earningsSubTab, setEarningsSubTab] = useState<'upcoming' | 'past'>('upcoming');

  // Dividends tab state
  const [upcomingDividends, setUpcomingDividends] = useState<DividendData[]>([]);
  const [historicalDividends, setHistoricalDividends] = useState<DividendData[]>([]);
  const [fundamentals, setFundamentals] = useState<Map<string, FundamentalsData>>(new Map());
  const [loadingDividends, setLoadingDividends] = useState(true);
  const [loadingFundamentals, setLoadingFundamentals] = useState(true);
  const [dividendsSubTab, setDividendsSubTab] = useState<'overview' | 'upcoming' | 'history' | 'drip'>('overview');

  // DRIP modal state
  const [showDripModal, setShowDripModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<EnrichedPosition | null>(null);
  const [dripForm, setDripForm] = useState({
    reinvestment_date: new Date().toISOString().split('T')[0],
    dividend_amount: '',
    shares_acquired: '',
    price_per_share: '',
    notes: '',
  });
  const [dripLoading, setDripLoading] = useState(false);
  const [dripError, setDripError] = useState<string | null>(null);
  const [syncingDrip, setSyncingDrip] = useState(false);

  // Get unique symbols
  const symbols = useMemo(() => {
    const uniqueSymbols = new Set<string>();
    positions.forEach(p => {
      if (p.asset_type === 'stock' || p.asset_type === 'etf') {
        uniqueSymbols.add(p.symbol.toUpperCase());
      }
    });
    return Array.from(uniqueSymbols);
  }, [positions]);

  const allSymbols = useMemo(() => {
    const posSymbols = enrichedPositions.map(p => p.symbol);
    const watchSymbols = watchlist.map(w => w.symbol);
    return [...new Set([...posSymbols, ...watchSymbols])];
  }, [enrichedPositions, watchlist]);

  const symbolsKey = useMemo(() => [...allSymbols].sort().join(','), [allSymbols]);

  // Fetch calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (symbols.length === 0) {
        setCalendarLoading(false);
        return;
      }

      setCalendarLoading(true);
      const symbolsParam = symbols.join(',');

      try {
        const [earningsRes, dividendRes] = await Promise.all([
          fetch(`/api/portfolio/market-data/earnings-estimates?symbols=${symbolsParam}`),
          fetch(`/api/portfolio/market-data/dividends?symbols=${symbolsParam}`),
        ]);

        if (earningsRes.ok) {
          const data = await earningsRes.json();
          setEarningsApiData(data.earnings || []);
        }

        if (dividendRes.ok) {
          const data = await dividendRes.json();
          setCalendarDividends(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      } finally {
        setCalendarLoading(false);
      }
    };

    fetchCalendarData();
  }, [symbols]);

  // Fetch earnings data for earnings tab
  useEffect(() => {
    if (mainTab !== 'earnings' || !symbolsKey || dataLoading) return;

    async function fetchEarnings() {
      setLoadingEarnings(true);
      try {
        const [upcomingRes, pastRes] = await Promise.all([
          fetch(`/api/portfolio/market-data/earnings?symbols=${symbolsKey}&range=upcoming`),
          fetch(`/api/portfolio/market-data/earnings?symbols=${symbolsKey}&range=past`),
        ]);

        const upcoming = await upcomingRes.json();
        const past = await pastRes.json();

        setUpcomingEarnings(Array.isArray(upcoming) ? upcoming : []);
        setPastEarnings(Array.isArray(past) ? past : []);
      } catch (error) {
        console.error('Error fetching earnings:', error);
      } finally {
        setLoadingEarnings(false);
      }
    }

    fetchEarnings();
  }, [mainTab, dataLoading, symbolsKey]);

  // Fetch dividends data for dividends tab
  useEffect(() => {
    if (mainTab !== 'dividends' || !symbolsKey || dataLoading) return;

    async function fetchDividends() {
      setLoadingDividends(true);
      try {
        const [upcomingRes, historyRes] = await Promise.all([
          fetch(`/api/portfolio/market-data/dividends?symbols=${symbolsKey}&range=upcoming`),
          fetch(`/api/portfolio/market-data/dividends?symbols=${symbolsKey}&range=history`),
        ]);

        const upcoming = await upcomingRes.json();
        const history = await historyRes.json();

        setUpcomingDividends(Array.isArray(upcoming) ? upcoming : []);
        setHistoricalDividends(Array.isArray(history) ? history : []);
      } catch (error) {
        console.error('Error fetching dividends:', error);
      } finally {
        setLoadingDividends(false);
      }
    }

    fetchDividends();
  }, [mainTab, dataLoading, symbolsKey]);

  // Fetch fundamentals for dividend yields
  useEffect(() => {
    if (mainTab !== 'dividends' || !symbolsKey || dataLoading) return;

    async function fetchFundamentals() {
      setLoadingFundamentals(true);
      try {
        const symbolArray = symbolsKey.split(',');
        const data = await getFundamentals(symbolArray);
        setFundamentals(data);
      } catch (error) {
        console.error('Error fetching fundamentals:', error);
      } finally {
        setLoadingFundamentals(false);
      }
    }

    fetchFundamentals();
  }, [mainTab, dataLoading, symbolsKey]);

  // Build calendar events
  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    for (const earning of earningsApiData) {
      if (earning.nextEarningsDate) {
        allEvents.push({
          id: `earnings-${earning.symbol}`,
          date: earning.nextEarningsDate,
          type: 'earnings',
          symbol: earning.symbol,
          title: `${earning.symbol} Earnings`,
          description: earning.currentQuarterEstimate
            ? `Earnings announcement - Est: $${earning.currentQuarterEstimate.toFixed(2)}`
            : 'Earnings announcement',
          importance: 'high',
        });
      }
    }

    for (const div of calendarDividends) {
      if (div.date) {
        allEvents.push({
          id: `exdiv-${div.symbol}-${div.date}`,
          date: div.date,
          type: 'ex_dividend',
          symbol: div.symbol,
          title: `${div.symbol} Ex-Dividend`,
          description: div.amount ? `Ex-dividend date - $${div.amount.toFixed(2)} per share` : 'Ex-dividend date',
          importance: 'medium',
        });
      }
      if (div.payDate) {
        allEvents.push({
          id: `paydiv-${div.symbol}-${div.payDate}`,
          date: div.payDate,
          type: 'dividend_pay',
          symbol: div.symbol,
          title: `${div.symbol} Dividend Payment`,
          description: div.amount ? `Dividend payment - $${div.amount.toFixed(2)} per share` : 'Dividend payment',
          importance: 'low',
        });
      }
    }

    for (const event of ECONOMIC_EVENTS) {
      allEvents.push({
        ...event,
        id: `econ-${event.date}-${event.title.replace(/\s/g, '-')}`,
      });
    }

    return allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [earningsApiData, calendarDividends]);

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return events;
    if (eventFilter === 'earnings') return events.filter(e => e.type === 'earnings');
    if (eventFilter === 'dividends') return events.filter(e => e.type === 'ex_dividend' || e.type === 'dividend_pay');
    if (eventFilter === 'economic') return events.filter(e => e.type === 'economic');
    return events;
  }, [events, eventFilter]);

  const getEventsForDate = (dateStr: string) => filteredEvents.filter(e => e.date === dateStr);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const formatMonth = (date: Date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const navigateMonth = (direction: number) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const firstDay = getFirstDayOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const daysInPrevMonth = getDaysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, daysInPrevMonth - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  const upcomingListEvents = useMemo(() => {
    const todayStr = formatDateLocal(new Date());
    return filteredEvents.filter(e => e.date >= todayStr).slice(0, 30);
  }, [filteredEvents]);

  const today = formatDateLocal(new Date());

  const eventCounts = useMemo(() => {
    const counts = { earnings: 0, dividends: 0, economic: 0 };
    const todayDate = formatDateLocal(new Date());
    events.forEach(e => {
      if (e.date >= todayDate) {
        if (e.type === 'earnings') counts.earnings++;
        else if (e.type === 'ex_dividend' || e.type === 'dividend_pay') counts.dividends++;
        else if (e.type === 'economic') counts.economic++;
      }
    });
    return counts;
  }, [events]);

  // Earnings helpers
  const isThisWeek = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return date >= weekStart && date < weekEnd;
  };

  const thisWeekEarnings = useMemo(() => upcomingEarnings.filter(e => isThisWeek(e.date)), [upcomingEarnings]);
  const portfolioSymbols = useMemo(() => new Set(enrichedPositions.map(p => p.symbol.toUpperCase())), [enrichedPositions]);

  const getEarningsTimeBadge = (hour: string): string => {
    switch (hour) {
      case 'bmo': return 'BMO';
      case 'amc': return 'AMC';
      default: return 'DMH';
    }
  };

  // Dividend metrics
  const dividendMetrics = useMemo(() => {
    let annualIncome = 0;
    let totalReinvested = 0;
    let totalReinvestedShares = 0;
    const positionDividends: {
      symbol: string;
      shares: number;
      dripShares: number;
      price: number;
      costBasis: number;
      dividendRate: number;
      dividendYield: number;
      forwardYield: number;
      yieldOnCost: number;
      annualIncome: number;
      weight: number;
      dripEnabled: boolean;
      reinvestmentCount: number;
      totalReinvested: number;
      position: EnrichedPosition;
    }[] = [];

    for (const pos of enrichedPositions) {
      const fund = fundamentals.get(pos.symbol.toUpperCase());
      const rateFromApi = fund?.trailingAnnualDividendRate ?? fund?.dividendRate;
      const yieldFromApi = fund?.trailingAnnualDividendYield ?? fund?.dividendYield ?? 0;
      const dividendRateRaw = rateFromApi ?? (yieldFromApi > 0 && pos.currentPrice > 0 ? (yieldFromApi / 100) * pos.currentPrice : 0);
      const dividendYield = yieldFromApi;
      const forwardYield = fund?.dividendYield ?? 0;

      const isUSD = pos.currency === 'USD';
      const hasValidExchangeRate = pos.exchangeRate && pos.exchangeRate > 0 && pos.exchangeRate !== 1;
      const needsConversion = !isUSD && hasValidExchangeRate;
      const dividendRate = needsConversion ? dividendRateRaw * pos.exchangeRate : dividendRateRaw;

      const posAnnualIncome = dividendRate * pos.dripShares;
      const costPerShare = pos.shares > 0 ? pos.cost_basis / pos.shares : 0;
      const yieldOnCost = costPerShare > 0 ? (dividendRate / costPerShare) * 100 : 0;

      annualIncome += posAnnualIncome;

      const posReinvested = pos.reinvestments?.reduce((s, r) => s + r.dividend_amount, 0) || 0;
      const posReinvestedShares = pos.reinvestments?.reduce((s, r) => s + r.shares_acquired, 0) || 0;
      totalReinvested += posReinvested;
      totalReinvestedShares += posReinvestedShares;

      positionDividends.push({
        symbol: pos.symbol,
        shares: pos.shares,
        dripShares: pos.dripShares,
        price: pos.currentPrice,
        costBasis: pos.cost_basis,
        dividendRate,
        dividendYield,
        forwardYield,
        yieldOnCost,
        annualIncome: posAnnualIncome,
        weight: pos.weight,
        dripEnabled: pos.drip_enabled,
        reinvestmentCount: pos.reinvestments?.length || 0,
        totalReinvested: posReinvested,
        position: pos,
      });
    }

    positionDividends.sort((a, b) => b.annualIncome - a.annualIncome);

    const totalValue = enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0);
    const portfolioYield = totalValue > 0 ? (annualIncome / totalValue) * 100 : 0;

    return {
      annualIncome,
      monthlyIncome: annualIncome / 12,
      portfolioYield,
      positionDividends,
      totalReinvested,
      totalReinvestedShares,
      dripPositionCount: positionDividends.filter(p => p.dripEnabled).length,
    };
  }, [enrichedPositions, fundamentals]);

  // DRIP handlers
  const handleToggleDrip = async (position: EnrichedPosition) => {
    if (isDemo) return;
    setSyncingDrip(true);
    try {
      await toggleDrip(position.id, !position.drip_enabled);
    } finally {
      setSyncingDrip(false);
    }
  };

  const handleSyncAllDrip = async () => {
    if (isDemo) return;
    setSyncingDrip(true);
    try {
      await syncAllDrip();
    } finally {
      setSyncingDrip(false);
    }
  };

  const openDripModal = (position: EnrichedPosition) => {
    setSelectedPosition(position);
    setDripForm({ reinvestment_date: new Date().toISOString().split('T')[0], dividend_amount: '', shares_acquired: '', price_per_share: '', notes: '' });
    setDripError(null);
    setShowDripModal(true);
  };

  const handleDripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosition) return;

    const dividendAmount = parseFloat(dripForm.dividend_amount);
    const sharesAcquired = parseFloat(dripForm.shares_acquired);
    const pricePerShare = parseFloat(dripForm.price_per_share);

    if (isNaN(dividendAmount) || dividendAmount <= 0) { setDripError('Enter a valid dividend amount'); return; }
    if (isNaN(sharesAcquired) || sharesAcquired <= 0) { setDripError('Enter a valid number of shares'); return; }
    if (isNaN(pricePerShare) || pricePerShare <= 0) { setDripError('Enter a valid price per share'); return; }

    setDripLoading(true);
    setDripError(null);

    try {
      await createReinvestment({
        position_id: selectedPosition.id,
        symbol: selectedPosition.symbol,
        reinvestment_date: dripForm.reinvestment_date,
        dividend_amount: dividendAmount,
        shares_acquired: sharesAcquired,
        price_per_share: pricePerShare,
        notes: dripForm.notes || null,
      });
      setShowDripModal(false);
    } catch (err) {
      setDripError(err instanceof Error ? err.message : 'Failed to log reinvestment');
    } finally {
      setDripLoading(false);
    }
  };

  const handleDeleteReinvestment = async (id: string) => {
    if (isDemo) return;
    try { await deleteReinvestment(id); } catch (err) { console.error('Failed to delete reinvestment:', err); }
  };

  // UI Helpers
  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'earnings': return <TrendingUp className="h-4 w-4" />;
      case 'ex_dividend':
      case 'dividend_pay': return <DollarSign className="h-4 w-4" />;
      case 'economic': return <Globe className="h-4 w-4" />;
      case 'investor_day': return <Building2 className="h-4 w-4" />;
      default: return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'earnings': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ex_dividend': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'dividend_pay': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'economic': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'investor_day': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events & Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Earnings, dividends, and economic events
          </p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 w-fit">
        {[
          { id: 'calendar' as MainTab, label: 'Calendar', icon: Calendar },
          { id: 'earnings' as MainTab, label: 'Earnings', icon: TrendingUp },
          { id: 'dividends' as MainTab, label: 'Dividends', icon: DollarSign },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              mainTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar Tab */}
      {mainTab === 'calendar' && (
        <>
          {/* Calendar/List toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {[
                { id: 'all', label: 'All Events' },
                { id: 'earnings', label: 'Earnings' },
                { id: 'dividends', label: 'Dividends' },
                { id: 'economic', label: 'Economic' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setEventFilter(tab.id as typeof eventFilter)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    eventFilter === tab.id
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode('month')} className={cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', viewMode === 'month' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}>Calendar</button>
              <button onClick={() => setViewMode('list')} className={cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', viewMode === 'list' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}>List</button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 text-sm text-gray-500"><TrendingUp className="h-4 w-4 text-blue-500" />Upcoming Earnings</div>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{eventCounts.earnings}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 text-sm text-gray-500"><DollarSign className="h-4 w-4 text-green-500" />Dividend Events</div>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{eventCounts.dividends}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-2 text-sm text-gray-500"><Globe className="h-4 w-4 text-orange-500" />Economic Events</div>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{eventCounts.economic}</p>
            </div>
          </div>

          {calendarLoading ? (
            <div className="flex h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : viewMode === 'month' ? (
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                <button onClick={() => navigateMonth(-1)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="h-5 w-5" /></button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{formatMonth(currentDate)}</h2>
                <button onClick={() => navigateMonth(1)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map(({ date, isCurrentMonth }, index) => {
                  const dateStr = formatDateLocal(date);
                  const dayEvents = getEventsForDate(dateStr);
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDate;
                  return (
                    <div key={index} onClick={() => setSelectedDate(dateStr)} className={cn('min-h-24 cursor-pointer border-b border-r border-gray-100 p-2 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800', !isCurrentMonth && 'bg-gray-50/50 dark:bg-gray-900/50', isSelected && 'bg-blue-50 dark:bg-blue-900/20')}>
                      <div className={cn('mb-1 text-sm font-medium', isToday ? 'flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600')}>{date.getDate()}</div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className={cn('flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs', getEventColor(event.type))} title={`${event.title}: ${event.description}`}>
                            {getEventIcon(event.type)}
                            <span className="truncate">{event.symbol || event.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div className="text-xs text-gray-500">+{dayEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {upcomingListEvents.length === 0 ? (
                  <div className="p-12 text-center"><CalendarIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" /><p className="mt-4 text-gray-500">No upcoming events</p></div>
                ) : (
                  upcomingListEvents.map((event) => {
                    const eventDate = new Date(event.date);
                    const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={event.id} className="flex items-center gap-4 p-4">
                        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full', getEventColor(event.type))}>{getEventIcon(event.type)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">{event.symbol && <span className="font-semibold text-gray-900 dark:text-white">{event.symbol}</span>}<span className="text-sm text-gray-600 dark:text-gray-400">{event.title}</span></div>
                          <p className="text-sm text-gray-500">{event.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          <p className={cn('text-xs', daysUntil <= 1 ? 'text-red-500' : daysUntil <= 7 ? 'text-orange-500' : 'text-gray-500')}>{daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {selectedDate && viewMode === 'month' && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Events for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <div className="space-y-3">
                {getEventsForDate(selectedDate).length === 0 ? <p className="text-sm text-gray-500">No events on this date</p> : getEventsForDate(selectedDate).map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', getEventColor(event.type))}>{getEventIcon(event.type)}</div>
                    <div><p className="font-medium text-gray-900 dark:text-white">{event.symbol ? `${event.symbol} - ` : ''}{event.title}</p><p className="text-sm text-gray-500">{event.description}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Earnings Tab */}
      {mainTab === 'earnings' && (
        <>
          {thisWeekEarnings.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Earnings This Week</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {thisWeekEarnings.map((e, i) => (
                        <span key={`${e.symbol}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          {e.symbol}
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">{new Date(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900"><CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Upcoming (90 days)</p><p className="text-xl font-bold text-gray-900 dark:text-white">{loadingEarnings ? '...' : upcomingEarnings.length}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900"><Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">This Week</p><p className="text-xl font-bold text-gray-900 dark:text-white">{loadingEarnings ? '...' : thisWeekEarnings.length}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900"><TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Past Year Reports</p><p className="text-xl font-bold text-gray-900 dark:text-white">{loadingEarnings ? '...' : pastEarnings.length}</p></div></div></Card>
          </div>

          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 w-fit">
            {(['upcoming', 'past'] as const).map((tab) => (
              <button key={tab} onClick={() => setEarningsSubTab(tab)} className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors capitalize', earningsSubTab === tab ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white')}>{tab === 'upcoming' ? 'Upcoming' : 'Past Earnings'}</button>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>{earningsSubTab === 'upcoming' ? 'Upcoming Earnings' : 'Past Earnings'}</CardTitle><CardDescription>{earningsSubTab === 'upcoming' ? 'Next 90 days' : 'Last 12 months'}</CardDescription></CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                        <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                        <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Time</th>
                        <th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">EPS Est.</th>
                        {earningsSubTab === 'past' && (<><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">EPS Actual</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Surprise</th></>)}
                        <th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(earningsSubTab === 'upcoming' ? upcomingEarnings : [...pastEarnings].reverse()).map((event, index) => {
                        const isPortfolioHolding = portfolioSymbols.has(event.symbol.toUpperCase());
                        const surprise = event.epsActual !== null && event.epsEstimate !== null && event.epsEstimate !== 0 ? ((event.epsActual - event.epsEstimate) / Math.abs(event.epsEstimate)) * 100 : null;
                        const beat = surprise !== null ? surprise > 0 : null;
                        return (
                          <tr key={`${event.symbol}-${event.date}-${index}`} className={cn('border-b border-gray-100 dark:border-gray-800', isThisWeek(event.date) && earningsSubTab === 'upcoming' && 'bg-yellow-50 dark:bg-yellow-950/30')}>
                            <td className="py-3"><div className="flex items-center gap-2"><span className="font-medium text-gray-900 dark:text-white">{event.symbol}</span>{isPortfolioHolding && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">Held</span>}</div></td>
                            <td className="py-3 text-gray-600 dark:text-gray-300">{new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td className="py-3"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">{getEarningsTimeBadge(event.hour)}</span></td>
                            <td className="py-3 text-right text-gray-600 dark:text-gray-300">{event.epsEstimate !== null ? `$${event.epsEstimate.toFixed(2)}` : '—'}</td>
                            {earningsSubTab === 'past' && (<><td className="py-3 text-right font-medium text-gray-900 dark:text-white">{event.epsActual !== null ? `$${event.epsActual.toFixed(2)}` : '—'}</td><td className={cn('py-3 text-right font-medium', beat === true ? 'text-green-600 dark:text-green-400' : beat === false ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>{surprise !== null ? (<span className="flex items-center justify-end gap-1">{beat ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{surprise >= 0 ? '+' : ''}{surprise.toFixed(1)}%</span>) : '—'}</td></>)}
                            <td className="py-3 text-gray-500 dark:text-gray-400 text-xs">{isPortfolioHolding ? 'Portfolio' : 'Watchlist'}</td>
                          </tr>
                        );
                      })}
                      {(earningsSubTab === 'upcoming' ? upcomingEarnings : pastEarnings).length === 0 && (
                        <tr><td colSpan={earningsSubTab === 'past' ? 7 : 5} className="py-8 text-center text-gray-500 dark:text-gray-400">{earningsSubTab === 'upcoming' ? 'No upcoming earnings found' : 'No past earnings data available'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dividends Tab */}
      {mainTab === 'dividends' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900"><DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Annual Income</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(dividendMetrics.annualIncome)}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900"><Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Monthly Income</p><p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(dividendMetrics.monthlyIncome)}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900"><TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Portfolio Yield</p><p className="text-xl font-bold text-gray-900 dark:text-white">{dividendMetrics.portfolioYield.toFixed(2)}%</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900"><Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Upcoming Ex-Dates</p><p className="text-xl font-bold text-gray-900 dark:text-white">{loadingDividends ? '...' : upcomingDividends.length}</p></div></div></Card>
          </div>

          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 w-fit">
            {(['overview', 'drip', 'upcoming', 'history'] as const).map((tab) => (
              <button key={tab} onClick={() => setDividendsSubTab(tab)} className={cn('rounded-md px-4 py-2 text-sm font-medium transition-colors capitalize', dividendsSubTab === tab ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white')}>{tab === 'overview' ? 'Position Yields' : tab === 'drip' ? 'DRIP' : tab === 'upcoming' ? 'Upcoming Ex-Dates' : 'History'}</button>
            ))}
          </div>

          {dividendsSubTab === 'overview' && (
            <Card>
              <CardHeader><CardTitle>Position Dividend Details</CardTitle><CardDescription>Dividend yield and income by position</CardDescription></CardHeader>
              <CardContent>
                {loadingFundamentals ? <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Shares</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Div/Share</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Trailing Yield</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Yield on Cost</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Annual Income</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Weight</th></tr></thead>
                      <tbody>
                        {dividendMetrics.positionDividends.map((pos) => (
                          <tr key={pos.symbol} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-3 font-medium text-gray-900 dark:text-white">{pos.symbol}</td>
                            <td className="py-3 text-right text-gray-600 dark:text-gray-300">{pos.shares.toLocaleString()}</td>
                            <td className="py-3 text-right text-gray-600 dark:text-gray-300">{pos.dividendRate > 0 ? `$${pos.dividendRate.toFixed(2)}` : '—'}</td>
                            <td className="py-3 text-right text-gray-600 dark:text-gray-300">{pos.dividendYield > 0 ? `${pos.dividendYield.toFixed(2)}%` : '—'}</td>
                            <td className={cn('py-3 text-right', pos.yieldOnCost > pos.dividendYield ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300')}>{pos.yieldOnCost > 0 ? `${pos.yieldOnCost.toFixed(2)}%` : '—'}</td>
                            <td className="py-3 text-right font-medium text-gray-900 dark:text-white">{pos.annualIncome > 0 ? formatCurrency(pos.annualIncome) : '—'}</td>
                            <td className="py-3 text-right text-gray-500 dark:text-gray-400">{pos.weight.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-gray-300 dark:border-gray-600"><td className="pt-3 font-bold text-gray-900 dark:text-white" colSpan={5}>Total</td><td className="pt-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(dividendMetrics.annualIncome)}</td><td className="pt-3 text-right text-gray-500 dark:text-gray-400">100%</td></tr></tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dividendsSubTab === 'drip' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Dividend Reinvestment (DRIP)</CardTitle><CardDescription>Toggle DRIP on to auto-track reinvested dividends</CardDescription></div>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={handleSyncAllDrip} disabled={isDemo || syncingDrip || dividendMetrics.dripPositionCount === 0} className="gap-2"><RefreshCcw className={cn('h-4 w-4', syncingDrip && 'animate-spin')} />{syncingDrip ? 'Syncing...' : 'Sync All'}</Button>
                    <div className="text-right"><div className="text-sm text-gray-500 dark:text-gray-400">Total Reinvested</div><div className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(dividendMetrics.totalReinvested)}</div><div className="text-xs text-gray-400">{dividendMetrics.totalReinvestedShares.toFixed(4)} shares</div></div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {dividendMetrics.positionDividends.length === 0 ? <div className="py-8 text-center text-gray-500 dark:text-gray-400">No positions to show</div> : (
                  <div className="space-y-4">
                    {dividendMetrics.positionDividends.map((pos) => (
                      <div key={pos.symbol} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900 dark:text-white">{pos.symbol}</span>
                            <button onClick={() => handleToggleDrip(pos.position)} disabled={isDemo || syncingDrip} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors', pos.dripEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', (isDemo || syncingDrip) && 'cursor-not-allowed opacity-50')}>{pos.dripEnabled ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}{syncingDrip ? 'Syncing...' : pos.dripEnabled ? 'DRIP On' : 'DRIP Off'}</button>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openDripModal(pos.position)} disabled={isDemo} className="gap-1"><Plus className="h-3 w-3" />Log Reinvestment</Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div><div className="text-gray-500 dark:text-gray-400">Original Shares</div><div className="font-medium text-gray-900 dark:text-white">{pos.shares.toLocaleString()}</div></div>
                          <div><div className="text-gray-500 dark:text-gray-400">DRIP Shares</div><div className="font-medium text-green-600 dark:text-green-400">+{(pos.dripShares - pos.shares).toFixed(4)}</div></div>
                          <div><div className="text-gray-500 dark:text-gray-400">Total Shares</div><div className="font-medium text-gray-900 dark:text-white">{pos.dripShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div></div>
                          <div><div className="text-gray-500 dark:text-gray-400">Total Reinvested</div><div className="font-medium text-gray-900 dark:text-white">{formatCurrency(pos.totalReinvested)}</div></div>
                        </div>
                        {pos.position.reinvestments && pos.position.reinvestments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Reinvestment History ({pos.reinvestmentCount})</div>
                            <div className="space-y-1">
                              {pos.position.reinvestments.slice(0, 5).map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1">
                                  <div className="flex items-center gap-3"><span className="text-gray-500">{new Date(r.reinvestment_date).toLocaleDateString()}</span><span className="text-green-600 dark:text-green-400">+{r.shares_acquired.toFixed(4)} shares</span><span className="text-gray-400">@ ${r.price_per_share.toFixed(2)}</span></div>
                                  <div className="flex items-center gap-2"><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(r.dividend_amount)}</span>{!isDemo && <button onClick={() => handleDeleteReinvestment(r.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-3 w-3" /></button>}</div>
                                </div>
                              ))}
                              {pos.position.reinvestments.length > 5 && <div className="text-xs text-gray-400 text-center py-1">+{pos.position.reinvestments.length - 5} more</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dividendsSubTab === 'upcoming' && (
            <Card>
              <CardHeader><CardTitle>Upcoming Ex-Dividend Dates</CardTitle><CardDescription>Dividend events in the next 6 months</CardDescription></CardHeader>
              <CardContent>
                {loadingDividends ? <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div> : upcomingDividends.length === 0 ? <div className="py-8 text-center text-gray-500 dark:text-gray-400">No upcoming ex-dividend dates found</div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Ex-Date</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Amount</th><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Pay Date</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Your Income</th></tr></thead>
                      <tbody>
                        {upcomingDividends.map((div, index) => {
                          const position = enrichedPositions.find(p => p.symbol.toUpperCase() === div.symbol.toUpperCase());
                          const divIsUSD = div.currency === 'USD';
                          const exchangeRate = position?.exchangeRate || 1;
                          const hasValidRate = exchangeRate > 0 && exchangeRate !== 1;
                          const amountInUSD = (!divIsUSD && hasValidRate) ? div.amount * exchangeRate : div.amount;
                          const yourIncome = position ? amountInUSD * position.shares : 0;
                          return (
                            <tr key={`${div.symbol}-${div.date}-${index}`} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-3 font-medium text-gray-900 dark:text-white">{div.symbol}</td>
                              <td className="py-3 text-gray-600 dark:text-gray-300">{new Date(div.date).toLocaleDateString()}</td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">{divIsUSD ? `$${div.amount.toFixed(4)}` : `${div.currency} ${div.amount.toFixed(2)}`}</td>
                              <td className="py-3 text-gray-600 dark:text-gray-300">{div.payDate ? new Date(div.payDate).toLocaleDateString() : '—'}</td>
                              <td className="py-3 text-right font-medium text-green-600 dark:text-green-400">{yourIncome > 0 ? formatCurrency(yourIncome) : '—'}</td>
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

          {dividendsSubTab === 'history' && (
            <Card>
              <CardHeader><CardTitle>Dividend History</CardTitle><CardDescription>Past dividend payments (last 12 months)</CardDescription></CardHeader>
              <CardContent>
                {loadingDividends ? <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div> : historicalDividends.length === 0 ? <div className="py-8 text-center text-gray-500 dark:text-gray-400">No dividend history found</div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Symbol</th><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Ex-Date</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Amount</th><th className="pb-3 text-left font-medium text-gray-500 dark:text-gray-400">Pay Date</th><th className="pb-3 text-right font-medium text-gray-500 dark:text-gray-400">Your Income</th></tr></thead>
                      <tbody>
                        {[...historicalDividends].reverse().map((div, index) => {
                          const position = enrichedPositions.find(p => p.symbol.toUpperCase() === div.symbol.toUpperCase());
                          const divIsUSD = div.currency === 'USD';
                          const exchangeRate = position?.exchangeRate || 1;
                          const hasValidRate = exchangeRate > 0 && exchangeRate !== 1;
                          const amountInUSD = (!divIsUSD && hasValidRate) ? div.amount * exchangeRate : div.amount;
                          const yourIncome = position ? amountInUSD * position.shares : 0;
                          return (
                            <tr key={`${div.symbol}-${div.date}-${index}`} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-3 font-medium text-gray-900 dark:text-white">{div.symbol}</td>
                              <td className="py-3 text-gray-600 dark:text-gray-300">{new Date(div.date).toLocaleDateString()}</td>
                              <td className="py-3 text-right text-gray-600 dark:text-gray-300">{divIsUSD ? `$${div.amount.toFixed(4)}` : `${div.currency} ${div.amount.toFixed(2)}`}</td>
                              <td className="py-3 text-gray-600 dark:text-gray-300">{div.payDate ? new Date(div.payDate).toLocaleDateString() : '—'}</td>
                              <td className="py-3 text-right font-medium text-green-600 dark:text-green-400">{yourIncome > 0 ? formatCurrency(yourIncome) : '—'}</td>
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
        </>
      )}

      {/* DRIP Modal */}
      <Modal isOpen={showDripModal} onClose={() => setShowDripModal(false)} title={`Log DRIP for ${selectedPosition?.symbol}`}>
        <form onSubmit={handleDripSubmit} className="space-y-4">
          {dripError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">{dripError}</div>}
          <Input label="Reinvestment Date" type="date" value={dripForm.reinvestment_date} onChange={(e) => setDripForm({ ...dripForm, reinvestment_date: e.target.value })} required />
          <Input label="Dividend Amount ($)" type="number" step="0.01" placeholder="e.g., 25.50" value={dripForm.dividend_amount} onChange={(e) => setDripForm({ ...dripForm, dividend_amount: e.target.value })} required />
          <Input label="Shares Acquired" type="number" step="0.0001" placeholder="e.g., 0.1234" value={dripForm.shares_acquired} onChange={(e) => setDripForm({ ...dripForm, shares_acquired: e.target.value })} required />
          <Input label="Price Per Share ($)" type="number" step="0.01" placeholder="e.g., 175.00" value={dripForm.price_per_share} onChange={(e) => setDripForm({ ...dripForm, price_per_share: e.target.value })} required />
          <Input label="Notes (optional)" type="text" placeholder="Any notes" value={dripForm.notes} onChange={(e) => setDripForm({ ...dripForm, notes: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowDripModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={dripLoading} className="flex-1">{dripLoading ? 'Saving...' : 'Save Reinvestment'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
