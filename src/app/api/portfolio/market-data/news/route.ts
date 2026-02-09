import { NextRequest, NextResponse } from 'next/server';
import { LRUCache, cleanupCachesIfNeeded } from '@/lib/portfolio/api-utils';

// API Keys
const MARKETAUX_API_KEY = process.env.MARKETAUX_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const MARKETAUX_BASE_URL = 'https://api.marketaux.com/v1';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// LRU Cache for news data (1 hour TTL)
const newsDataCache = new LRUCache<NewsItem[]>({ maxSize: 100, ttlMs: 60 * 60 * 1000 });

interface NewsItem {
  title: string;
  url: string;
  publishedDate: string;
  image: string | null;
  site: string;
  text: string;
  symbol: string;
  sourcePriority: number;
  importance: number;
}

// Keywords that indicate opinion/low-quality content to filter out
const EXCLUDE_KEYWORDS = [
  'opinion',
  'editorial',
  'column',
  'commentary',
  'my take',
  'i think',
  'why i',
  'here\'s why',
  'should you',
  'could be',
  'might be',
  'what i',
  'cramer',
  'jim cramer',
  'mad money',
  'lightning round',
  'top picks',
  'best stocks',
  'worst stocks',
  'buy now',
  'sell now',
  'hot stocks',
  'meme stock',
  'reddit',
  'wallstreetbets',
  'wsb',
];

// Trusted news sources (prioritize these)
const TRUSTED_SOURCES = [
  'reuters',
  'bloomberg',
  'wall street journal',
  'wsj',
  'financial times',
  'ft',
  'associated press',
  'ap news',
  'sec',
  'pr newswire',
  'business wire',
  'globe newswire',
  'benzinga',
  'marketwatch',
  'cnbc',
  'barrons',
  'seeking alpha',
  'yahoo finance',
  'investing.com',
];

// Keywords indicating high-importance news
const HIGH_IMPORTANCE_KEYWORDS = [
  'earnings',
  'quarterly results',
  'revenue',
  'profit',
  'loss',
  'guidance',
  'forecast',
  'acquisition',
  'merger',
  'acquires',
  'to acquire',
  'deal',
  'buyout',
  'takeover',
  'dividend',
  'stock split',
  'ceo',
  'cfo',
  'executive',
  'resigns',
  'appoints',
  'sec filing',
  'fda',
  'approval',
  'patent',
  'lawsuit',
  'settlement',
  'investigation',
  'recall',
  'layoff',
  'restructuring',
  'bankruptcy',
  'ipo',
  'offering',
  'upgrade',
  'downgrade',
  'price target',
  'beats estimates',
  'misses estimates',
  'guidance raised',
  'guidance lowered',
];

function getImportanceScore(title: string, summary: string, source: string): number {
  const text = `${title} ${summary}`.toLowerCase();
  const sourceLower = source.toLowerCase();

  let score = 0;

  for (const keyword of HIGH_IMPORTANCE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 10;
    }
  }

  if (TRUSTED_SOURCES.some(ts => sourceLower.includes(ts))) {
    score += 5;
  }

  if (sourceLower.includes('pr newswire') || sourceLower.includes('business wire') || sourceLower.includes('globe newswire')) {
    score += 8;
  }

  return score;
}

function isOpinionPiece(title: string, summary: string): boolean {
  const text = `${title} ${summary}`.toLowerCase();
  return EXCLUDE_KEYWORDS.some(keyword => text.includes(keyword));
}

function getSourcePriority(source: string): number {
  const sourceLower = source.toLowerCase();
  if (TRUSTED_SOURCES.some(ts => sourceLower.includes(ts))) {
    return 0;
  }
  if (sourceLower.includes('yahoo') || sourceLower.includes('seeking alpha')) {
    return 1;
  }
  return 2;
}

