import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service role key for database updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// List of publicly traded BDC tickers to fetch prices for
const TRADED_BDC_TICKERS = [
  'ARCC', 'BXSL', 'OBDC', 'FSK', 'MAIN', 'GBDC', 'ORCC', 'PSEC',
  'HTGC', 'TSLX', 'NMFC', 'GSBD', 'OCSL', 'TCPC', 'CSWC', 'MFIC',
  'SLRC', 'BCSF', 'CGBD', 'CCAP', 'PFLT', 'PNNT', 'TPVG', 'FDUS',
  'GLAD', 'GAIN', 'HRZN', 'WHF', 'MRCC', 'RWAY', 'NEWT', 'CION',
  'TRIN', 'SAR', 'SCM', 'OFS', 'BBDC', 'OXSQ', 'GECC', 'PTMN',
];

interface FMPQuote {
  symbol: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  exchange: string;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  sharesOutstanding: number;
  timestamp: number;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'FMP_API_KEY not configured. Add it to your environment variables.' },
        { status: 500 }
      );
    }

    // Fetch quotes for all BDC tickers in a single batch request
    const tickerList = TRADED_BDC_TICKERS.join(',');
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${tickerList}?apikey=${apiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `FMP API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const quotes: FMPQuote[] = await response.json();

    if (!Array.isArray(quotes) || quotes.length === 0) {
      return NextResponse.json(
        { error: 'No quotes returned from API' },
        { status: 500 }
      );
    }

    // Update prices in database
    const updates: { ticker: string; price: number; updated: boolean }[] = [];

    for (const quote of quotes) {
      if (!quote.symbol || !quote.price) continue;

      // Get current NAV to recalculate P/NAV
      const { data: bdc } = await supabase
        .from('bdcs')
        .select('nav_per_share')
        .eq('ticker', quote.symbol)
        .single();

      const navPerShare = bdc?.nav_per_share || 0;
      const priceToNav = navPerShare > 0 ? quote.price / navPerShare : null;

      // Update the database
      const { error } = await supabase
        .from('bdcs')
        .update({
          price: quote.price,
          price_to_nav: priceToNav ? Math.round(priceToNav * 100) / 100 : null,
          updated_at: new Date().toISOString(),
        })
        .eq('ticker', quote.symbol);

      updates.push({
        ticker: quote.symbol,
        price: quote.price,
        updated: !error,
      });
    }

    const successCount = updates.filter(u => u.updated).length;

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} of ${quotes.length} BDC prices`,
      updates,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error refreshing prices:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to refresh prices',
    tickers: TRADED_BDC_TICKERS,
    count: TRADED_BDC_TICKERS.length,
  });
}
