// Database types
export interface Account {
  id: string;
  name: string;
  type: 'brokerage' | 'ira' | 'roth_ira' | '401k' | 'crypto' | 'other';
  cash_balance: number;
  created_at: string;
}

export type PositionAssetType =
  | 'stock' | 'etf' | 'bond' | 'crypto' | 'option' | 'mutual_fund' | 'other'
  // Alternative asset types
  | 'real_estate' | 'vehicle' | 'collectible' | 'private_equity' | 'private_fund' | 'illiquid' | 'manual';

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  asset_type: PositionAssetType;
  shares: number;
  cost_basis: number;
  purchase_date: string;
  notes: string | null;
  manual_sector: string | null;
  manual_country: string | null;
  drip_enabled: boolean;
  created_at: string;
  // Joined fields
  account?: Account;
  // Alternative asset data (if applicable)
  alternative_asset?: AlternativeAsset;
}

export interface DividendReinvestment {
  id: string;
  user_id: string;
  position_id: string;
  symbol: string;
  reinvestment_date: string;
  dividend_amount: number;
  shares_acquired: number;
  price_per_share: number;
  notes: string | null;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  target_price: number | null;
  notes: string | null;
  created_at: string;
}

export interface AssetMetadata {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  region: string | null;
  market_cap: number | null;
  exchange: string | null;
  updated_at: string;
}

export interface Settings {
  id: string;
  investor_password_hash: string | null;
  theme_preference: 'dark' | 'light' | 'system';
  benchmark_symbol: string;
}

// Market data types
export interface Quote {
  symbol: string;
  name: string;
  price: number;
  priceUSD: number;
  currency: string;
  exchangeRate: number;
  change: number;
  changesPercentage: number;
  dayLow: number;
  dayHigh: number;
  yearLow: number;
  yearHigh: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  pe: number | null;
  eps: number | null;
  earningsAnnouncement?: string | null;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface CompanyProfile {
  symbol: string;
  companyName: string;
  currency: string;
  exchange: string;
  industry: string;
  sector: string;
  country: string;
  description: string;
  ceo: string;
  website: string;
  image: string;
  ipoDate: string;
  mktCap: number;
  beta: number;
  volAvg: number;
  lastDiv: number;
  dcfDiff: number;
  dcf: number;
  isEtf: boolean;
  isActivelyTrading: boolean;
}

export interface NewsItem {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string | null;
  site: string;
  text: string;
  url: string;
}

// Enriched position with live data
export interface EnrichedPosition extends Position {
  currentPrice: number;
  currentPriceUSD: number;
  currency: string;
  exchangeRate: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  weight: number;
  metadata?: AssetMetadata;
  // DRIP-adjusted values (includes reinvested dividends)
  dripShares: number; // Total shares including reinvested
  dripCostBasis: number; // Cost basis + reinvested dividends
  dripMarketValue: number; // Current value with all shares
  totalReturn: number; // Market value - original cost (captures DRIP benefit)
  totalReturnPercent: number;
  reinvestments?: DividendReinvestment[];
}

// Portfolio summary
export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  positionCount: number;
}

// Analytics types
export interface SectorAllocation {
  sector: string;
  value: number;
  weight: number;
  count: number;
}

export interface GeographicAllocation {
  country: string;
  region: string;
  value: number;
  weight: number;
  count: number;
}

export interface AssetTypeAllocation {
  assetType: string;
  value: number;
  weight: number;
  count: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  timeWeightedReturn: number;
  moneyWeightedReturn: number;
}

export interface RiskMetrics {
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  beta: number;
  alpha: number;
  rSquared: number;
  informationRatio: number;
  trackingError: number;
  var95: number;
}

// Chart data types
export interface ChartDataPoint {
  date: string;
  value: number;
  benchmark?: number;
}

// Form types
export interface PositionFormData {
  account_id: string;
  symbol: string;
  asset_type: Position['asset_type'];
  shares: number;
  cost_basis: number;
  purchase_date: string;
  notes: string;
}

export interface AccountFormData {
  name: string;
  type: Account['type'];
  cash_balance: number;
}

// Options types
export interface OptionContract {
  contractSymbol: string;
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  percentChange: number;
}

export interface OptionsChainResponse {
  symbol: string;
  underlyingPrice: number;
  expirationDates: string[];
  options: {
    expirationDate: string;
    daysToExpiration: number;
    calls: OptionContract[];
    puts: OptionContract[];
  }[];
}

