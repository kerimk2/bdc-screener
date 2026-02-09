'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Account,
  Position,
  WatchlistItem,
  EnrichedPosition,
  Quote,
  AssetMetadata,
  DividendReinvestment,
} from '@/types/portfolio';
import * as db from '@/lib/portfolio/supabase';
import { getQuotes, getCompanyProfile, getRegionFromCountry, getDividendHistory, getHistoricalPriceOnDate } from '@/lib/portfolio/market-data';
import { useAuth, DEMO_EMAIL } from '@/components/portfolio/providers/auth-provider';

interface DataContextType {
  // Data
  accounts: Account[];
  positions: Position[];
  enrichedPositions: EnrichedPosition[];
  watchlist: WatchlistItem[];
  quotes: Map<string, Quote>;
  metadata: Map<string, AssetMetadata>;
  reinvestments: DividendReinvestment[];

  // Loading states
  loading: boolean;
  refreshing: boolean;

  // Actions
  refreshData: () => Promise<void>;
  refreshQuotes: () => Promise<void>;

  // Account actions
  createAccount: (data: { name: string; type: string; cash_balance?: number }) => Promise<Account>;
  updateAccount: (id: string, data: { name: string; type: string; cash_balance?: number }) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;

  // Position actions
  createPosition: (data: {
    account_id: string;
    symbol: string;
    asset_type: string;
    shares: number;
    cost_basis: number;
    purchase_date: string;
    notes?: string | null;
    manual_sector?: string | null;
    manual_country?: string | null;
  }) => Promise<Position>;
  updatePosition: (id: string, data: Partial<Position>) => Promise<Position>;
  deletePosition: (id: string) => Promise<void>;
  toggleDrip: (id: string, enabled: boolean) => Promise<Position>;

  // Watchlist actions
  addToWatchlist: (data: { symbol: string; target_price?: number | null; notes?: string | null }) => Promise<WatchlistItem>;
  updateWatchlistItem: (id: string, data: { target_price?: number | null; notes?: string | null }) => Promise<WatchlistItem>;
  removeFromWatchlist: (id: string) => Promise<void>;

