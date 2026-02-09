import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_URL;
  const key = process.env.PORTFOLIO_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_PORTFOLIO_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Portfolio Supabase credentials not configured');
  return createClient(url, key);
}

// GET /api/alternative-assets - Get all alternative assets
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: assets, error } = await supabase
      .from('alternative_assets')
      .select(`
        *,
        position:positions(*)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ assets: assets || [] });
  } catch (error) {
    console.error('Error fetching alternative assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alternative assets' },
      { status: 500 }
    );
  }
}

// POST /api/alternative-assets - Create a new alternative asset with position
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      account_id,
      asset_type,
      symbol,
      asset_subtype,
      current_value,
      valuation_method,
      notes,
      // Position fields
      purchase_date,
      cost_basis,
      // Alternative asset specific fields
      ...alternativeFields
    } = body;

    // Create the position first
    const { data: position, error: positionError } = await supabase
      .from('positions')
      .insert({
        user_id: user.id,
        account_id,
        symbol: symbol || `ALT-${Date.now()}`,
        asset_type: asset_type || 'manual',
        shares: 1,
        cost_basis: cost_basis || current_value,
        purchase_date: purchase_date || new Date().toISOString().split('T')[0],
        notes,
      })
      .select()
      .single();

    if (positionError) throw positionError;

    // Create the alternative asset record
    const { data: asset, error: assetError } = await supabase
      .from('alternative_assets')
      .insert({
        user_id: user.id,
        position_id: position.id,
        asset_subtype,
        current_value,
        valuation_method: valuation_method || 'manual',
        notes,
        ...alternativeFields,
      })
      .select()
      .single();

    if (assetError) {
      // Rollback position creation
      await supabase.from('positions').delete().eq('id', position.id);
      throw assetError;
    }

    // Also create initial valuation record
    await supabase.from('asset_valuations').insert({
      user_id: user.id,
      alternative_asset_id: asset.id,
      valuation_date: new Date().toISOString().split('T')[0],
      value: current_value,
      valuation_method: valuation_method || 'manual',
      source: 'Initial entry',
    });

    return NextResponse.json({
      asset: { ...asset, position },
    });
  } catch (error) {
    console.error('Error creating alternative asset:', error);
    return NextResponse.json(
      { error: 'Failed to create alternative asset' },
      { status: 500 }
    );
  }
}

// PUT /api/alternative-assets - Update an alternative asset
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, current_value, add_valuation, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 });
    }

    // Update the alternative asset
    const { data: asset, error } = await supabase
      .from('alternative_assets')
      .update({
        current_value,
        value_date: new Date().toISOString().split('T')[0],
        ...updateFields,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    // Optionally add a new valuation record
    if (add_valuation && current_value) {
      await supabase.from('asset_valuations').insert({
        user_id: user.id,
        alternative_asset_id: id,
        valuation_date: new Date().toISOString().split('T')[0],
        value: current_value,
        valuation_method: updateFields.valuation_method || 'manual',
        source: updateFields.valuation_source,
        notes: updateFields.valuation_notes,
      });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Error updating alternative asset:', error);
    return NextResponse.json(
      { error: 'Failed to update alternative asset' },
      { status: 500 }
    );
  }
}

// DELETE /api/alternative-assets - Delete an alternative asset
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 });
    }

    // Get the asset to find the position_id
    const { data: asset } = await supabase
      .from('alternative_assets')
      .select('position_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    // Delete the alternative asset (cascade will handle valuations)
    const { error: assetError } = await supabase
      .from('alternative_assets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (assetError) throw assetError;

    // Delete the associated position
    if (asset?.position_id) {
      await supabase
        .from('positions')
        .delete()
        .eq('id', asset.position_id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alternative asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete alternative asset' },
      { status: 500 }
    );
  }
}
