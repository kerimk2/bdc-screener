import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  evaluateAlerts,
  EarningsEvent,
  DividendEvent,
  DEFAULT_ALERT_SETTINGS,
} from '@/lib/portfolio/alert-engine';
import { EnrichedPosition, WatchlistItem, Quote, AlertSettings } from '@/types/portfolio';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_URL;
  const key = process.env.PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Portfolio Supabase credentials not configured');
  return createClient(url, key);
}

interface CheckAlertsRequest {
  positions: EnrichedPosition[];
  watchlist: WatchlistItem[];
  quotes: Record<string, Quote>;
  upcomingEarnings?: EarningsEvent[];
  upcomingDividends?: DividendEvent[];
  totalPortfolioValue: number;
}

// POST /api/alerts/check - Evaluate and create new alerts
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CheckAlertsRequest = await request.json();
    const {
      positions,
      watchlist,
      quotes,
      upcomingEarnings = [],
      upcomingDividends = [],
      totalPortfolioValue,
    } = body;

    // Get user's alert settings
    const { data: settingsData } = await supabase
      .from('alert_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const settings: AlertSettings = settingsData || DEFAULT_ALERT_SETTINGS;

    // Convert quotes object to Map
    const quotesMap = new Map<string, Quote>();
    for (const [symbol, quote] of Object.entries(quotes)) {
      quotesMap.set(symbol.toUpperCase(), quote);
    }

    // Evaluate alerts
    const pendingAlerts = evaluateAlerts(
      positions,
      watchlist,
      quotesMap,
      upcomingEarnings,
      upcomingDividends,
      settings,
      totalPortfolioValue
    );

    // Check for duplicates and create new alerts
    const createdAlerts = [];
    const today = new Date().toISOString().split('T')[0];

    for (const alert of pendingAlerts) {
      // Check if this alert already exists today
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', user.id)
        .eq('alert_type', alert.alert_type)
        .eq('symbol', alert.symbol)
        .gte('triggered_at', today)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Create new alert
        const { data: newAlert, error: insertError } = await supabase
          .from('alerts')
          .insert({
            user_id: user.id,
            alert_type: alert.alert_type,
            symbol: alert.symbol,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            metadata: alert.metadata,
          })
          .select()
          .single();

        if (!insertError && newAlert) {
          createdAlerts.push(newAlert);
        }
      }
    }

    // Get updated unread count
    const { count } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_dismissed', false);

    return NextResponse.json({
      created: createdAlerts.length,
      alerts: createdAlerts,
      unreadCount: count || 0,
    });
  } catch (error) {
    console.error('Error checking alerts:', error);
    return NextResponse.json(
      { error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}