export interface LiquidityInfo {
  bid: number;
  ask: number;
  spread: number;
  spreadPercent: number; // Spread as % of mid price
  volume: number;
  openInterest: number;
  isLiquid: boolean; // Meets minimum liquidity thresholds
  liquidityScore: 'good' | 'fair' | 'poor'; // Overall liquidity rating
}

export interface CoveredCallSimulation {
  symbol: string;
  shares: number;
  contracts: number;
  strike: number;
  premium: number;
  annualizedYield: number;
  assignmentProbability: number;
  breakeven: number;
  daysToExpiration: number;
  expirationDate: string;
  liquidity?: LiquidityInfo;
}

export interface BacktestResult {
  startDate: string;
  endDate: string;
  totalPremiumCollected: number;
  totalCycles: number;
  assignmentCount: number;
  averagePremiumPerCycle: number;
  annualizedYield: number;
  premiumHistory: { date: string; cumulative: number; event: string }[];
}

// Financial Goals
export interface FinancialGoal {
  id: string;
  user_id?: string;
  name: string;
  target_amount: number;
  target_date: string;
  initial_amount: number;
  monthly_contribution: number;
  expected_return: number;
  notes: string | null;
  color: string;
  created_at: string;
  updated_at?: string;
}

export interface GoalAccount {
  id: string;
  user_id?: string;
  goal_id: string;
  account_id: string;
  created_at: string;
}

// Portfolio Snapshots
export interface PortfolioSnapshot {
  id: string;
  user_id?: string;
  snapshot_date: string;
  total_value: number;
  cash_balance: number;
  positions_data: { symbol: string; shares: number; value: number }[];
  sector_allocation: { sector: string; weight: number }[] | null;
  daily_change: number | null;
  created_at: string;
}

// Risk Analysis Types
export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  highCorrelations: { pair: [string, string]; value: number }[];
  lowCorrelations?: { pair: [string, string]; value: number }[];
}

export interface FactorExposure {
  value: number;
  growth: number;
  momentum: number;
  quality: number;
  size: { small: number; mid: number; large: number };
}

export interface ScenarioResult {
  name: string;
  description: string;
  marketImpact: number;
  portfolioImpact: number;
  positionImpacts: { symbol: string; impact: number; value: number }[];
}

// Market Intelligence Types
export interface InsiderTransaction {
  symbol: string;
  name: string;
  relation: string;
  date: string;
  type: 'Buy' | 'Sell' | 'Exercise';
  shares: number;
  value: number;
  sharesOwned?: number;
}

export interface AnalystRating {
  symbol: string;
  rating: string;
  score: number;
  targetPrice: number | null;
  currentPrice: number;
  upside: number | null;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  totalAnalysts: number;
}

export interface EarningsEstimate {
  symbol: string;
  nextEarningsDate: string | null;
  currentQuarterEstimate: number | null;
  currentYearEstimate: number | null;
  history: {
    quarter: string;
    date: string;
    estimated: number | null;
    actual: number | null;
    surprise: number | null;
    surprisePercent: number | null;
  }[];
}

// Position Sizing Types
export interface PositionSizeResult {
  method: 'fixed_risk' | 'kelly' | 'atr';
  shares: number;
  positionSize: number;
  portfolioWeight: number;
  riskAmount: number;
  riskRewardRatio: number | null;
  stopLoss: number;
  targetPrice: number | null;
}

// Transaction History Types
export type TransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'drip'
  | 'deposit'
  | 'withdrawal'
  | 'fee'
  | 'interest'
  | 'transfer'
  | 'split'
  | 'spinoff';

export interface Transaction {
  id: string;
  user_id?: string;
  type: TransactionType;
  symbol: string | null;
  account_id: string | null;
  position_id: string | null;
  shares: number | null;
  price_per_share: number | null;
  total_amount: number;
  fees: number;
  cost_basis: number | null;
  realized_pnl: number | null;
  transaction_date: string;
  settlement_date: string | null;
  description: string | null;
  notes: string | null;
  source_trade_id: string | null;
  source_drip_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  account_name?: string;
  account_type?: string;
}

export interface TransactionSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  totalDividends: number;
  totalFees: number;
  totalRealizedPnL: number;
  transactionCount: number;
}

// ============================================
// ALERT SYSTEM TYPES
// ============================================

