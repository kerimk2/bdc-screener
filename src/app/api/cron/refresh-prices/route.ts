import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchBDCData } from '@/lib/yahoo-bdc';
import { revalidatePath } from 'next/cache';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Fetch all BDCs that have tickers
  const { data: bdcs, error: fetchError } = await supabase
    .from('bdcs')
    .select('cik, ticker')
    .not('ticker', 'is', null);

  if (fetchError || !bdcs) {
    return NextResponse.json(
      { error: 'Failed to fetch BDCs', details: fetchError?.message },
      { status: 500 }
    );
  }

  const results: { ticker: string; status: 'updated' | 'skipped' | 'error'; message?: string }[] = [];

  for (const bdc of bdcs) {
    if (!bdc.ticker) continue;

    try {
      const yahooData = await fetchBDCData(bdc.ticker);

      // Build update object, only including non-null fields.
      // Never updates non_accrual_pct - not available from Yahoo Finance.
      const updateFields: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (yahooData.price != null) updateFields.price = yahooData.price;
      if (yahooData.dividend_yield != null) updateFields.dividend_yield = yahooData.dividend_yield;
      if (yahooData.nav_per_share != null) updateFields.nav_per_share = yahooData.nav_per_share;
      if (yahooData.debt_to_equity != null) updateFields.debt_to_equity = yahooData.debt_to_equity;
      if (yahooData.market_cap != null) updateFields.market_cap = yahooData.market_cap;
      if (yahooData.payout_ratio != null) updateFields.payout_ratio = yahooData.payout_ratio;
      if (yahooData.beta != null) updateFields.beta = yahooData.beta;
      if (yahooData.fifty_two_week_high != null) updateFields.fifty_two_week_high = yahooData.fifty_two_week_high;
      if (yahooData.fifty_two_week_low != null) updateFields.fifty_two_week_low = yahooData.fifty_two_week_low;
      if (yahooData.analyst_target_price != null) updateFields.analyst_target_price = yahooData.analyst_target_price;
      if (yahooData.analyst_rating != null) updateFields.analyst_rating = yahooData.analyst_rating;
      if (yahooData.institutional_ownership != null) updateFields.institutional_ownership = yahooData.institutional_ownership;
      if (yahooData.five_yr_avg_dividend_yield != null) updateFields.five_yr_avg_dividend_yield = yahooData.five_yr_avg_dividend_yield;
      if (yahooData.ex_dividend_date != null) updateFields.ex_dividend_date = yahooData.ex_dividend_date;

      // Calculate price_to_nav from fresh data
      const finalPrice = yahooData.price;
      const finalNav = yahooData.nav_per_share;
      if (finalPrice != null && finalNav != null && finalNav > 0) {
        updateFields.price_to_nav = Math.round((finalPrice / finalNav) * 100) / 100;
      }

      // Only update if we got at least one meaningful field beyond updated_at
      if (Object.keys(updateFields).length <= 1) {
        results.push({ ticker: bdc.ticker, status: 'skipped', message: 'No data from Yahoo' });
      } else {
        const { error: updateError } = await supabase
          .from('bdcs')
          .update(updateFields)
          .eq('cik', bdc.cik);

        if (updateError) {
          results.push({ ticker: bdc.ticker, status: 'error', message: updateError.message });
        } else {
          results.push({ ticker: bdc.ticker, status: 'updated' });
        }
      }
    } catch (err) {
      results.push({
        ticker: bdc.ticker,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    // Rate limiting: 500ms between Yahoo Finance calls
    await delay(500);
  }

  // Bust the Next.js cache so visitors see fresh data
  revalidatePath('/');
  revalidatePath('/bdc/[cik]', 'page');

  const updated = results.filter(r => r.status === 'updated').length;
  const errors = results.filter(r => r.status === 'error').length;

  return NextResponse.json({
    success: true,
    summary: { total: bdcs.length, updated, errors, skipped: results.length - updated - errors },
    results,
    timestamp: new Date().toISOString(),
  });
}
