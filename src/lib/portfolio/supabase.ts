import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder');

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Database helper functions
export async function getAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

export async function createAccount(account: { name: string; type: string; cash_balance?: number }) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...account, user_id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccount(id: string, account: { name: string; type: string; cash_balance?: number }) {
  const { data, error } = await supabase
    .from('accounts')
    .update(account)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAccount(id: string) {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getPositions() {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      *,
      account:accounts(*)
    `)
    .order('symbol');

  if (error) throw error;
  return data;
}

export async function getPositionsByAccount(accountId: string) {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('account_id', accountId)
    .order('symbol');

  if (error) throw error;
  return data;
}

export async function createPosition(position: {
  account_id: string;
  symbol: string;
  asset_type: string;
  shares: number;
  cost_basis: number;
  purchase_date: string;
  notes?: string | null;
  manual_sector?: string | null;
  manual_country?: string | null;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('positions')
    .insert({ ...position, user_id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePosition(id: string, position: {
  account_id?: string;
  symbol?: string;
  asset_type?: string;
  shares?: number;
  cost_basis?: number;
  purchase_date?: string;
  notes?: string | null;
  manual_sector?: string | null;
  manual_country?: string | null;
  drip_enabled?: boolean;
}) {
  const { data, error } = await supabase
    .from('positions')
    .update(position)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePosition(id: string) {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getWatchlist() {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('symbol');

  if (error) throw error;
  return data;
}

export async function addToWatchlist(item: {
  symbol: string;
  target_price?: number | null;
  notes?: string | null;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('watchlist')
    .insert({ ...item, user_id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWatchlistItem(id: string, item: {
  target_price?: number | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('watchlist')
    .update(item)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFromWatchlist(id: string) {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAssetMetadata(symbol: string) {
  const { data, error } = await supabase
    .from('asset_metadata')
    .select('*')
    .eq('symbol', symbol)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // Ignore not found
  return data;
}

export async function upsertAssetMetadata(metadata: {
  symbol: string;
  name: string;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  region?: string | null;
  market_cap?: number | null;
  exchange?: string | null;
}) {
  const { data, error } = await supabase
    .from('asset_metadata')
    .upsert({
      ...metadata,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateSettings(settings: {
  investor_password_hash?: string | null;
  theme_preference?: string;
  benchmark_symbol?: string;
}) {
  // First check if settings exist
  const existing = await getSettings();

  if (existing) {
    const { data, error } = await supabase
      .from('settings')
      .update(settings)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const user_id = await getCurrentUserId();
    const { data, error } = await supabase
      .from('settings')
      .insert({
        ...settings,
        user_id,
        theme_preference: settings.theme_preference || 'system',
        benchmark_symbol: settings.benchmark_symbol || 'SPY',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Target Allocations (Rebalancing)
export async function getTargetAllocations() {
  const { data, error } = await supabase
    .from('target_allocations')
    .select('*')
    .order('allocation_type')
    .order('name');

  if (error) throw error;
  return data;
}

export async function upsertTargetAllocation(allocation: {
  allocation_type: string;
  name: string;
  target_weight: number;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('target_allocations')
    .upsert({
      ...allocation,
      user_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,allocation_type,name' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTargetAllocation(id: string) {
  const { error } = await supabase
    .from('target_allocations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Trades (Trade Journal)
export async function getTrades(options?: {
  symbol?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  let query = supabase
    .from('trades')
    .select('*')
    .order('trade_date', { ascending: false });

  if (options?.symbol) {
    query = query.eq('symbol', options.symbol.toUpperCase());
  }
  if (options?.from) {
    query = query.gte('trade_date', options.from);
  }
  if (options?.to) {
    query = query.lte('trade_date', options.to);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTrade(trade: {
  symbol: string;
  action: string;
  shares: number;
  price: number;
  trade_date: string;
  position_id?: string | null;
  thesis?: string | null;
  notes?: string | null;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('trades')
    .insert({
      ...trade,
      user_id,
      symbol: trade.symbol.toUpperCase(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrade(id: string, trade: {
  symbol?: string;
  action?: string;
  shares?: number;
  price?: number;
  trade_date?: string;
  thesis?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('trades')
    .update({
      ...trade,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string) {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Dividend Reinvestments (DRIP)
export async function getDividendReinvestments(positionId?: string) {
  let query = supabase
    .from('dividend_reinvestments')
    .select('*')
    .order('reinvestment_date', { ascending: false });

  if (positionId) {
    query = query.eq('position_id', positionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAllDividendReinvestments() {
  const { data, error } = await supabase
    .from('dividend_reinvestments')
    .select('*')
    .order('reinvestment_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createDividendReinvestment(reinvestment: {
  position_id: string;
  symbol: string;
  reinvestment_date: string;
  dividend_amount: number;
  shares_acquired: number;
  price_per_share: number;
  notes?: string | null;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('dividend_reinvestments')
    .insert({
      ...reinvestment,
      user_id,
      symbol: reinvestment.symbol.toUpperCase(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDividendReinvestment(id: string, reinvestment: {
  reinvestment_date?: string;
  dividend_amount?: number;
  shares_acquired?: number;
  price_per_share?: number;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('dividend_reinvestments')
    .update(reinvestment)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDividendReinvestment(id: string) {
  const { error } = await supabase
    .from('dividend_reinvestments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Financial Goals
export async function getFinancialGoals() {
  const { data, error } = await supabase
    .from('financial_goals')
    .select('*')
    .order('target_date');

  if (error) throw error;
  return data;
}

export async function createFinancialGoal(goal: {
  name: string;
  target_amount: number;
  target_date: string;
  initial_amount?: number;
  monthly_contribution?: number;
  expected_return?: number;
  notes?: string | null;
  color?: string;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('financial_goals')
    .insert({ ...goal, user_id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFinancialGoal(id: string, goal: {
  name?: string;
  target_amount?: number;
  target_date?: string;
  initial_amount?: number;
  monthly_contribution?: number;
  expected_return?: number;
  notes?: string | null;
  color?: string;
}) {
  const { data, error } = await supabase
    .from('financial_goals')
    .update({ ...goal, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFinancialGoal(id: string) {
  const { error } = await supabase
    .from('financial_goals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Goal Accounts
export async function getGoalAccounts(goalId?: string) {
  let query = supabase
    .from('goal_accounts')
    .select('*');

  if (goalId) {
    query = query.eq('goal_id', goalId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function linkAccountToGoal(goalId: string, accountId: string) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('goal_accounts')
    .insert({ goal_id: goalId, account_id: accountId, user_id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unlinkAccountFromGoal(goalId: string, accountId: string) {
  const { error } = await supabase
    .from('goal_accounts')
    .delete()
    .eq('goal_id', goalId)
    .eq('account_id', accountId);

  if (error) throw error;
}

// Portfolio Snapshots
export async function getPortfolioSnapshots(options?: {
  from?: string;
  to?: string;
  limit?: number;
}) {
  let query = supabase
    .from('portfolio_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false });

  if (options?.from) {
    query = query.gte('snapshot_date', options.from);
  }
  if (options?.to) {
    query = query.lte('snapshot_date', options.to);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPortfolioSnapshot(snapshot: {
  snapshot_date: string;
  total_value: number;
  cash_balance?: number;
  positions_data: { symbol: string; shares: number; value: number }[];
  sector_allocation?: { sector: string; weight: number }[] | null;
  daily_change?: number | null;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .upsert({
      ...snapshot,
      user_id,
    }, { onConflict: 'user_id,snapshot_date' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePortfolioSnapshot(id: string) {
  const { error } = await supabase
    .from('portfolio_snapshots')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Transactions (unified portfolio history)
export async function getTransactions(options?: {
  symbol?: string;
  accountId?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      account:accounts(name, type)
    `)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.symbol) {
    query = query.eq('symbol', options.symbol.toUpperCase());
  }
  if (options?.accountId) {
    query = query.eq('account_id', options.accountId);
  }
  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.from) {
    query = query.gte('transaction_date', options.from);
  }
  if (options?.to) {
    query = query.lte('transaction_date', options.to);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Flatten the account join
  return data?.map((t) => ({
    ...t,
    account_name: t.account?.name || null,
    account_type: t.account?.type || null,
    account: undefined,
  })) || [];
}