  // Dividend reinvestment actions
  createReinvestment: (data: {
    position_id: string;
    symbol: string;
    reinvestment_date: string;
    dividend_amount: number;
    shares_acquired: number;
    price_per_share: number;
    notes?: string | null;
  }) => Promise<DividendReinvestment>;
  updateReinvestment: (id: string, data: Partial<DividendReinvestment>) => Promise<DividendReinvestment>;
  deleteReinvestment: (id: string) => Promise<void>;
  syncAllDrip: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

function demoGuard(user: { email?: string } | null): void {
  if (user?.email === DEMO_EMAIL) {
    throw new Error('Demo account is read-only. Sign up for a free account to manage your own portfolio.');
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [metadata, setMetadata] = useState<Map<string, AssetMetadata>>(new Map());
  const [reinvestments, setReinvestments] = useState<DividendReinvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Refs for accessing current state in stable callbacks without re-creating them
  const userRef = useRef(user);
  userRef.current = user;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  const reinvestmentsRef = useRef(reinvestments);
  reinvestmentsRef.current = reinvestments;

  // Fetch metadata for a symbol (stable — reads state via ref)
  const fetchMetadata = useCallback(async (symbol: string): Promise<AssetMetadata | null> => {
    if (metadataRef.current.has(symbol)) return null;

    // Check database
    try {
      const dbMetadata = await db.getAssetMetadata(symbol);
      if (dbMetadata) {
        setMetadata(prev => new Map(prev).set(symbol, dbMetadata));
        return dbMetadata;
      }
    } catch (error) {
      console.error(`Error fetching metadata for ${symbol}:`, error);
    }

    // Fetch from API and save
    try {
      const profile = await getCompanyProfile(symbol);
      if (profile) {
        const newMetadata: AssetMetadata = {
          symbol,
          name: profile.companyName,
          sector: profile.sector || null,
          industry: profile.industry || null,
          country: profile.country || null,
          region: profile.country ? getRegionFromCountry(profile.country) : null,
          market_cap: profile.mktCap || null,
          exchange: profile.exchange || null,
          updated_at: new Date().toISOString(),
        };

        await db.upsertAssetMetadata(newMetadata);
        setMetadata(prev => new Map(prev).set(symbol, newMetadata));
        return newMetadata;
      }
    } catch (error) {
      console.error(`Error fetching profile for ${symbol}:`, error);
    }

    return null;
  }, []);

  // Refresh quotes for all positions (stable — reads state via refs)
  const refreshQuotes = useCallback(async () => {
    const symbols = [
      ...new Set([
        ...positionsRef.current.map(p => p.symbol.toUpperCase()),
        ...watchlistRef.current.map(w => w.symbol.toUpperCase()),
      ]),
    ];

    if (symbols.length === 0) return;

    try {
      const newQuotes = await getQuotes(symbols);
      setQuotes(newQuotes);
    } catch (error) {
      console.error('Error refreshing quotes:', error);
    }
  }, []);

  // Calculate enriched positions (memoized to prevent re-render cascades)
  const enrichedPositions: EnrichedPosition[] = useMemo(() => {
    const totalCashBalance = accounts.reduce((sum, a) => sum + (a.cash_balance || 0), 0);

    // Group reinvestments by position_id
    const reinvestmentsByPosition = new Map<string, DividendReinvestment[]>();
    for (const r of reinvestments) {
      const list = reinvestmentsByPosition.get(r.position_id) || [];
      list.push(r);
      reinvestmentsByPosition.set(r.position_id, list);
    }

    const totalPositionsValue = positions.reduce((sum, p) => {
      const q = quotes.get(p.symbol.toUpperCase());
      const priceUSD = q?.priceUSD || q?.price || 0;
      // Include DRIP shares in total value calculation
      const posReinvestments = reinvestmentsByPosition.get(p.id) || [];
      const dripShares = posReinvestments.reduce((s, r) => s + r.shares_acquired, 0);
      return sum + priceUSD * (p.shares + dripShares);
    }, 0);
    const totalValue = totalPositionsValue + totalCashBalance;

    return positions.map(position => {
      const quote = quotes.get(position.symbol.toUpperCase());
      const meta = metadata.get(position.symbol.toUpperCase());
      const posReinvestments = reinvestmentsByPosition.get(position.id) || [];

      // Calculate DRIP totals
      const reinvestedShares = posReinvestments.reduce((s, r) => s + r.shares_acquired, 0);
      const reinvestedAmount = posReinvestments.reduce((s, r) => s + r.dividend_amount, 0);
      const dripShares = position.shares + reinvestedShares;
      const dripCostBasis = position.cost_basis + reinvestedAmount;

      const currentPrice = quote?.price || 0;
      const currentPriceUSD = quote?.priceUSD || quote?.price || 0;
      const currency = quote?.currency || 'USD';
      const exchangeRate = quote?.exchangeRate || 1;

      // Market value includes DRIP shares
      const dripMarketValue = currentPriceUSD * dripShares;
      const marketValue = dripMarketValue; // Use DRIP-adjusted value as primary

      // Gain/loss based on DRIP-adjusted cost basis
      const gainLoss = dripMarketValue - dripCostBasis;
      const gainLossPercent = dripCostBasis > 0 ? (gainLoss / dripCostBasis) * 100 : 0;

      // Total return: market value - original cost (captures full DRIP benefit)
      const totalReturn = dripMarketValue - position.cost_basis;
      const totalReturnPercent = position.cost_basis > 0 ? (totalReturn / position.cost_basis) * 100 : 0;

      const dayChange = quote?.change || 0;
      const dayChangePercent = quote?.changesPercentage || 0;
      const weight = totalValue > 0 ? (dripMarketValue / totalValue) * 100 : 0;

      return {
        ...position,
        currentPrice,
        currentPriceUSD,
        currency,
        exchangeRate,
        marketValue,
        gainLoss,
        gainLossPercent,
        dayChange,
        dayChangePercent,
        weight,
        metadata: meta,
        // DRIP-specific fields
        dripShares,
        dripCostBasis,
        dripMarketValue,
        totalReturn,
        totalReturnPercent,
        reinvestments: posReinvestments,
      };
    });
  }, [positions, quotes, metadata, accounts, reinvestments]);

  // Load all data (stable — uses stable fetchMetadata)
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [accountsData, positionsData, watchlistData, reinvestmentsData] = await Promise.all([
        db.getAccounts(),
        db.getPositions(),
        db.getWatchlist(),
        db.getAllDividendReinvestments(),
      ]);

      setAccounts(accountsData || []);
      setPositions(positionsData || []);
      setWatchlist(watchlistData || []);
      setReinvestments(reinvestmentsData || []);

      const allSymbols = [
        ...new Set([
          ...(positionsData || []).map((p: Position) => p.symbol.toUpperCase()),
          ...(watchlistData || []).map((w: WatchlistItem) => w.symbol.toUpperCase()),
        ]),
      ];

      if (allSymbols.length > 0) {
        // Fetch quotes and metadata in parallel (not sequential)
        const [newQuotes] = await Promise.all([
          getQuotes(allSymbols),
          // Batch metadata fetching - run all in parallel
          Promise.all(allSymbols.map(symbol => fetchMetadata(symbol))),
        ]);
        setQuotes(newQuotes);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMetadata]);

  // Initial load (re-fetch when user changes)
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user?.id, refreshData]);

  // Auto-refresh quotes every minute (stable interval — refreshQuotes is stable)
  useEffect(() => {
    const interval = setInterval(refreshQuotes, 60000);
    return () => clearInterval(interval);
  }, [refreshQuotes]);

  // Account actions (stable via useCallback)
  const createAccount = useCallback(async (data: { name: string; type: string; cash_balance?: number }) => {
    demoGuard(userRef.current);
    const account = await db.createAccount(data);
    setAccounts(prev => [...prev, account]);
    return account;
  }, []);

  const updateAccount = useCallback(async (id: string, data: { name: string; type: string; cash_balance?: number }) => {
    demoGuard(userRef.current);
    const account = await db.updateAccount(id, data);
    setAccounts(prev => prev.map(a => (a.id === id ? account : a)));
    return account;
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    demoGuard(userRef.current);
    await db.deleteAccount(id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    setPositions(prev => prev.filter(p => p.account_id !== id));
  }, []);

  // Position actions (stable via useCallback)
  const createPosition = useCallback(async (data: {
    account_id: string;
    symbol: string;
    asset_type: string;
    shares: number;
    cost_basis: number;
    purchase_date: string;
    notes?: string | null;
    manual_sector?: string | null;
    manual_country?: string | null;
  }) => {
    demoGuard(userRef.current);
    const position = await db.createPosition(data);
    setPositions(prev => [...prev, position]);

    // Fetch quotes and metadata in background — don't block position creation
    const symbol = data.symbol.toUpperCase();
    getQuotes([symbol])
      .then(newQuotes => {
        setQuotes(prev => {
          const updated = new Map(prev);
          const quote = newQuotes.get(symbol);
          if (quote) updated.set(symbol, quote);
          return updated;
        });
      })
      .catch(err => console.error(`Error fetching quote for ${symbol}:`, err));
    fetchMetadata(symbol).catch(err => console.error(`Error fetching metadata for ${symbol}:`, err));

    return position;
  }, [fetchMetadata]);

  const updatePosition = useCallback(async (id: string, data: Partial<Position>) => {
    demoGuard(userRef.current);
    const position = await db.updatePosition(id, data);
    setPositions(prev => prev.map(p => (p.id === id ? position : p)));
    return position;
  }, []);

  const deletePosition = useCallback(async (id: string) => {
    demoGuard(userRef.current);
    await db.deletePosition(id);
    setPositions(prev => prev.filter(p => p.id !== id));
    // Also remove any reinvestments for this position
    setReinvestments(prev => prev.filter(r => r.position_id !== id));
  }, []);

  // Auto-sync DRIP reinvestments for a position based on dividend history
  const syncDripForPosition = useCallback(async (position: Position) => {
    try {
      // Fetch dividend history for this symbol
      const dividendHistory = await getDividendHistory(position.symbol);
      if (dividendHistory.length === 0) return;

      // Get existing reinvestments for this position to avoid duplicates
      const existingReinvestments = reinvestmentsRef.current.filter(
        r => r.position_id === position.id
      );
      const existingDates = new Set(existingReinvestments.map(r => r.reinvestment_date));

      // Filter to dividends paid after purchase date
      const purchaseDate = new Date(position.purchase_date);
      const relevantDividends = dividendHistory.filter(d => {
        const payDate = new Date(d.paymentDate || d.date);
        return payDate >= purchaseDate && !existingDates.has(d.paymentDate || d.date);
      });

      if (relevantDividends.length === 0) return;

      // Calculate shares at each dividend date (original shares + previous DRIP shares)
      let cumulativeShares = position.shares;

      // Sort dividends by date ascending
      const sortedDividends = [...relevantDividends].sort(
        (a, b) => new Date(a.paymentDate || a.date).getTime() - new Date(b.paymentDate || b.date).getTime()
      );

      for (const div of sortedDividends) {
        const payDate = div.paymentDate || div.date;

        // Get historical price on payment date
        const priceOnDate = await getHistoricalPriceOnDate(position.symbol, payDate);
        if (!priceOnDate || priceOnDate <= 0) continue;

        // Calculate dividend amount and shares acquired
        const dividendAmount = div.amount * cumulativeShares;
        const sharesAcquired = dividendAmount / priceOnDate;

        // Create the reinvestment record
        const reinvestment = await db.createDividendReinvestment({
          position_id: position.id,
          symbol: position.symbol,
          reinvestment_date: payDate,
          dividend_amount: dividendAmount,
          shares_acquired: sharesAcquired,
          price_per_share: priceOnDate,
          notes: 'Auto-synced from dividend history',
        });

        setReinvestments(prev => [...prev, reinvestment]);

        // Add to cumulative shares for next dividend calculation
        cumulativeShares += sharesAcquired;
      }
    } catch (error) {
      console.error(`Error syncing DRIP for ${position.symbol}:`, error);
    }
  }, []);

  const toggleDrip = useCallback(async (id: string, enabled: boolean) => {
    demoGuard(userRef.current);
    const position = await db.updatePosition(id, { drip_enabled: enabled });
    setPositions(prev => prev.map(p => (p.id === id ? position : p)));

    // If enabling DRIP, auto-sync reinvestments from dividend history
    if (enabled) {
      await syncDripForPosition(position);
    }

    return position;
  }, [syncDripForPosition]);

  // Sync DRIP for all positions with DRIP enabled
  const syncAllDrip = useCallback(async () => {
    demoGuard(userRef.current);
    const dripPositions = positionsRef.current.filter(p => p.drip_enabled);
    for (const position of dripPositions) {
      await syncDripForPosition(position);
    }
  }, [syncDripForPosition]);

  // Watchlist actions (stable via useCallback)
  const addToWatchlist = useCallback(async (data: { symbol: string; target_price?: number | null; notes?: string | null }) => {
    demoGuard(userRef.current);
    const item = await db.addToWatchlist(data);
    setWatchlist(prev => [...prev, item]);

    // Fetch quotes in background — don't block watchlist addition
    const symbol = data.symbol.toUpperCase();
    getQuotes([symbol])
      .then(newQuotes => {
        setQuotes(prev => {
          const updated = new Map(prev);
          const quote = newQuotes.get(symbol);
          if (quote) updated.set(symbol, quote);
          return updated;
        });
      })
      .catch(err => console.error(`Error fetching quote for ${symbol}:`, err));

    return item;
  }, []);

  const updateWatchlistItem = useCallback(async (id: string, data: { target_price?: number | null; notes?: string | null }) => {
    demoGuard(userRef.current);
    const item = await db.updateWatchlistItem(id, data);
    setWatchlist(prev => prev.map(w => (w.id === id ? item : w)));
    return item;
  }, []);

  const removeFromWatchlist = useCallback(async (id: string) => {
    demoGuard(userRef.current);
    await db.removeFromWatchlist(id);
    setWatchlist(prev => prev.filter(w => w.id !== id));
  }, []);

  // Dividend reinvestment actions (stable via useCallback)
  const createReinvestment = useCallback(async (data: {
    position_id: string;
    symbol: string;
    reinvestment_date: string;
    dividend_amount: number;
    shares_acquired: number;
    price_per_share: number;
    notes?: string | null;
  }) => {
    demoGuard(userRef.current);
    const reinvestment = await db.createDividendReinvestment(data);
    setReinvestments(prev => [...prev, reinvestment]);
    return reinvestment;
  }, []);

  const updateReinvestment = useCallback(async (id: string, data: Partial<DividendReinvestment>) => {
    demoGuard(userRef.current);
    const reinvestment = await db.updateDividendReinvestment(id, data);
    setReinvestments(prev => prev.map(r => (r.id === id ? reinvestment : r)));
    return reinvestment;
  }, []);

  const deleteReinvestment = useCallback(async (id: string) => {
    demoGuard(userRef.current);
    await db.deleteDividendReinvestment(id);
    setReinvestments(prev => prev.filter(r => r.id !== id));
  }, []);

  // Memoize context value to prevent re-rendering all consumers on every provider render
  const contextValue = useMemo<DataContextType>(() => ({
    accounts,
    positions,
    enrichedPositions,
    watchlist,
    quotes,
    metadata,
    reinvestments,
    loading,
    refreshing,
    refreshData,
    refreshQuotes,
    createAccount,
    updateAccount,
    deleteAccount,
    createPosition,
    updatePosition,
    deletePosition,
    toggleDrip,
    addToWatchlist,
    updateWatchlistItem,
    removeFromWatchlist,
    createReinvestment,
    updateReinvestment,
    deleteReinvestment,
    syncAllDrip,
  }), [
    accounts,
    positions,
    enrichedPositions,
    watchlist,
    quotes,
    metadata,
    reinvestments,
    loading,
    refreshing,
    refreshData,
    refreshQuotes,
    createAccount,
    updateAccount,
    deleteAccount,
    createPosition,
    updatePosition,
    deletePosition,
    toggleDrip,
    addToWatchlist,
    updateWatchlistItem,
    removeFromWatchlist,
    createReinvestment,
    updateReinvestment,
    deleteReinvestment,
    syncAllDrip,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
