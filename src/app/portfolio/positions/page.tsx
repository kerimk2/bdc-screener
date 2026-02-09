'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Briefcase,
  Gem,
  Building2,
  Car,
  Palette,
  Lock,
  Calculator,
  AlertTriangle,
  DollarSign,
  X,
  Edit,
} from 'lucide-react';
import { useData } from '@/components/portfolio/providers/data-provider';
import { useAuth } from '@/components/portfolio/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/portfolio/ui/card';
import { Button } from '@/components/portfolio/ui/button';
import { Input, Textarea } from '@/components/portfolio/ui/input';
import { Select } from '@/components/portfolio/ui/select';
import { Modal } from '@/components/portfolio/ui/modal';
import { Loading } from '@/components/portfolio/ui/loading';
import { useFormatCurrency, useBlinding } from '@/components/portfolio/providers/blinding-provider';
import { cn, debounce, getAssetTypeLabel } from '@/lib/portfolio/utils';
import { searchSymbol, getQuote } from '@/lib/portfolio/market-data';
import {
  calculateFixedRiskSize,
  calculateKellySize,
  calculateATRSize,
  calculateATR,
  validatePositionSize,
} from '@/lib/portfolio/position-sizing';
import type { Position, EnrichedPosition, AlternativeAsset, AssetSubtype, PositionSizeResult, Quote } from '@/types/portfolio';

// ============================================
// TYPES
// ============================================

type MainTab = 'positions' | 'alternative' | 'sizing';
type SizingMethod = 'fixed_risk' | 'kelly' | 'atr';

// ============================================
// CONSTANTS
// ============================================

const assetTypes = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Bond' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'option', label: 'Option' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'other', label: 'Other' },
];

