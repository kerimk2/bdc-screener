import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache, cleanupCachesIfNeeded, processBatch } from '@/lib/portfolio/api-utils';

const yahooFinance = new YahooFinance();

// LRU Cache with size limits and TTL (5 minute for market data)
const overviewCache = new LRUCache<MarketOverviewData>({ maxSize: 10, ttlMs: 5 * 60 * 1000 });
const CACHE_KEY = 'market-overview';

interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface CurrencyData {
  pair: string;
  name: string;
  rate: number;
  change: number;
  changePercent: number;
}

interface CommodityData {
  symbol: string;
  name: string;
  category: 'precious_metals' | 'energy' | 'agriculture' | 'crypto' | 'industrial';
  price: number;
  change: number;
  changePercent: number;
  monthChangePercent: number;
  ytdChangePercent: number;
  unit: string;
}

interface YieldCurvePoint {
  tenor: string;
  months: number; // For sorting/graphing
  yield: number;
  change: number;
}

interface CountryYields {
  country: string;
  flag: string;
  yields: YieldCurvePoint[];
}

interface MarketOverviewData {
  indices: IndexData[];
  commodities: CommodityData[];
  treasuryYields: YieldCurvePoint[]; // US yields for backward compat
  globalYields: CountryYields[];
  currencies: CurrencyData[];
  marketStatus: 'pre-market' | 'open' | 'after-hours' | 'closed';
  lastUpdated: string;
}

const MARKET_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^RUT', name: 'Russell 2000' },
  { symbol: '^VIX', name: 'VIX' },
];

// Commodities - Futures and spot prices
const COMMODITIES = [
  // Precious Metals
  { symbol: 'GC=F', name: 'Gold', category: 'precious_metals' as const, unit: '/oz' },
  { symbol: 'SI=F', name: 'Silver', category: 'precious_metals' as const, unit: '/oz' },
  { symbol: 'PL=F', name: 'Platinum', category: 'precious_metals' as const, unit: '/oz' },
  // Energy
  { symbol: 'CL=F', name: 'Crude Oil (WTI)', category: 'energy' as const, unit: '/bbl' },
  { symbol: 'BZ=F', name: 'Brent Crude', category: 'energy' as const, unit: '/bbl' },
  { symbol: 'NG=F', name: 'Natural Gas', category: 'energy' as const, unit: '/MMBtu' },
  { symbol: 'RB=F', name: 'Gasoline', category: 'energy' as const, unit: '/gal' },
  { symbol: 'SRUUF', name: 'Uranium', category: 'energy' as const, unit: '/lb' }, // Sprott Physical Uranium Trust
  // Agriculture
  { symbol: 'ZW=F', name: 'Wheat', category: 'agriculture' as const, unit: '/bu' },
  { symbol: 'ZC=F', name: 'Corn', category: 'agriculture' as const, unit: '/bu' },
  { symbol: 'ZS=F', name: 'Soybeans', category: 'agriculture' as const, unit: '/bu' },
  { symbol: 'KC=F', name: 'Coffee', category: 'agriculture' as const, unit: '/lb' },
  { symbol: 'CT=F', name: 'Cotton', category: 'agriculture' as const, unit: '/lb' },
  { symbol: 'SB=F', name: 'Sugar', category: 'agriculture' as const, unit: '/lb' },
  { symbol: 'WOOD', name: 'Timber (ETF)', category: 'agriculture' as const, unit: '' }, // iShares Global Timber ETF as proxy
  // Industrial Metals
  { symbol: 'HG=F', name: 'Copper', category: 'industrial' as const, unit: '/lb' },
  { symbol: 'ALI=F', name: 'Aluminum', category: 'industrial' as const, unit: '/lb' },
  // Crypto
  { symbol: 'BTC-USD', name: 'Bitcoin', category: 'crypto' as const, unit: '' },
  { symbol: 'ETH-USD', name: 'Ethereum', category: 'crypto' as const, unit: '' },
];

