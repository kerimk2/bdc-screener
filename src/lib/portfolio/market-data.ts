import { Quote, CompanyProfile, HistoricalPrice, NewsItem, OptionsChainResponse } from '@/types/portfolio';

// Cache for API responses to reduce calls
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache for quotes
const CACHE_TTL_LONG = 24 * 60 * 60 * 1000; // 24 hour cache for profiles
const CACHE_TTL_HISTORY = 60 * 60 * 1000; // 1 hour for historical prices (past data doesn't change)

function getCached<T>(key: string, ttl: number): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const cacheKey = `quote:${symbol}`;
  const cached = getCached<Quote[]>(cacheKey, CACHE_TTL);
  if (cached) return cached[0] || null;

  try {
    const response = await fetch(
      `/api/portfolio/market-data/quote?symbols=${symbol.toUpperCase()}`
    );

    if (!response.ok) {
      console.error(`Failed to fetch quote for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data[0] || null;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  if (symbols.length === 0) return new Map();

  // Check cache first
  const results = new Map<string, Quote>();
  const uncachedSymbols: string[] = [];

  for (const symbol of symbols) {
    const cacheKey = `quote:${symbol}`;
    const cached = getCached<Quote[]>(cacheKey, CACHE_TTL);
    if (cached && cached[0]) {
      results.set(symbol.toUpperCase(), cached[0]);
    } else {
      uncachedSymbols.push(symbol);
    }
  }

  if (uncachedSymbols.length === 0) return results;

  try {
    // Batch fetch uncached symbols
    const symbolList = uncachedSymbols.map(s => s.toUpperCase()).join(',');
    const response = await fetch(
      `/api/portfolio/market-data/quote?symbols=${symbolList}`
    );

    if (!response.ok) {
      console.error(`Failed to fetch quotes: ${response.status}`);
      return results;
    }

    const data: Quote[] = await response.json();

    for (const quote of data) {
      results.set(quote.symbol, quote);
      setCache(`quote:${quote.symbol}`, [quote]);
    }

    return results;
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return results;
  }
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const cacheKey = `profile:${symbol}`;
  const cached = getCached<CompanyProfile[]>(cacheKey, CACHE_TTL_LONG);
  if (cached) return cached[0] || null;

  try {
    const response = await fetch(
      `/api/portfolio/market-data/profile?symbol=${symbol.toUpperCase()}`
    );

    if (!response.ok) {
      console.error(`Failed to fetch profile for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data[0] || null;
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error);
    return null;
  }
}

export async function getHistoricalPrices(
  symbol: string,
  from?: string,
  to?: string
): Promise<HistoricalPrice[]> {
  const cacheKey = `history:${symbol}:${from}:${to}`;
  const cached = getCached<{ historical: HistoricalPrice[] }>(cacheKey, CACHE_TTL_HISTORY);
  if (cached) return cached.historical || [];

  try {
    let url = `/api/portfolio/market-data/history?symbol=${symbol.toUpperCase()}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch historical prices for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data.historical || [];
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
}

export async function searchSymbol(query: string): Promise<Array<{ symbol: string; name: string; exchangeShortName: string }>> {
  if (!query || query.length < 1) return [];

  const cacheKey = `search:${query}`;
  const cached = getCached<Array<{ symbol: string; name: string; exchangeShortName: string }>>(cacheKey, CACHE_TTL_LONG);
  if (cached) return cached;

  try {
    const response = await fetch(
      `/api/portfolio/market-data/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      console.error(`Failed to search for ${query}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Error searching for ${query}:`, error);
    return [];
  }
}