const sectorOptions = [
  { value: '', label: 'Auto-detect' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Financial Services', label: 'Financial Services' },
  { value: 'Consumer Cyclical', label: 'Consumer Cyclical' },
  { value: 'Consumer Defensive', label: 'Consumer Defensive' },
  { value: 'Industrials', label: 'Industrials' },
  { value: 'Energy', label: 'Energy' },
  { value: 'Utilities', label: 'Utilities' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Basic Materials', label: 'Basic Materials' },
  { value: 'Communication Services', label: 'Communication Services' },
  { value: 'Fixed Income', label: 'Fixed Income' },
  { value: 'Cash & Equivalents', label: 'Cash & Equivalents' },
  { value: 'Commodities', label: 'Commodities' },
  { value: 'Multi-Asset', label: 'Multi-Asset' },
  { value: 'Index/Broad', label: 'Index/Broad Market' },
  { value: 'Other', label: 'Other' },
];

const countryOptions = [
  { value: '', label: 'Auto-detect' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'AU', label: 'Australia' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'KR', label: 'South Korea' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'Global', label: 'Global/Multi-Region' },
  { value: 'Other', label: 'Other' },
];

const ASSET_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; subtypes: { value: AssetSubtype; label: string }[] }
> = {
  real_estate: {
    label: 'Real Estate',
    icon: Building2,
    subtypes: [
      { value: 'primary_residence', label: 'Primary Residence' },
      { value: 'rental_property', label: 'Rental Property' },
      { value: 'commercial', label: 'Commercial Property' },
      { value: 'land', label: 'Land' },
      { value: 'reit_private', label: 'Private REIT' },
    ],
  },
  vehicle: {
    label: 'Vehicles',
    icon: Car,
    subtypes: [
      { value: 'automobile', label: 'Automobile' },
      { value: 'motorcycle', label: 'Motorcycle' },
      { value: 'boat', label: 'Boat' },
      { value: 'aircraft', label: 'Aircraft' },
      { value: 'rv', label: 'RV' },
    ],
  },
  collectible: {
    label: 'Collectibles',
    icon: Palette,
    subtypes: [
      { value: 'fine_art', label: 'Fine Art' },
      { value: 'wine', label: 'Wine' },
      { value: 'watches', label: 'Watches' },
      { value: 'jewelry', label: 'Jewelry' },
      { value: 'coins', label: 'Coins' },
      { value: 'stamps', label: 'Stamps' },
      { value: 'sports_memorabilia', label: 'Sports Memorabilia' },
      { value: 'antiques', label: 'Antiques' },
      { value: 'nft', label: 'NFT' },
      { value: 'other_collectible', label: 'Other Collectible' },
    ],
  },
  private_investment: {
    label: 'Private Investments',
    icon: Briefcase,
    subtypes: [
      { value: 'private_company', label: 'Private Company' },
      { value: 'angel_investment', label: 'Angel Investment' },
      { value: 'startup_equity', label: 'Startup Equity' },
    ],
  },
  private_fund: {
    label: 'Private Funds',
    icon: Lock,
    subtypes: [
      { value: 'hedge_fund', label: 'Hedge Fund' },
      { value: 'private_equity_fund', label: 'Private Equity Fund' },
      { value: 'venture_capital_fund', label: 'Venture Capital Fund' },
      { value: 'real_estate_fund', label: 'Real Estate Fund' },
    ],
  },
  illiquid: {
    label: 'Illiquid Assets',
    icon: Lock,
    subtypes: [
      { value: 'structured_product', label: 'Structured Product' },
      { value: 'annuity', label: 'Annuity' },
      { value: 'life_insurance_cash_value', label: 'Life Insurance (Cash Value)' },
      { value: 'royalty', label: 'Royalty' },
      { value: 'other_illiquid', label: 'Other Illiquid' },
    ],
  },
};

// ============================================
// FORM INTERFACES
// ============================================

interface PositionFormData {
  account_id: string;
  symbol: string;
  asset_type: string;
  shares: string;
  cost_basis: string;
  purchase_date: string;
  notes: string;
  manual_sector: string;
  manual_country: string;
}

const initialPositionFormData: PositionFormData = {
  account_id: '',
  symbol: '',
  asset_type: 'stock',
  shares: '',
  cost_basis: '',
  purchase_date: new Date().toISOString().split('T')[0],
  notes: '',
  manual_sector: '',
  manual_country: '',
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function PositionsPage() {
  const {
    accounts,
    enrichedPositions,
    loading,
    createPosition,
    updatePosition,
    deletePosition,
    refreshData,
  } = useData();
  const { session } = useAuth();
  const { isBlinded } = useBlinding();
  const formatCurrency = useFormatCurrency();

  const [mainTab, setMainTab] = useState<MainTab>('positions');

  // ============================================
  // POSITIONS TAB STATE
  // ============================================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<EnrichedPosition | null>(null);
  const [formData, setFormData] = useState<PositionFormData>(initialPositionFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [symbolSuggestions, setSymbolSuggestions] = useState<Array<{ symbol: string; name: string; exchangeShortName: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterAccount, setFilterAccount] = useState('all');
  const [sortBy, setSortBy] = useState<'symbol' | 'value' | 'gainLoss' | 'weight'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formError, setFormError] = useState<string | null>(null);

  // ============================================
  // ALTERNATIVE ASSETS TAB STATE
  // ============================================
  const [altAssets, setAltAssets] = useState<(AlternativeAsset & { position?: unknown })[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [showAltModal, setShowAltModal] = useState(false);
  const [editingAltAsset, setEditingAltAsset] = useState<AlternativeAsset | null>(null);
  const [altFormData, setAltFormData] = useState({
    account_id: '',
    asset_type: 'real_estate',
    asset_subtype: 'primary_residence' as AssetSubtype,
    symbol: '',
    current_value: '',
    cost_basis: '',
    purchase_date: new Date().toISOString().split('T')[0],
    valuation_method: 'manual',
    notes: '',
    property_address: '',
    property_type: '',
    square_footage: '',
    rental_income: '',
    mortgage_balance: '',
    make: '',
    model: '',
    year: '',
    mileage: '',
    item_description: '',
    condition: '',
    insurance_value: '',
    fund_name: '',
    company_name: '',
    ownership_percentage: '',
    commitment_amount: '',
    called_amount: '',
    vintage_year: '',
    liquidity_rating: 'illiquid',
    lockup_end_date: '',
  });

  // ============================================
  // POSITION SIZING TAB STATE
  // ============================================
  const [sizingSymbol, setSizingSymbol] = useState('');
  const [sizingSuggestions, setSizingSuggestions] = useState<Array<{ symbol: string; name: string; exchangeShortName: string }>>([]);
  const [showSizingSuggestions, setShowSizingSuggestions] = useState(false);
  const [sizingQuote, setSizingQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('2');
  const [sizingMethod, setSizingMethod] = useState<SizingMethod>('fixed_risk');
  const [winRate, setWinRate] = useState('55');
  const [avgWin, setAvgWin] = useState('10');
  const [avgLoss, setAvgLoss] = useState('5');
  const [atrMultiplier, setAtrMultiplier] = useState('2');
  const [atrValue, setAtrValue] = useState<number | null>(null);
  const [loadingATR, setLoadingATR] = useState(false);
  const [sizingResult, setSizingResult] = useState<PositionSizeResult | null>(null);
  const [sizingValidation, setSizingValidation] = useState<{ isValid: boolean; warnings: string[] } | null>(null);

  const totalPortfolioValue = enrichedPositions.reduce((sum, p) => sum + p.marketValue, 0);

  // ============================================
  // POSITIONS TAB LOGIC
  // ============================================

  // Symbol search for positions
  useEffect(() => {
    if (mainTab !== 'positions') return;
    const search = debounce(async (query: string) => {
      if (query.length >= 1) {
        const results = await searchSymbol(query);
        setSymbolSuggestions(results);
        setShowSuggestions(true);
      } else {
        setSymbolSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    search(formData.symbol);
  }, [formData.symbol, mainTab]);

  const openCreateModal = () => {
    setEditingPosition(null);
    setFormError(null);
    setFormData({
      ...initialPositionFormData,
      account_id: accounts[0]?.id || '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (position: EnrichedPosition) => {
    setEditingPosition(position);
    setFormError(null);
    setFormData({
      account_id: position.account_id,
      symbol: position.symbol,
      asset_type: position.asset_type,
      shares: position.shares.toString(),
      cost_basis: position.cost_basis.toString(),
      purchase_date: position.purchase_date,
      notes: position.notes || '',
      manual_sector: position.manual_sector || '',
      manual_country: position.manual_country || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.account_id || !formData.symbol || !formData.shares || !formData.cost_basis) {
      setFormError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const positionData = {
        account_id: formData.account_id,
        symbol: formData.symbol.toUpperCase(),
        asset_type: formData.asset_type as Position['asset_type'],
        shares: parseFloat(formData.shares),
        cost_basis: parseFloat(formData.cost_basis),
        purchase_date: formData.purchase_date,
        notes: formData.notes || null,
        manual_sector: formData.manual_sector || null,
        manual_country: formData.manual_country || null,
      };

      if (editingPosition) {
        await updatePosition(editingPosition.id, positionData);
      } else {
        await createPosition(positionData);
      }
      setIsModalOpen(false);
      setFormData(initialPositionFormData);
      setEditingPosition(null);
    } catch (error: unknown) {
      console.error('Error saving position:', error);
      let message = 'Failed to save position. Please try logging out and back in.';
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          message = error.message;
        }
        if ('details' in error && typeof error.details === 'string') {
          message += ` (${error.details})`;
        }
      }
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosition(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting position:', error);
    }
  };

  const selectSymbol = (symbol: string) => {
    setFormData(prev => ({ ...prev, symbol: symbol.toUpperCase() }));
    setShowSuggestions(false);
  };

  // Filter and sort positions
  const filteredPositions = enrichedPositions
    .filter(p => filterAccount === 'all' || p.account_id === filterAccount)
    .filter(p =>
      searchQuery === '' ||
      p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.metadata?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'value':
          comparison = a.marketValue - b.marketValue;
          break;
        case 'gainLoss':
          comparison = a.gainLossPercent - b.gainLossPercent;
          break;
        case 'weight':
          comparison = a.weight - b.weight;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // ============================================
  // ALTERNATIVE ASSETS TAB LOGIC
  // ============================================

  const fetchAltAssets = async () => {
    if (!session?.access_token) return;

    try {
      setAltLoading(true);
      const response = await fetch('/api/portfolio/alternative-assets', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAltAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setAltLoading(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'alternative' && altAssets.length === 0 && !altLoading) {
      fetchAltAssets();
    }
  }, [mainTab, session?.access_token]);

  const altTotalValue = useMemo(
    () => altAssets.reduce((sum, a) => sum + (a.current_value || 0), 0),
    [altAssets]
  );

  const assetsByType = useMemo(() => {
    const groups: Record<string, typeof altAssets> = {};
    for (const asset of altAssets) {
      const typeKey = Object.entries(ASSET_TYPE_CONFIG).find(([, config]) =>
        config.subtypes.some((st) => st.value === asset.asset_subtype)
      )?.[0] || 'other';
      if (!groups[typeKey]) groups[typeKey] = [];
      groups[typeKey].push(asset);
    }
    return groups;
  }, [altAssets]);

  const handleAltSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    try {
      const method = editingAltAsset ? 'PUT' : 'POST';
      const body = editingAltAsset
        ? { id: editingAltAsset.id, ...altFormData, add_valuation: true }
        : altFormData;

      const response = await fetch('/api/portfolio/alternative-assets', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...body,
          current_value: parseFloat(altFormData.current_value) || 0,
          cost_basis: parseFloat(altFormData.cost_basis) || parseFloat(altFormData.current_value) || 0,
          square_footage: altFormData.square_footage ? parseInt(altFormData.square_footage) : null,
          rental_income: altFormData.rental_income ? parseFloat(altFormData.rental_income) : null,
          mortgage_balance: altFormData.mortgage_balance ? parseFloat(altFormData.mortgage_balance) : null,
          year: altFormData.year ? parseInt(altFormData.year) : null,
          mileage: altFormData.mileage ? parseInt(altFormData.mileage) : null,
          insurance_value: altFormData.insurance_value ? parseFloat(altFormData.insurance_value) : null,
          ownership_percentage: altFormData.ownership_percentage ? parseFloat(altFormData.ownership_percentage) : null,
          commitment_amount: altFormData.commitment_amount ? parseFloat(altFormData.commitment_amount) : null,
          called_amount: altFormData.called_amount ? parseFloat(altFormData.called_amount) : null,
          vintage_year: altFormData.vintage_year ? parseInt(altFormData.vintage_year) : null,
        }),
      });

      if (response.ok) {
        setShowAltModal(false);
        setEditingAltAsset(null);
        fetchAltAssets();
        refreshData();
      }
    } catch (error) {
      console.error('Failed to save asset:', error);
    }
  };

  const handleAltDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/portfolio/alternative-assets?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        fetchAltAssets();
        refreshData();
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const formatAltValue = (value: number) => {
    if (isBlinded) return '••••••';
    return `$${value.toLocaleString()}`;
  };

  const getSubtypeLabel = (subtype: AssetSubtype) => {
    for (const config of Object.values(ASSET_TYPE_CONFIG)) {
      const found = config.subtypes.find((st) => st.value === subtype);
      if (found) return found.label;
    }
    return subtype;
  };

  const getTypeIcon = (subtype: AssetSubtype) => {
    for (const [, config] of Object.entries(ASSET_TYPE_CONFIG)) {
      if (config.subtypes.some((st) => st.value === subtype)) {
        return config.icon;
      }
    }
    return Gem;
  };

  const resetAltForm = () => {
    setAltFormData({
      account_id: accounts[0]?.id || '',
      asset_type: 'real_estate',
      asset_subtype: 'primary_residence',
      symbol: '',
      current_value: '',
      cost_basis: '',
      purchase_date: new Date().toISOString().split('T')[0],
      valuation_method: 'manual',
      notes: '',
      property_address: '',
      property_type: '',
      square_footage: '',
      rental_income: '',
      mortgage_balance: '',
      make: '',
      model: '',
      year: '',
      mileage: '',
      item_description: '',
      condition: '',
      insurance_value: '',
      fund_name: '',
      company_name: '',
      ownership_percentage: '',
      commitment_amount: '',
      called_amount: '',
      vintage_year: '',
      liquidity_rating: 'illiquid',
      lockup_end_date: '',
    });
  };

  // ============================================
  // POSITION SIZING TAB LOGIC
  // ============================================

  // Symbol search for sizing
  useEffect(() => {
    if (mainTab !== 'sizing') return;
    const search = debounce(async (query: string) => {
      if (query.length >= 1) {
        const results = await searchSymbol(query);
        setSizingSuggestions(results);
        setShowSizingSuggestions(true);
      } else {
        setSizingSuggestions([]);
        setShowSizingSuggestions(false);
      }
    }, 300);

    search(sizingSymbol);
  }, [sizingSymbol, mainTab]);

  const selectSizingSymbol = async (selectedSymbol: string) => {
    setSizingSymbol(selectedSymbol.toUpperCase());
    setShowSizingSuggestions(false);
    setLoadingQuote(true);

    try {
      const quoteData = await getQuote(selectedSymbol);
      setSizingQuote(quoteData);
      if (quoteData) {
        setEntryPrice(quoteData.price.toFixed(2));
      }

      if (sizingMethod === 'atr') {
        fetchATR(selectedSymbol);
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
    } finally {
      setLoadingQuote(false);
    }
  };

  const fetchATR = async (sym: string) => {
    setLoadingATR(true);
    try {
      const response = await fetch(`/api/portfolio/market-data/history?symbol=${sym}`);
      if (response.ok) {
        const data = await response.json();
        if (data.historical && data.historical.length > 14) {
          const highs = data.historical.map((d: { high: number }) => d.high);
          const lows = data.historical.map((d: { low: number }) => d.low);
          const closes = data.historical.map((d: { close: number }) => d.close);
          const atr = calculateATR(highs, lows, closes, 14);
          setAtrValue(atr);
        }
      }
    } catch (error) {
      console.error('Error fetching ATR data:', error);
    } finally {
      setLoadingATR(false);
    }
  };

  const calculateSize = () => {
    if (totalPortfolioValue === 0) return;

    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopLoss);
    const target = targetPrice ? parseFloat(targetPrice) : undefined;
    const risk = parseFloat(riskPercent) / 100;

    if (isNaN(entry) || (sizingMethod !== 'atr' && isNaN(stop))) return;

    const input = {
      portfolioValue: totalPortfolioValue,
      entryPrice: entry,
      stopLoss: sizingMethod === 'atr' ? entry : stop,
      targetPrice: target,
      riskPercent: risk,
      winRate: parseFloat(winRate) / 100,
      avgWin: parseFloat(avgWin) / 100,
      avgLoss: parseFloat(avgLoss) / 100,
      atrValue: atrValue || 0,
      atrMultiplier: parseFloat(atrMultiplier),
    };

    let sizeResult: PositionSizeResult;

    switch (sizingMethod) {
      case 'kelly':
        sizeResult = calculateKellySize(input);
        break;
      case 'atr':
        sizeResult = calculateATRSize(input);
        break;
      default:
        sizeResult = calculateFixedRiskSize(input);
    }

    setSizingResult(sizeResult);
    setSizingValidation(validatePositionSize(sizeResult, totalPortfolioValue));
  };

  useEffect(() => {
    if (mainTab === 'sizing' && entryPrice && (stopLoss || sizingMethod === 'atr')) {
      calculateSize();
    }
  }, [entryPrice, stopLoss, targetPrice, riskPercent, sizingMethod, winRate, avgWin, avgLoss, atrMultiplier, atrValue, mainTab]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return <Loading message="Loading positions..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Positions</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage positions, alternative assets, and calculate position sizes
          </p>
        </div>
        {mainTab === 'positions' && (
          <Button onClick={openCreateModal} disabled={accounts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Position
          </Button>
        )}
        {mainTab === 'alternative' && (
          <button
            onClick={() => {
              resetAltForm();
              setEditingAltAsset(null);
              setShowAltModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {[
            { id: 'positions' as MainTab, label: 'Positions', icon: Briefcase },
            { id: 'alternative' as MainTab, label: 'Alternative Assets', icon: Gem },
            { id: 'sizing' as MainTab, label: 'Position Sizing', icon: Calculator },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                mainTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ============================================ */}
      {/* POSITIONS TAB CONTENT */}
      {/* ============================================ */}
      {mainTab === 'positions' && (
        <>
          {accounts.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Briefcase className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                Create an account first
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                You need at least one account to add positions.
              </p>
              <Button
                className="mt-6"
                onClick={() => (window.location.href = '/accounts')}
              >
                Go to Accounts
              </Button>
            </Card>
          ) : enrichedPositions.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                No positions yet
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Add your first position to start tracking your portfolio.
              </p>
              <Button className="mt-6" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Button>
            </Card>
          ) : (
            <>
              {/* Filters */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search positions..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                    <Select
                      options={[
                        { value: 'all', label: 'All Accounts' },
                        ...accounts.map(a => ({ value: a.id, label: a.name })),
                      ]}
                      value={filterAccount}
                      onChange={e => setFilterAccount(e.target.value)}
                      className="w-48"
                    />
                    <Select
                      options={[
                        { value: 'value', label: 'Sort by Value' },
                        { value: 'gainLoss', label: 'Sort by Gain/Loss' },
                        { value: 'symbol', label: 'Sort by Symbol' },
                        { value: 'weight', label: 'Sort by Weight' },
                      ]}
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as typeof sortBy)}
                      className="w-40"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                    >
                      {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Positions Table */}
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                          <th className="pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Account</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Shares</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Price</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Value</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Cost Basis</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Total Return</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Weight</th>
                          <th className="pb-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPositions.map(position => (
                          <tr key={position.id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-4">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{position.symbol}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {position.metadata?.name || getAssetTypeLabel(position.asset_type)}
                                </p>
                              </div>
                            </td>
                            <td className="py-4">
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {accounts.find(a => a.id === position.account_id)?.name || '-'}
                              </p>
                            </td>
                            <td className="py-4 text-right text-gray-900 dark:text-white">
                              <div>
                                {position.dripShares !== position.shares ? (
                                  <>
                                    <span>{position.dripShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      +{(position.dripShares - position.shares).toFixed(4)} DRIP
                                    </p>
                                  </>
                                ) : (
                                  position.shares.toLocaleString()
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-right text-gray-900 dark:text-white">
                              {formatCurrency(position.currentPrice)}
                            </td>
                            <td className="py-4 text-right font-medium text-gray-900 dark:text-white">
                              {formatCurrency(position.marketValue)}
                            </td>
                            <td className="py-4 text-right text-gray-500 dark:text-gray-400">
                              {formatCurrency(position.cost_basis)}
                            </td>
                            <td className="py-4 text-right">
                              <div>
                                <span className={cn('font-medium', position.totalReturn >= 0 ? 'text-green-500' : 'text-red-500')}>
                                  {position.totalReturn >= 0 ? '+' : ''}{formatCurrency(position.totalReturn)}
                                </span>
                                <p className={cn('text-sm', position.totalReturn >= 0 ? 'text-green-500' : 'text-red-500')}>
                                  {position.totalReturn >= 0 ? '+' : ''}{position.totalReturnPercent.toFixed(2)}%
                                </p>
                                {position.dripShares !== position.shares && (
                                  <p className="text-xs text-gray-400">incl. DRIP</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-right text-gray-900 dark:text-white">
                              {position.weight.toFixed(2)}%
                            </td>
                            <td className="py-4 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => openEditModal(position)}
                                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(position.id)}
                                  className="rounded-lg p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Create/Edit Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingPosition ? 'Edit Position' : 'Add Position'}
            size="lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {formError}
                </div>
              )}

              <Select
                label="Account"
                options={accounts.map(a => ({ value: a.id, label: a.name }))}
                value={formData.account_id}
                onChange={e => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                required
              />

              <div className="relative">
                <Input
                  label="Symbol"
                  placeholder="e.g., AAPL"
                  value={formData.symbol}
                  onChange={e => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  onFocus={() => formData.symbol && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  required
                />
                {showSuggestions && symbolSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {symbolSuggestions.map(s => (
                      <button
                        key={s.symbol}
                        type="button"
                        onClick={() => selectSymbol(s.symbol)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{s.symbol}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{s.name}</p>
                        </div>
                        <span className="text-xs text-gray-400">{s.exchangeShortName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Select
                label="Asset Type"
                options={assetTypes}
                value={formData.asset_type}
                onChange={e => setFormData(prev => ({ ...prev, asset_type: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Sector Override"
                  options={sectorOptions}
                  value={formData.manual_sector}
                  onChange={e => setFormData(prev => ({ ...prev, manual_sector: e.target.value }))}
                />
                <Select
                  label="Country Override"
                  options={countryOptions}
                  value={formData.manual_country}
                  onChange={e => setFormData(prev => ({ ...prev, manual_country: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Shares"
                  type="number"
                  step="any"
                  placeholder="100"
                  value={formData.shares}
                  onChange={e => setFormData(prev => ({ ...prev, shares: e.target.value }))}
                  required
                />
                <Input
                  label="Total Cost Basis"
                  type="number"
                  step="any"
                  placeholder="10000.00"
                  value={formData.cost_basis}
                  onChange={e => setFormData(prev => ({ ...prev, cost_basis: e.target.value }))}
                  required
                />
              </div>

              <Input
                label="Purchase Date"
                type="date"
                value={formData.purchase_date}
                onChange={e => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
                required
              />

              <Textarea
                label="Notes (optional)"
                placeholder="Any notes about this position..."
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingPosition ? 'Save Changes' : 'Add Position'}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={!!deleteConfirm}
            onClose={() => setDeleteConfirm(null)}
            title="Delete Position"
            size="sm"
          >
            <p className="text-gray-600 dark:text-gray-300">
              Are you sure you want to delete this position? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                Delete Position
              </Button>
            </div>
          </Modal>
        </>
      )}

      {/* ============================================ */}
      {/* ALTERNATIVE ASSETS TAB CONTENT */}
      {/* ============================================ */}
      {mainTab === 'alternative' && (
        <>
          {/* Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Alternative Assets</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatAltValue(altTotalValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Assets Tracked</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{altAssets.length}</p>
              </div>
            </div>
          </div>

          {/* Asset list by type */}
          {altLoading ? (
            <div className="text-center py-12 text-gray-500">Loading assets...</div>
          ) : altAssets.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
              <Gem className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">No alternative assets yet</p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                Add real estate, vehicles, art, wine, watches, or other valuable assets
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(assetsByType).map(([typeKey, typeAssets]) => {
                const config = ASSET_TYPE_CONFIG[typeKey];
                const Icon = config?.icon || Gem;
                return (
                  <div key={typeKey}>
                    <div className="mb-3 flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-400" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {config?.label || 'Other'}
                      </h2>
                      <span className="text-sm text-gray-500">({typeAssets.length})</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {typeAssets.map((asset) => {
                        const AssetIcon = getTypeIcon(asset.asset_subtype);
                        return (
                          <div
                            key={asset.id}
                            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                  <AssetIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {asset.item_description || asset.property_address || asset.fund_name || asset.company_name || getSubtypeLabel(asset.asset_subtype)}
                                  </p>
                                  <p className="text-xs text-gray-500">{getSubtypeLabel(asset.asset_subtype)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingAltAsset(asset);
                                  setAltFormData({
                                    ...altFormData,
                                    current_value: asset.current_value?.toString() || '',
                                    valuation_method: asset.valuation_method || 'manual',
                                    notes: asset.notes || '',
                                    property_address: asset.property_address || '',
                                    square_footage: asset.square_footage?.toString() || '',
                                    rental_income: asset.rental_income?.toString() || '',
                                    mortgage_balance: asset.mortgage_balance?.toString() || '',
                                    fund_name: asset.fund_name || '',
                                    company_name: asset.company_name || '',
                                    ownership_percentage: asset.ownership_percentage?.toString() || '',
                                    item_description: asset.item_description || '',
                                    condition: asset.condition || '',
                                    insurance_value: asset.insurance_value?.toString() || '',
                                    liquidity_rating: asset.liquidity_rating || 'illiquid',
                                  });
                                  setShowAltModal(true);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-4">
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatAltValue(asset.current_value)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Last valued: {new Date(asset.value_date).toLocaleDateString()}
                              </p>
                            </div>
                            {(asset.rental_income || asset.liquidity_rating === 'locked') && (
                              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                {asset.rental_income && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {formatAltValue(asset.rental_income)}/mo income
                                  </span>
                                )}
                                {asset.liquidity_rating === 'locked' && asset.lockup_end_date && (
                                  <span className="flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    Locked until {new Date(asset.lockup_end_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => handleAltDelete(asset.id)}
                                className="text-xs text-red-500 hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add/Edit Alternative Asset Modal */}
          {showAltModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingAltAsset ? 'Update Asset' : 'Add Alternative Asset'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAltModal(false);
                      setEditingAltAsset(null);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleAltSubmit} className="space-y-4">
                  {!editingAltAsset && (
                    <>
                      {/* Account */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account</label>
                        <select
                          value={altFormData.account_id}
                          onChange={(e) => setAltFormData({ ...altFormData, account_id: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                          required
                        >
                          <option value="">Select account</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Asset Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Asset Type</label>
                        <select
                          value={altFormData.asset_type}
                          onChange={(e) => {
                            const type = e.target.value;
                            const config = ASSET_TYPE_CONFIG[type];
                            setAltFormData({
                              ...altFormData,
                              asset_type: type,
                              asset_subtype: config?.subtypes[0]?.value || 'other' as AssetSubtype,
                            });
                          }}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        >
                          {Object.entries(ASSET_TYPE_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Subtype */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Specific Type</label>
                        <select
                          value={altFormData.asset_subtype}
                          onChange={(e) => setAltFormData({ ...altFormData, asset_subtype: e.target.value as AssetSubtype })}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        >
                          {ASSET_TYPE_CONFIG[altFormData.asset_type]?.subtypes.map((st) => (
                            <option key={st.value} value={st.value}>{st.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Value ($)</label>
                    <input
                      type="number"
                      value={altFormData.current_value}
                      onChange={(e) => setAltFormData({ ...altFormData, current_value: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {!editingAltAsset && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost Basis ($)</label>
                      <input
                        type="number"
                        value={altFormData.cost_basis}
                        onChange={(e) => setAltFormData({ ...altFormData, cost_basis: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        min="0"
                        step="0.01"
                        placeholder="Leave blank to use current value"
                      />
                    </div>
                  )}

                  {/* Type-specific fields */}
                  {(altFormData.asset_type === 'real_estate' || (editingAltAsset && ['primary_residence', 'rental_property', 'commercial', 'land'].includes(editingAltAsset.asset_subtype))) && (
                    <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Property Details</h3>
                      <input
                        type="text"
                        value={altFormData.property_address}
                        onChange={(e) => setAltFormData({ ...altFormData, property_address: e.target.value })}
                        placeholder="Property Address"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="number"
                          value={altFormData.square_footage}
                          onChange={(e) => setAltFormData({ ...altFormData, square_footage: e.target.value })}
                          placeholder="Square Footage"
                          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        />
                        <input
                          type="number"
                          value={altFormData.rental_income}
                          onChange={(e) => setAltFormData({ ...altFormData, rental_income: e.target.value })}
                          placeholder="Monthly Rental Income"
                          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                    </div>
                  )}

                  {(altFormData.asset_type === 'collectible' || (editingAltAsset && ['fine_art', 'wine', 'watches', 'jewelry'].includes(editingAltAsset.asset_subtype))) && (
                    <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Collectible Details</h3>
                      <input
                        type="text"
                        value={altFormData.item_description}
                        onChange={(e) => setAltFormData({ ...altFormData, item_description: e.target.value })}
                        placeholder="Item Description"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={altFormData.condition}
                          onChange={(e) => setAltFormData({ ...altFormData, condition: e.target.value })}
                          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        >
                          <option value="">Condition</option>
                          <option value="mint">Mint</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="poor">Poor</option>
                        </select>
                        <input
                          type="number"
                          value={altFormData.insurance_value}
                          onChange={(e) => setAltFormData({ ...altFormData, insurance_value: e.target.value })}
                          placeholder="Insurance Value"
                          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                    </div>
                  )}

                  {(altFormData.asset_type === 'private_fund' || (editingAltAsset && ['hedge_fund', 'private_equity_fund', 'venture_capital_fund'].includes(editingAltAsset.asset_subtype))) && (
                    <div className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Fund Details</h3>
                      <input
                        type="text"
                        value={altFormData.fund_name}
                        onChange={(e) => setAltFormData({ ...altFormData, fund_name: e.target.value })}
                        placeholder="Fund Name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="number"
                          value={altFormData.commitment_amount}
                          onChange={(e) => setAltFormData({ ...altFormData, commitment_amount: e.target.value })}
                          placeholder="Commitment ($)"
                          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        />
                        <input
                          type="number"
                          value={altFormData.vintage_year}
                          onChange={(e) => setAltFormData({ ...altFormData, vintage_year: e.target.value })}
                          placeholder="Vintage Year"
                          className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                      <input
                        type="date"
                        value={altFormData.lockup_end_date}
                        onChange={(e) => setAltFormData({ ...altFormData, lockup_end_date: e.target.value })}
                        placeholder="Lockup End Date"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                    <textarea
                      value={altFormData.notes}
                      onChange={(e) => setAltFormData({ ...altFormData, notes: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAltModal(false);
                        setEditingAltAsset(null);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {editingAltAsset ? 'Update' : 'Add Asset'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================ */}
      {/* POSITION SIZING TAB CONTENT */}
      {/* ============================================ */}
      {mainTab === 'sizing' && (
        <>
          {totalPortfolioValue === 0 ? (
            <Card className="py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Calculator className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                Add positions first
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                You need portfolio positions to calculate position sizes.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Position Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Symbol Search */}
                  <div className="relative">
                    <Input
                      label="Symbol"
                      placeholder="Search for a symbol..."
                      value={sizingSymbol}
                      onChange={(e) => setSizingSymbol(e.target.value.toUpperCase())}
                      onFocus={() => sizingSymbol && setShowSizingSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSizingSuggestions(false), 200)}
                    />
                    {showSizingSuggestions && sizingSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {sizingSuggestions.map((s) => (
                          <button
                            key={s.symbol}
                            type="button"
                            onClick={() => selectSizingSymbol(s.symbol)}
                            className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{s.symbol}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{s.name}</p>
                            </div>
                            <span className="text-xs text-gray-400">{s.exchangeShortName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Current Price */}
                  {sizingQuote && (
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Current Price</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {loadingQuote ? '...' : formatCurrency(sizingQuote.price)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Method Selection */}
                  <Select
                    label="Sizing Method"
                    options={[
                      { value: 'fixed_risk', label: 'Fixed Risk %' },
                      { value: 'kelly', label: 'Kelly Criterion' },
                      { value: 'atr', label: 'ATR-Based' },
                    ]}
                    value={sizingMethod}
                    onChange={(e) => {
                      setSizingMethod(e.target.value as SizingMethod);
                      if (e.target.value === 'atr' && sizingSymbol) {
                        fetchATR(sizingSymbol);
                      }
                    }}
                  />

                  {/* Entry Price */}
                  <Input
                    label="Entry Price"
                    type="number"
                    step="0.01"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                  />

                  {/* Stop Loss (not for ATR) */}
                  {sizingMethod !== 'atr' && (
                    <Input
                      label="Stop Loss"
                      type="number"
                      step="0.01"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                    />
                  )}

                  {/* Target Price (optional) */}
                  <Input
                    label="Target Price (optional)"
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                  />

                  {/* Risk Percent */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Risk Per Trade: {riskPercent}%
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(e.target.value)}
                      className="w-full"
                    />
                    <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>0.5%</span>
                      <span>5%</span>
                    </div>
                  </div>

                  {/* Kelly-specific inputs */}
                  {sizingMethod === 'kelly' && (
                    <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Kelly Parameters</h4>
                      <Input
                        label="Win Rate (%)"
                        type="number"
                        step="1"
                        value={winRate}
                        onChange={(e) => setWinRate(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Avg Win (%)"
                          type="number"
                          step="1"
                          value={avgWin}
                          onChange={(e) => setAvgWin(e.target.value)}
                        />
                        <Input
                          label="Avg Loss (%)"
                          type="number"
                          step="1"
                          value={avgLoss}
                          onChange={(e) => setAvgLoss(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* ATR-specific inputs */}
                  {sizingMethod === 'atr' && (
                    <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">ATR Parameters</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">14-Day ATR</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {loadingATR ? '...' : atrValue ? `$${atrValue.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <Input
                        label="ATR Multiplier"
                        type="number"
                        step="0.5"
                        value={atrMultiplier}
                        onChange={(e) => setAtrMultiplier(e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Position Size Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {sizingResult ? (
                    <div className="space-y-6">
                      {/* Main Results */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Shares to Buy</span>
                          </div>
                          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                            {sizingResult.shares.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Position Value</span>
                          </div>
                          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(sizingResult.positionSize)}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Portfolio Weight</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {(sizingResult.portfolioWeight * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Risk Amount</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            {formatCurrency(sizingResult.riskAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Stop Loss</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${sizingResult.stopLoss.toFixed(2)}
                          </span>
                        </div>
                        {sizingResult.riskRewardRatio !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Risk/Reward Ratio</span>
                            <span className={`font-medium ${sizingResult.riskRewardRatio >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              1:{sizingResult.riskRewardRatio.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Validation Warnings */}
                      {sizingValidation && sizingValidation.warnings.length > 0 && (
                        <div className="space-y-2">
                          {sizingValidation.warnings.map((warning, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20"
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                              <span className="text-sm text-yellow-700 dark:text-yellow-300">{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Portfolio Context */}
                      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                        <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Portfolio Context
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Total Portfolio Value</span>
                            <span className="text-gray-900 dark:text-white">
                              {formatCurrency(totalPortfolioValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">Max Risk ({riskPercent}%)</span>
                            <span className="text-gray-900 dark:text-white">
                              {formatCurrency(totalPortfolioValue * parseFloat(riskPercent) / 100)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Calculator className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                      <p className="mt-4 text-gray-500 dark:text-gray-400">
                        Enter position parameters to calculate size
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Method Explanations */}
          <Card>
            <CardHeader>
              <CardTitle>Understanding Sizing Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Fixed Risk %</h4>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Risk a fixed percentage of your portfolio on each trade. The position size is calculated
                    so that if the stop loss is hit, you lose exactly the specified percentage.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Kelly Criterion</h4>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Mathematically optimal sizing based on your win rate and average win/loss ratios.
                    We use half-Kelly (50% of optimal) for more conservative sizing.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">ATR-Based</h4>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Uses Average True Range to set a volatility-adjusted stop loss. Position size is
                    calculated to keep risk within your specified percentage.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