export async function createTransaction(transaction: {
  type: string;
  symbol?: string | null;
  account_id?: string | null;
  position_id?: string | null;
  shares?: number | null;
  price_per_share?: number | null;
  total_amount: number;
  fees?: number;
  cost_basis?: number | null;
  realized_pnl?: number | null;
  transaction_date: string;
  settlement_date?: string | null;
  description?: string | null;
  notes?: string | null;
  source_trade_id?: string | null;
  source_drip_id?: string | null;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...transaction,
      user_id,
      symbol: transaction.symbol?.toUpperCase() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id: string, transaction: {
  type?: string;
  symbol?: string | null;
  account_id?: string | null;
  position_id?: string | null;
  shares?: number | null;
  price_per_share?: number | null;
  total_amount?: number;
  fees?: number;
  cost_basis?: number | null;
  realized_pnl?: number | null;
  transaction_date?: string;
  settlement_date?: string | null;
  description?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...transaction,
      symbol: transaction.symbol?.toUpperCase() || transaction.symbol,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get transaction summary stats
export async function getTransactionSummary(options?: {
  from?: string;
  to?: string;
}) {
  let query = supabase
    .from('transactions')
    .select('type, total_amount, fees, realized_pnl');

  if (options?.from) {
    query = query.gte('transaction_date', options.from);
  }
  if (options?.to) {
    query = query.lte('transaction_date', options.to);
  }

  const { data, error } = await query;
  if (error) throw error;

  const summary = {
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalDividends: 0,
    totalFees: 0,
    totalRealizedPnL: 0,
    transactionCount: data?.length || 0,
  };

  data?.forEach((t) => {
    if (t.type === 'deposit') summary.totalDeposits += t.total_amount || 0;
    if (t.type === 'withdrawal') summary.totalWithdrawals += t.total_amount || 0;
    if (t.type === 'dividend' || t.type === 'drip') summary.totalDividends += t.total_amount || 0;
    summary.totalFees += t.fees || 0;
    if (t.realized_pnl) summary.totalRealizedPnL += t.realized_pnl;
  });

  return summary;
}

// ============================================
// ALERT SYSTEM
// ============================================

export async function getAlertSettings() {
  const { data, error } = await supabase
    .from('alert_settings')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertAlertSettings(settings: {
  price_move_threshold?: number;
  concentration_threshold?: number;
  days_before_earnings?: number;
  days_before_dividend?: number;
  enable_price_alerts?: boolean;
  enable_earnings_alerts?: boolean;
  enable_dividend_alerts?: boolean;
  enable_target_alerts?: boolean;
  enable_concentration_alerts?: boolean;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('alert_settings')
    .upsert({
      ...settings,
      user_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAlerts(options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('alerts')
    .select('*')
    .eq('is_dismissed', false)
    .order('triggered_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getUnreadAlertCount() {
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('is_dismissed', false);

  if (error) throw error;
  return count || 0;
}

export async function createAlert(alert: {
  alert_type: string;
  symbol: string;
  title: string;
  message: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      ...alert,
      user_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markAlertRead(id: string) {
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllAlertsRead() {
  const user_id = await getCurrentUserId();
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('user_id', user_id)
    .eq('is_read', false);

  if (error) throw error;
}

export async function dismissAlert(id: string) {
  const { error } = await supabase
    .from('alerts')
    .update({ is_dismissed: true })
    .eq('id', id);

  if (error) throw error;
}

// Check if similar alert already exists today (for deduplication)
export async function alertExistsToday(alertType: string, symbol: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('alert_type', alertType)
    .eq('symbol', symbol)
    .gte('triggered_at', today)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

// ============================================
// ALTERNATIVE ASSETS
// ============================================

export async function getAlternativeAssets(positionId?: string) {
  let query = supabase
    .from('alternative_assets')
    .select('*')
    .order('updated_at', { ascending: false });

  if (positionId) {
    query = query.eq('position_id', positionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAlternativeAsset(id: string) {
  const { data, error } = await supabase
    .from('alternative_assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createAlternativeAsset(asset: {
  position_id: string;
  asset_subtype: string;
  current_value: number;
  value_date?: string;
  valuation_method?: string;
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
  condition?: string;
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
  liquidity_rating?: string;
  lockup_end_date?: string;
  // Other
  custom_fields?: Record<string, unknown>;
  documents?: { name: string; url: string; type: string; date: string }[];
  notes?: string;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('alternative_assets')
    .insert({
      ...asset,
      user_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAlternativeAsset(id: string, asset: Partial<{
  asset_subtype: string;
  current_value: number;
  value_date: string;
  valuation_method: string;
  property_address: string;
  property_type: string;
  square_footage: number;
  bedrooms: number;
  bathrooms: number;
  rental_income: number;
  mortgage_balance: number;
  vin: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  item_description: string;
  condition: string;
  provenance: string;
  storage_location: string;
  insurance_value: number;
  appraisal_date: string;
  appraiser_name: string;
  company_name: string;
  fund_name: string;
  ownership_percentage: number;
  commitment_amount: number;
  called_amount: number;
  distribution_to_date: number;
  vintage_year: number;
  next_valuation_date: string;
  liquidity_rating: string;
  lockup_end_date: string;
  custom_fields: Record<string, unknown>;
  documents: { name: string; url: string; type: string; date: string }[];
  notes: string;
}>) {
  const { data, error } = await supabase
    .from('alternative_assets')
    .update(asset)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAlternativeAsset(id: string) {
  const { error } = await supabase
    .from('alternative_assets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// ASSET VALUATIONS
// ============================================

export async function getAssetValuations(alternativeAssetId: string) {
  const { data, error } = await supabase
    .from('asset_valuations')
    .select('*')
    .eq('alternative_asset_id', alternativeAssetId)
    .order('valuation_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createAssetValuation(valuation: {
  alternative_asset_id: string;
  valuation_date: string;
  value: number;
  valuation_method?: string;
  source?: string;
  notes?: string;
}) {
  const user_id = await getCurrentUserId();
  const { data, error } = await supabase
    .from('asset_valuations')
    .insert({
      ...valuation,
      user_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAssetValuation(id: string) {
  const { error } = await supabase
    .from('asset_valuations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// ETF HOLDINGS CACHE
// ============================================

export async function getETFHoldings(etfSymbol: string) {
  const { data, error } = await supabase
    .from('etf_holdings_cache')
    .select('*')
    .eq('etf_symbol', etfSymbol.toUpperCase())
    .order('weight', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getETFHoldingsForSymbols(etfSymbols: string[]) {
  const { data, error } = await supabase
    .from('etf_holdings_cache')
    .select('*')
    .in('etf_symbol', etfSymbols.map(s => s.toUpperCase()))
    .order('weight', { ascending: false });

  if (error) throw error;
  return data;
}

export async function upsertETFHoldings(holdings: {
  etf_symbol: string;
  holding_symbol: string;
  holding_name?: string;
  weight: number;
  sector?: string;
  country?: string;
  asset_class?: string;
}[]) {
  const { data, error } = await supabase
    .from('etf_holdings_cache')
    .upsert(
      holdings.map(h => ({
        ...h,
        etf_symbol: h.etf_symbol.toUpperCase(),
        holding_symbol: h.holding_symbol.toUpperCase(),
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: 'etf_symbol,holding_symbol' }
    )
    .select();

  if (error) throw error;
  return data;
}

export async function isETFHoldingsCacheFresh(etfSymbol: string, maxAgeHours: number = 24) {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('etf_holdings_cache')
    .select('fetched_at')
    .eq('etf_symbol', etfSymbol.toUpperCase())
    .gte('fetched_at', cutoff)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}