export async function getNews(
  symbols?: string[],
  limit: number = 20,
  sort: 'importance' | 'recent' = 'importance'
): Promise<NewsItem[]> {
  try {
    let url = `/api/portfolio/market-data/news?limit=${limit}&sort=${sort}`;
    if (symbols && symbols.length > 0) {
      const symbolList = symbols.map(s => s.toUpperCase()).join(',');
      url += `&symbols=${symbolList}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch news: ${response.status}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

export async function getSectorPerformance(): Promise<Array<{ sector: string; changesPercentage: string }>> {
  try {
    const response = await fetch(`/api/portfolio/market-data/sector-performance`);

    if (!response.ok) {
      console.error(`Failed to fetch sector performance: ${response.status}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching sector performance:', error);
    return [];
  }
}

export interface FundamentalsData {
  symbol: string;
  peRatio: number | null;
  forwardPE: number | null;
  evToEbitda: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  ytdReturn: number | null;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  // Forward dividends
  dividendYield: number | null;
  dividendRate: number | null;
  payoutRatio: number | null;
  // Trailing dividends (actual paid over last 12 months)
  trailingAnnualDividendYield: number | null;
  trailingAnnualDividendRate: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  beta: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  revenue: number | null;
  ebitda: number | null;
  // Additional financial metrics
  operatingCashflow: number | null;
  netIncome: number | null;
  freeCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  bookValue: number | null;
  quoteType: string | null;
}

const CACHE_TTL_FUNDAMENTALS = 4 * 60 * 60 * 1000; // 4 hours for fundamentals (changes quarterly)

export async function getFundamentals(symbols: string[]): Promise<Map<string, FundamentalsData>> {
  if (symbols.length === 0) return new Map();

  const results = new Map<string, FundamentalsData>();
  const uncachedSymbols: string[] = [];

  // Check per-symbol client-side cache
  for (const symbol of symbols) {
    const upperSymbol = symbol.toUpperCase();
    const cached = getCached<FundamentalsData>(`fundamentals:${upperSymbol}`, CACHE_TTL_FUNDAMENTALS);
    if (cached) {
      results.set(upperSymbol, cached);
    } else {
      uncachedSymbols.push(upperSymbol);
    }
  }

  if (uncachedSymbols.length === 0) return results;

  try {
    const symbolList = uncachedSymbols.join(',');
    const response = await fetch(`/api/portfolio/market-data/fundamentals?symbols=${symbolList}`);

    if (!response.ok) {
      console.error(`Failed to fetch fundamentals: ${response.status}`);
      return results;
    }

    const data: FundamentalsData[] = await response.json();

    for (const item of data) {
      results.set(item.symbol, item);
      setCache(`fundamentals:${item.symbol}`, item);
    }

    return results;
  } catch (error) {
    console.error('Error fetching fundamentals:', error);
    return results;
  }
}

// Dividend history data
export interface DividendHistoryItem {
  symbol: string;
  date: string; // ex-date
  paymentDate: string;
  amount: number;
}

export async function getDividendHistory(symbol: string): Promise<DividendHistoryItem[]> {
  const cacheKey = `dividendHistory:${symbol}`;
  const cached = getCached<DividendHistoryItem[]>(cacheKey, CACHE_TTL_LONG);
  if (cached) return cached;

  try {
    const response = await fetch(
      `/api/portfolio/market-data/dividends?symbols=${symbol.toUpperCase()}&range=history`
    );

    if (!response.ok) {
      console.error(`Failed to fetch dividend history for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const items: DividendHistoryItem[] = Array.isArray(data) ? data.map((d: { symbol: string; date: string; payDate: string; amount: number }) => ({
      symbol: d.symbol,
      date: d.date,
      paymentDate: d.payDate,
      amount: d.amount,
    })) : [];

    setCache(cacheKey, items);
    return items;
  } catch (error) {
    console.error(`Error fetching dividend history for ${symbol}:`, error);
    return [];
  }
}

export async function getHistoricalPriceOnDate(symbol: string, date: string): Promise<number | null> {
  // Fetch a small range around the date to find the closest trading day
  const targetDate = new Date(date);
  const fromDate = new Date(targetDate);
  fromDate.setDate(fromDate.getDate() - 7); // Look back a week for weekends/holidays
  const toDate = new Date(targetDate);
  toDate.setDate(toDate.getDate() + 3); // Look forward a few days too

  const from = fromDate.toISOString().split('T')[0];
  const to = toDate.toISOString().split('T')[0];

  const history = await getHistoricalPrices(symbol, from, to);

  if (history.length === 0) return null;

  // Find the closest date <= target date
  const targetTime = targetDate.getTime();
  let closest = history[0];

  for (const price of history) {
    const priceTime = new Date(price.date).getTime();
    if (priceTime <= targetTime) {
      closest = price;
      break; // History is sorted descending, so first match <= target is closest
    }
  }

  return closest.close;
}

// Helper to map country to region
export function getRegionFromCountry(country: string): string {
  const regionMap: Record<string, string> = {
    // North America
    'US': 'North America',
    'USA': 'North America',
    'United States': 'North America',
    'CA': 'North America',
    'Canada': 'North America',
    'MX': 'North America',
    'Mexico': 'North America',

    // Europe
    'GB': 'Europe',
    'UK': 'Europe',
    'United Kingdom': 'Europe',
    'DE': 'Europe',
    'Germany': 'Europe',
    'FR': 'Europe',
    'France': 'Europe',
    'CH': 'Europe',
    'Switzerland': 'Europe',
    'NL': 'Europe',
    'Netherlands': 'Europe',
    'IE': 'Europe',
    'Ireland': 'Europe',
    'IT': 'Europe',
    'Italy': 'Europe',
    'ES': 'Europe',
    'Spain': 'Europe',
    'SE': 'Europe',
    'Sweden': 'Europe',
    'NO': 'Europe',
    'Norway': 'Europe',
    'DK': 'Europe',
    'Denmark': 'Europe',
    'FI': 'Europe',
    'Finland': 'Europe',
    'BE': 'Europe',
    'Belgium': 'Europe',
    'AT': 'Europe',
    'Austria': 'Europe',
    'PT': 'Europe',
    'Portugal': 'Europe',

    // Asia Pacific
    'JP': 'Asia Pacific',
    'Japan': 'Asia Pacific',
    'CN': 'Asia Pacific',
    'China': 'Asia Pacific',
    'HK': 'Asia Pacific',
    'Hong Kong': 'Asia Pacific',
    'KR': 'Asia Pacific',
    'South Korea': 'Asia Pacific',
    'TW': 'Asia Pacific',
    'Taiwan': 'Asia Pacific',
    'SG': 'Asia Pacific',
    'Singapore': 'Asia Pacific',
    'AU': 'Asia Pacific',
    'Australia': 'Asia Pacific',
    'NZ': 'Asia Pacific',
    'New Zealand': 'Asia Pacific',
    'IN': 'Asia Pacific',
    'India': 'Asia Pacific',

    // Emerging Markets
    'BR': 'Emerging Markets',
    'Brazil': 'Emerging Markets',
    'RU': 'Emerging Markets',
    'Russia': 'Emerging Markets',
    'ZA': 'Emerging Markets',
    'South Africa': 'Emerging Markets',
    'ID': 'Emerging Markets',
    'Indonesia': 'Emerging Markets',
    'TH': 'Emerging Markets',
    'Thailand': 'Emerging Markets',
    'MY': 'Emerging Markets',
    'Malaysia': 'Emerging Markets',
    'PH': 'Emerging Markets',
    'Philippines': 'Emerging Markets',
    'VN': 'Emerging Markets',
    'Vietnam': 'Emerging Markets',
    'CL': 'Emerging Markets',
    'Chile': 'Emerging Markets',
    'CO': 'Emerging Markets',
    'Colombia': 'Emerging Markets',
    'PE': 'Emerging Markets',
    'Peru': 'Emerging Markets',
    'AR': 'Emerging Markets',
    'Argentina': 'Emerging Markets',

    // Middle East
    'IL': 'Middle East',
    'Israel': 'Middle East',
    'AE': 'Middle East',
    'UAE': 'Middle East',
    'United Arab Emirates': 'Middle East',
    'SA': 'Middle East',
    'Saudi Arabia': 'Middle East',
  };

  return regionMap[country] || 'Other';
}

// Options chain data
const CACHE_TTL_OPTIONS = 5 * 60 * 1000; // 5 minutes for options (change frequently)

export async function getOptionsChain(
  symbol: string,
  date?: string
): Promise<OptionsChainResponse | null> {
  const cacheKey = `options:${symbol}:${date || 'all'}`;
  const cached = getCached<OptionsChainResponse>(cacheKey, CACHE_TTL_OPTIONS);
  if (cached) return cached;

  try {
    let url = `/api/portfolio/market-data/options?symbol=${symbol.toUpperCase()}`;
    if (date) url += `&date=${date}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch options chain for ${symbol}: ${response.status}`);
      return null;
    }

    const data: OptionsChainResponse = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Error fetching options chain for ${symbol}:`, error);
    return null;
  }
}