// US Treasury symbols - expanded tenors
// Note: Yahoo Finance only has ^IRX (3M), ^FVX (5Y), ^TNX (10Y), ^TYX (30Y)
// We'll use Treasury ETFs to approximate other tenors
const US_TREASURY_SYMBOLS = [
  { symbol: '^IRX', tenor: '3M', months: 3 },
  { symbol: '^FVX', tenor: '5Y', months: 60 },
  { symbol: '^TNX', tenor: '10Y', months: 120 },
  { symbol: '^TYX', tenor: '30Y', months: 360 },
];

// Treasury ETF proxies for additional tenors (yield approximation from SEC yield)
const TREASURY_ETF_PROXIES = [
  { symbol: 'BIL', tenor: '1M', months: 1, name: '1-3 Month T-Bills' },
  { symbol: 'SHY', tenor: '1-3Y', months: 24, name: '1-3 Year Treasury' },
  { symbol: 'IEI', tenor: '3-7Y', months: 60, name: '3-7 Year Treasury' },
  { symbol: 'IEF', tenor: '7-10Y', months: 102, name: '7-10 Year Treasury' },
  { symbol: 'TLT', tenor: '20Y+', months: 240, name: '20+ Year Treasury' },
];

// International 10-year government bond yields
// Using yield proxies - ETFs that track government bonds
const INTERNATIONAL_YIELDS = [
  { country: 'United Kingdom', flag: '🇬🇧', symbol: 'IGLT.L', tenor: '10Y', months: 120 },
  { country: 'Germany', flag: '🇩🇪', symbol: 'EWG', tenor: '10Y', months: 120 }, // German market proxy
  { country: 'Japan', flag: '🇯🇵', symbol: 'EWJ', tenor: '10Y', months: 120 }, // Japan market proxy
  { country: 'Canada', flag: '🇨🇦', symbol: 'EWC', tenor: '10Y', months: 120 }, // Canada market proxy
  { country: 'France', flag: '🇫🇷', symbol: 'EWQ', tenor: '10Y', months: 120 }, // France market proxy
  { country: 'Italy', flag: '🇮🇹', symbol: 'EWI', tenor: '10Y', months: 120 }, // Italy market proxy
  { country: 'Australia', flag: '🇦🇺', symbol: 'EWA', tenor: '10Y', months: 120 }, // Australia market proxy
];

// Major currency pairs
const CURRENCY_PAIRS = [
  { symbol: 'EURUSD=X', pair: 'EUR/USD', name: 'Euro' },
  { symbol: 'GBPUSD=X', pair: 'GBP/USD', name: 'British Pound' },
  { symbol: 'USDJPY=X', pair: 'USD/JPY', name: 'Japanese Yen' },
  { symbol: 'USDCHF=X', pair: 'USD/CHF', name: 'Swiss Franc' },
  { symbol: 'AUDUSD=X', pair: 'AUD/USD', name: 'Australian Dollar' },
  { symbol: 'USDCAD=X', pair: 'USD/CAD', name: 'Canadian Dollar' },
  { symbol: 'USDCNY=X', pair: 'USD/CNY', name: 'Chinese Yuan' },
  { symbol: 'USDINR=X', pair: 'USD/INR', name: 'Indian Rupee' },
];

function getMarketStatus(): 'pre-market' | 'open' | 'after-hours' | 'closed' {
  const now = new Date();
  const nyHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyHour.getDay();
  const hours = nyHour.getHours();
  const minutes = nyHour.getMinutes();
  const time = hours * 60 + minutes;

  // Weekend
  if (day === 0 || day === 6) return 'closed';

  // Pre-market: 4:00 AM - 9:30 AM ET
  if (time >= 240 && time < 570) return 'pre-market';

  // Market hours: 9:30 AM - 4:00 PM ET
  if (time >= 570 && time < 960) return 'open';

  // After-hours: 4:00 PM - 8:00 PM ET
  if (time >= 960 && time < 1200) return 'after-hours';

  return 'closed';
}