export type AlertType =
  | 'large_price_move'
  | 'earnings_upcoming'
  | 'dividend_ex_date'
  | 'target_reached'
  | 'concentration_warning';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertSettings {
  id: string;
  user_id: string;
  price_move_threshold: number;
  concentration_threshold: number;
  days_before_earnings: number;
  days_before_dividend: number;
  enable_price_alerts: boolean;
  enable_earnings_alerts: boolean;
  enable_dividend_alerts: boolean;
  enable_target_alerts: boolean;
  enable_concentration_alerts: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  alert_type: AlertType;
  symbol: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_read: boolean;
  is_dismissed: boolean;
  metadata: Record<string, unknown>;
  triggered_at: string;
  created_at: string;
}

// ============================================
// ALTERNATIVE ASSETS TYPES
// ============================================

export type AlternativeAssetType =
  | 'real_estate'
  | 'vehicle'
  | 'collectible'
  | 'private_equity'
  | 'private_fund'
  | 'illiquid'
  | 'manual';

export type AssetSubtype =
  // Real Estate
  | 'primary_residence' | 'rental_property' | 'commercial' | 'land' | 'reit_private'
  // Vehicles
  | 'automobile' | 'motorcycle' | 'boat' | 'aircraft' | 'rv'
  // Collectibles
  | 'fine_art' | 'wine' | 'watches' | 'jewelry' | 'coins' | 'stamps'
  | 'sports_memorabilia' | 'antiques' | 'nft' | 'other_collectible'
  // Private Investments
  | 'private_company' | 'angel_investment' | 'startup_equity'
  // Private Funds
  | 'hedge_fund' | 'private_equity_fund' | 'venture_capital_fund' | 'real_estate_fund'
  // Illiquid
  | 'structured_product' | 'annuity' | 'life_insurance_cash_value' | 'royalty' | 'other_illiquid'
  // Generic
  | 'other';

export type ValuationMethod =
  | 'manual'
  | 'appraisal'
  | 'market_comparable'
  | 'fund_statement'
  | 'purchase_price';

export type LiquidityRating = 'liquid' | 'semi_liquid' | 'illiquid' | 'locked';

export type AssetCondition = 'mint' | 'excellent' | 'good' | 'fair' | 'poor';

export interface AlternativeAsset {
  id: string;
  user_id: string;
  position_id: string;
  asset_subtype: AssetSubtype;
  current_value: number;
  value_date: string;
  valuation_method: ValuationMethod;

  // Real estate
  property_address?: string;
  property_type?: string;
  square_footage?: number;
  bedrooms?: number;
  bathrooms?: number;
  rental_income?: number;
  mortgage_balance?: number;

  // Vehicle
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;

  // Collectible
  item_description?: string;
  condition?: AssetCondition;
  provenance?: string;
  storage_location?: string;
  insurance_value?: number;
  appraisal_date?: string;
  appraiser_name?: string;

  // Private equity/fund
  company_name?: string;
  fund_name?: string;
  ownership_percentage?: number;
  commitment_amount?: number;
  called_amount?: number;
  distribution_to_date?: number;
  vintage_year?: number;
  next_valuation_date?: string;

  // Liquidity
  liquidity_rating: LiquidityRating;
  lockup_end_date?: string;

  // Flexible
  custom_fields: Record<string, unknown>;
  documents: { name: string; url: string; type: string; date: string }[];
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface AssetValuation {
  id: string;
  user_id: string;
  alternative_asset_id: string;
  valuation_date: string;
  value: number;
  valuation_method?: string;
  source?: string;
  notes?: string;
  created_at: string;
}

// ============================================
// ETF OVERLAP ANALYSIS TYPES
// ============================================

export interface ETFHolding {
  id: string;
  etf_symbol: string;
  holding_symbol: string;
  holding_name?: string;
  weight: number;
  sector?: string;
  country?: string;
  asset_class?: string;
  fetched_at: string;
}

export interface OverlappingHolding {
  symbol: string;
  name: string;
  etfs: { etf: string; weight: number }[];
  totalExposure: number; // % of your portfolio
}

export interface ETFOverlapMatrix {
  etfs: string[];
  matrix: number[][]; // % shared holdings between each pair
}

export interface ConcentrationRisk {
  symbol: string;
  name: string;
  exposure: number; // % of portfolio
  sources: { etf: string; contribution: number }[];
}

export interface OverlapAnalysis {
  overlappingHoldings: OverlappingHolding[];
  overlapMatrix: ETFOverlapMatrix;
  concentrationRisks: ConcentrationRisk[];
  totalETFCount: number;
  uniqueHoldingsCount: number;
}
