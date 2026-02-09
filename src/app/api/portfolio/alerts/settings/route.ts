import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_ALERT_SETTINGS } from '@/lib/portfolio/alert-engine';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_URL;
  const key = process.env.PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Portfolio Supabase credentials not configured');
  return createClient(url, key);
}

// GET /api/alerts/settings - Get alert settings
export async function GET(request: NextRequest) {
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

    const { data: settings, error } = await supabase
      .from('alert_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return settings or defaults
    return NextResponse.json({
      settings: settings || {
        ...DEFAULT_ALERT_SETTINGS,
        user_id: user.id,
      },
    });
  } catch (error) {
    console.error('Error fetching alert settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert settings' },
      { status: 500 }
    );
  }
}

// PUT /api/alerts/settings - Update alert settings
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const {
      price_move_threshold,
      concentration_threshold,
      days_before_earnings,
      days_before_dividend,
      enable_price_alerts,
      enable_earnings_alerts,
      enable_dividend_alerts,
      enable_target_alerts,
      enable_concentration_alerts,
    } = body;

    const { data: settings, error } = await supabase
      .from('alert_settings')
      .upsert({
        user_id: user.id,
        price_move_threshold,
        concentration_threshold,
        days_before_earnings,
        days_before_dividend,
        enable_price_alerts,
        enable_earnings_alerts,
        enable_dividend_alerts,
        enable_target_alerts,
        enable_concentration_alerts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating alert settings:', error);
    return NextResponse.json(
      { error: 'Failed to update alert settings' },
      { status: 500 }
    );
  }
}