export async function GET() {
  // Cleanup old cache entries periodically
  cleanupCachesIfNeeded();

  // Check cache
  const cached = overviewCache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Fetch all symbols in parallel
    const allSymbols = [
      ...MARKET_INDICES.map(i => i.symbol),
      ...US_TREASURY_SYMBOLS.map(t => t.symbol),
      ...CURRENCY_PAIRS.map(c => c.symbol),
      ...COMMODITIES.map(c => c.symbol),
    ];

    const quotes = await Promise.all(
      allSymbols.map(async (symbol) => {
        try {
          const result = await yahooFinance.quote(symbol);
          return {
            symbol,
            price: result.regularMarketPrice ?? 0,
            change: result.regularMarketChange ?? 0,
            changePercent: result.regularMarketChangePercent ?? 0,
          };
        } catch {
          return { symbol, price: 0, change: 0, changePercent: 0 };
        }
      })
    );

    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    // Build indices data
    const indices: IndexData[] = MARKET_INDICES.map(idx => {
      const quote = quoteMap.get(idx.symbol);
      return {
        symbol: idx.symbol,
        name: idx.name,
        price: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
      };
    });

    // Build commodities data with historical changes
    // Calculate dates for YTD and 1 month ago
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Fetch historical data for commodities
    const commodityHistorical = await Promise.all(
      COMMODITIES.map(async (c) => {
        try {
          const chart = await yahooFinance.chart(c.symbol, {
            period1: yearStart,
            period2: now,
            interval: '1d',
          });
          const quotes = chart.quotes || [];
          if (quotes.length === 0) return { symbol: c.symbol, ytdPrice: null, monthPrice: null };

          // YTD price (first trading day of year)
          const ytdPrice = quotes[0]?.close || null;

          // Find price ~1 month ago
          const monthAgoTimestamp = oneMonthAgo.getTime();
          let monthPrice: number | null = null;
          for (const q of quotes) {
            if (q.date && new Date(q.date).getTime() >= monthAgoTimestamp) {
              monthPrice = q.close || null;
              break;
            }
          }

          return { symbol: c.symbol, ytdPrice, monthPrice };
        } catch {
          return { symbol: c.symbol, ytdPrice: null, monthPrice: null };
        }
      })
    );

    const historicalMap = new Map(commodityHistorical.map(h => [h.symbol, h]));

    const commodities: CommodityData[] = COMMODITIES.map(c => {
      const quote = quoteMap.get(c.symbol);
      const historical = historicalMap.get(c.symbol);
      const currentPrice = quote?.price || 0;

      // Calculate YTD change
      let ytdChangePercent = 0;
      if (historical?.ytdPrice && historical.ytdPrice > 0) {
        ytdChangePercent = ((currentPrice - historical.ytdPrice) / historical.ytdPrice) * 100;
      }

      // Calculate 1 month change
      let monthChangePercent = 0;
      if (historical?.monthPrice && historical.monthPrice > 0) {
        monthChangePercent = ((currentPrice - historical.monthPrice) / historical.monthPrice) * 100;
      }

      return {
        symbol: c.symbol,
        name: c.name,
        category: c.category,
        price: currentPrice,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
        monthChangePercent,
        ytdChangePercent,
        unit: c.unit,
      };
    }).filter(c => c.price > 0);

    // Build US treasury yields
    const treasuryYields: YieldCurvePoint[] = US_TREASURY_SYMBOLS.map(t => {
      const quote = quoteMap.get(t.symbol);
      return {
        tenor: t.tenor,
        months: t.months,
        yield: quote?.price || 0,
        change: quote?.change || 0,
      };
    }).filter(y => y.yield > 0);

    // Build currency data
    const currencies: CurrencyData[] = CURRENCY_PAIRS.map(c => {
      const quote = quoteMap.get(c.symbol);
      return {
        pair: c.pair,
        name: c.name,
        rate: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
      };
    }).filter(c => c.rate > 0);

    // Global yields - US is the primary, others are separate
    const globalYields: CountryYields[] = [
      {
        country: 'United States',
        flag: '🇺🇸',
        yields: treasuryYields,
      },
    ];

    const result: MarketOverviewData = {
      indices,
      commodities,
      treasuryYields, // Keep for backward compat
      globalYields,
      currencies,
      marketStatus: getMarketStatus(),
      lastUpdated: new Date().toISOString(),
    };

    // Cache
    overviewCache.set(CACHE_KEY, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching market overview:', error);
    return NextResponse.json({
      indices: [],
      commodities: [],
      treasuryYields: [],
      globalYields: [],
      currencies: [],
      marketStatus: getMarketStatus(),
      lastUpdated: new Date().toISOString(),
    });
  }
}