// Fetch news from Marketaux (supports multiple tickers in one call)
async function fetchFromMarketaux(symbols: string[]): Promise<NewsItem[]> {
  if (!MARKETAUX_API_KEY || symbols.length === 0) return [];

  try {
    // Marketaux supports comma-separated symbols
    const tickerList = symbols.join(',');
    const url = `${MARKETAUX_BASE_URL}/news/all?symbols=${tickerList}&filter_entities=true&language=en&api_token=${MARKETAUX_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Marketaux news API error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      console.log(`Marketaux returned no data for symbols: ${tickerList}`);
      return [];
    }

    console.log(`Marketaux returned ${data.data.length} news items for [${tickerList}]`);

    return data.data.flatMap((item: {
      title?: string;
      url?: string;
      published_at?: string;
      image_url?: string;
      source?: string;
      description?: string;
      entities?: Array<{ symbol?: string; type?: string }>;
    }) => {
      // Extract ticker symbols from entities
      const tickerSymbols = (item.entities || [])
        .filter(e => e.type === 'equity' && e.symbol)
        .map(e => e.symbol!.toUpperCase())
        .filter(s => symbols.includes(s));

      // If no matching symbols, use the first symbol from our list as default
      const matchedSymbols = tickerSymbols.length > 0 ? tickerSymbols : [symbols[0]];

      // Create a news item for each matched symbol
      return matchedSymbols.map(symbol => ({
        title: item.title || '',
        url: item.url || '',
        publishedDate: item.published_at || '',
        image: item.image_url || null,
        site: item.source || '',
        text: item.description || '',
        symbol: symbol,
        sourcePriority: getSourcePriority(item.source || ''),
        importance: getImportanceScore(item.title || '', item.description || '', item.source || ''),
      }));
    });
  } catch (err) {
    console.error('Error fetching from Marketaux:', err);
    return [];
  }
}

// Fetch news from Finnhub (fallback, one symbol at a time)
async function fetchFromFinnhub(symbol: string): Promise<NewsItem[]> {
  if (!FINNHUB_API_KEY) return [];

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromDate = weekAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      if (response.status !== 429) {
        console.error(`Finnhub news API error for ${symbol}: ${response.status}`);
      }
      return [];
    }

    const data = await response.json();

    return (data || []).slice(0, 5).map((item: {
      headline?: string;
      url?: string;
      datetime?: number;
      image?: string;
      source?: string;
      summary?: string;
    }) => ({
      title: item.headline || '',
      url: item.url || '',
      publishedDate: item.datetime ? new Date(item.datetime * 1000).toISOString() : '',
      image: item.image || null,
      site: item.source || '',
      text: item.summary || '',
      symbol: symbol,
      sourcePriority: getSourcePriority(item.source || ''),
      importance: getImportanceScore(item.headline || '', item.summary || '', item.source || ''),
    }));
  } catch (err) {
    console.error(`Error fetching from Finnhub for ${symbol}:`, err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  cleanupCachesIfNeeded();

  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const sortBy = searchParams.get('sort') || 'importance';

  if (!symbols) {
    return NextResponse.json([]);
  }

  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbolList.length === 0) {
    return NextResponse.json([]);
  }

  // Check cache
  const cacheKey = `${[...symbolList].sort().join(',')}:${sortBy}`;
  const cached = newsDataCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached.slice(0, limit));
  }

  try {
    let allNews: NewsItem[] = [];

    // Strategy: Use BOTH sources in parallel for better coverage
    // Marketaux free tier only returns ~3 articles per request, so we batch symbols
    // Finnhub provides good per-symbol coverage but has rate limits

    const newsPromises: Promise<NewsItem[]>[] = [];

    // Step 1: Batch Marketaux requests (5-8 symbols per batch to maximize coverage)
    if (MARKETAUX_API_KEY) {
      const MARKETAUX_BATCH_SIZE = 6;
      for (let i = 0; i < symbolList.length; i += MARKETAUX_BATCH_SIZE) {
        const batch = symbolList.slice(i, i + MARKETAUX_BATCH_SIZE);
        newsPromises.push(fetchFromMarketaux(batch));
      }
    }

    // Step 2: Also fetch from Finnhub in parallel (for top 15 symbols to stay within rate limits)
    if (FINNHUB_API_KEY) {
      const finnhubSymbols = symbolList.slice(0, 15);
      for (const symbol of finnhubSymbols) {
        newsPromises.push(fetchFromFinnhub(symbol));
      }
    }

    // Wait for all requests
    const results = await Promise.all(newsPromises);
    allNews = results.flat();

    console.log(`Fetched ${allNews.length} total news items from all sources`);

    // Filter out opinion pieces
    allNews = allNews.filter(item => !isOpinionPiece(item.title, item.text));

    // Remove duplicates by URL
    const seenUrls = new Set<string>();
    allNews = allNews.filter(item => {
      if (!item.url || seenUrls.has(item.url)) return false;
      seenUrls.add(item.url);
      return true;
    });

    // Sort based on preference
    if (sortBy === 'recent') {
      allNews.sort((a, b) => {
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      });
    } else {
      allNews.sort((a, b) => {
        if (a.importance !== b.importance) {
          return b.importance - a.importance;
        }
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      });
    }

    // Cache the results
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cacheData = allNews.map(({ sourcePriority, importance, ...rest }) => rest);
    newsDataCache.set(cacheKey, cacheData as NewsItem[]);

    // Return limited results
    const result = cacheData.slice(0, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json([]);
  }
}
