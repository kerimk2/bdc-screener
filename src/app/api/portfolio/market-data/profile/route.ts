import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache for profiles (6 hours TTL, profiles rarely change)
const profileCache = new LRUCache<unknown>({ maxSize: 200, ttlMs: 6 * 60 * 60 * 1000 });

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  }

  const upperSymbol = symbol.toUpperCase();

  // Check cache
  const cached = profileCache.get(upperSymbol);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const [quote, summaryProfile] = await Promise.all([
      yahooFinance.quote(upperSymbol),
      yahooFinance.quoteSummary(upperSymbol, { modules: ['assetProfile', 'summaryProfile'] }).catch(() => null),
    ]);

    if (!quote) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }

    const profile = summaryProfile?.assetProfile || summaryProfile?.summaryProfile;

    const result = [{
      symbol: quote.symbol,
      companyName: quote.shortName || quote.longName || symbol,
      currency: quote.currency || 'USD',
      exchange: quote.exchange || '',
      industry: profile?.industry || '',
      sector: profile?.sector || '',
      country: profile?.country || 'US',
      description: profile?.longBusinessSummary || '',
      ceo: (profile?.companyOfficers?.[0] as { name?: string })?.name || '',
      website: profile?.website || '',
      image: null,
      ipoDate: null,
      mktCap: quote.marketCap || 0,
      beta: quote.beta || 1,
      volAvg: quote.averageDailyVolume3Month || 0,
      lastDiv: quote.trailingAnnualDividendRate || 0,
      dcfDiff: null,
      dcf: null,
      isEtf: quote.quoteType === 'ETF',
      isActivelyTrading: true,
    }];

    profileCache.set(upperSymbol, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
