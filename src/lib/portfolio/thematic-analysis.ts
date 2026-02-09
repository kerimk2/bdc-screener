import type { EnrichedPosition } from '@/types/portfolio';

// Investment themes with keywords for matching
export interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  keywords: string[];
  industries: string[];
  tickers: string[]; // Well-known stocks in this theme
}

export const INVESTMENT_THEMES: Theme[] = [
  {
    id: 'ai-ml',
    name: 'AI & Machine Learning',
    description: 'Companies leading in artificial intelligence and machine learning',
    color: '#8B5CF6', // purple
    keywords: ['artificial intelligence', 'machine learning', 'neural', 'ai platform', 'generative ai', 'llm'],
    industries: ['Software—Infrastructure', 'Information Technology Services'],
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'GOOG', 'META', 'AMD', 'PLTR', 'AI', 'PATH', 'SNOW', 'MDB', 'DDOG', 'CRM', 'NOW', 'ADBE', 'IBM', 'ORCL'],
  },
  {
    id: 'cloud',
    name: 'Cloud Computing',
    description: 'Cloud infrastructure and software-as-a-service providers',
    color: '#3B82F6', // blue
    keywords: ['cloud', 'saas', 'infrastructure as a service', 'platform as a service', 'aws', 'azure'],
    industries: ['Software—Infrastructure', 'Software—Application', 'Information Technology Services'],
    tickers: ['AMZN', 'MSFT', 'GOOGL', 'GOOG', 'CRM', 'NOW', 'SNOW', 'NET', 'DDOG', 'MDB', 'TWLO', 'ZS', 'CRWD', 'OKTA', 'DBX', 'BOX'],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'Companies protecting digital assets and infrastructure',
    color: '#EF4444', // red
    keywords: ['security', 'cyber', 'firewall', 'encryption', 'identity', 'zero trust'],
    industries: ['Software—Infrastructure', 'Information Technology Services'],
    tickers: ['CRWD', 'PANW', 'ZS', 'FTNT', 'OKTA', 'S', 'CYBR', 'TENB', 'QLYS', 'RPD', 'VRNS', 'NET'],
  },
  {
    id: 'clean-energy',
    name: 'Clean Energy',
    description: 'Renewable energy and sustainability-focused companies',
    color: '#10B981', // green
    keywords: ['solar', 'wind', 'renewable', 'clean energy', 'sustainable', 'green', 'hydrogen', 'battery storage'],
    industries: ['Solar', 'Utilities—Renewable', 'Electrical Equipment & Parts'],
    tickers: ['ENPH', 'SEDG', 'FSLR', 'RUN', 'NEE', 'BEP', 'PLUG', 'BE', 'NOVA', 'CSIQ', 'JKS', 'SPWR', 'ARRY', 'STEM'],
  },
  {
    id: 'ev',
    name: 'Electric Vehicles',
    description: 'EV manufacturers and related supply chain',
    color: '#06B6D4', // cyan
    keywords: ['electric vehicle', 'ev', 'battery', 'charging', 'autonomous driving', 'self-driving'],
    industries: ['Auto Manufacturers', 'Auto Parts', 'Electrical Equipment & Parts'],
    tickers: ['TSLA', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'F', 'GM', 'CHPT', 'BLNK', 'EVGO', 'QS', 'PCAR', 'APTV'],
  },
  {
    id: 'fintech',
    name: 'Fintech & Payments',
    description: 'Digital payments and financial technology innovators',
    color: '#F59E0B', // amber
    keywords: ['payment', 'fintech', 'digital bank', 'cryptocurrency', 'blockchain', 'buy now pay later'],
    industries: ['Credit Services', 'Financial Data & Stock Exchanges', 'Software—Infrastructure'],
    tickers: ['V', 'MA', 'PYPL', 'SQ', 'AFRM', 'SOFI', 'COIN', 'HOOD', 'UPST', 'BILL', 'FOUR', 'NU', 'ADYEN', 'FIS', 'FISV', 'GPN'],
  },
  {
    id: 'biotech',
    name: 'Biotech & Healthcare Innovation',
    description: 'Biotechnology and healthcare technology companies',
    color: '#EC4899', // pink
    keywords: ['biotech', 'gene therapy', 'crispr', 'mrna', 'immunotherapy', 'precision medicine', 'telehealth'],
    industries: ['Biotechnology', 'Drug Manufacturers—General', 'Health Information Services', 'Medical Devices'],
    tickers: ['MRNA', 'BNTX', 'REGN', 'VRTX', 'BIIB', 'GILD', 'AMGN', 'ILMN', 'CRSP', 'EDIT', 'NTLA', 'BEAM', 'TDOC', 'VEEV', 'ISRG', 'DXCM'],
  },
  {
    id: 'semiconductors',
    name: 'Semiconductors',
    description: 'Chip makers and semiconductor equipment',
    color: '#6366F1', // indigo
    keywords: ['semiconductor', 'chip', 'processor', 'gpu', 'foundry', 'fab', 'wafer'],
    industries: ['Semiconductors', 'Semiconductor Equipment & Materials'],
    tickers: ['NVDA', 'AMD', 'INTC', 'TSM', 'ASML', 'AVGO', 'QCOM', 'TXN', 'LRCX', 'AMAT', 'KLAC', 'MU', 'MRVL', 'ON', 'ADI', 'NXPI', 'ARM'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce & Digital Retail',
    description: 'Online retail and digital commerce platforms',
    color: '#F97316', // orange
    keywords: ['ecommerce', 'e-commerce', 'online retail', 'marketplace', 'digital commerce'],
    industries: ['Internet Retail', 'Specialty Retail'],
    tickers: ['AMZN', 'SHOP', 'MELI', 'SE', 'BABA', 'JD', 'PDD', 'ETSY', 'EBAY', 'W', 'CHWY', 'WISH', 'CPNG'],
  },
  {
    id: 'streaming',
    name: 'Streaming & Entertainment',
    description: 'Digital media and streaming platforms',
    color: '#A855F7', // purple
    keywords: ['streaming', 'content', 'entertainment', 'gaming', 'esports', 'metaverse'],
    industries: ['Entertainment', 'Electronic Gaming & Multimedia', 'Internet Content & Information'],
    tickers: ['NFLX', 'DIS', 'WBD', 'PARA', 'SPOT', 'ROKU', 'RBLX', 'U', 'EA', 'TTWO', 'ATVI', 'SONY'],
  },
  {
    id: '5g-connectivity',
    name: '5G & Connectivity',
    description: 'Telecommunications and 5G infrastructure',
    color: '#0EA5E9', // sky
    keywords: ['5g', 'wireless', 'telecom', 'network infrastructure', 'fiber'],
    industries: ['Telecom Services', 'Communication Equipment'],
    tickers: ['T', 'VZ', 'TMUS', 'AMT', 'CCI', 'SBAC', 'ERIC', 'NOK', 'CSCO', 'JNPR', 'COMM', 'LITE'],
  },
  {
    id: 'space-defense',
    name: 'Space & Defense',
    description: 'Aerospace, defense, and space exploration',
    color: '#64748B', // slate
    keywords: ['space', 'satellite', 'defense', 'aerospace', 'military', 'rocket'],
    industries: ['Aerospace & Defense', 'Scientific & Technical Instruments'],
    tickers: ['LMT', 'RTX', 'NOC', 'BA', 'GD', 'LHX', 'LDOS', 'RKLB', 'SPCE', 'ASTS', 'IRDM', 'KTOS'],
  },
  {
    id: 'dividend-growth',
    name: 'Dividend Growth',
    description: 'Companies with strong dividend growth history',
    color: '#22C55E', // green
    keywords: ['dividend aristocrat', 'dividend king'],
    industries: [],
    tickers: ['JNJ', 'PG', 'KO', 'PEP', 'MMM', 'ABT', 'MCD', 'WMT', 'HD', 'LOW', 'TGT', 'CL', 'SYY', 'ADM', 'ADP', 'AFL', 'BDX', 'CAH', 'CVX', 'XOM', 'O', 'ABBV'],
  },
];

export interface ThemeExposure {
  theme: Theme;
  positions: {
    symbol: string;
    name: string;
    weight: number;
    marketValue: number;
  }[];
  totalWeight: number;
  totalValue: number;
  positionCount: number;
}

export interface ThematicAnalysis {
  exposures: ThemeExposure[];
  uncategorized: {
    symbol: string;
    name: string;
    weight: number;
    marketValue: number;
  }[];
  totalCategorizedWeight: number;
}

/**
 * Analyze portfolio positions and categorize them by investment themes
 */
export function analyzeThematicExposure(
  positions: EnrichedPosition[],
  metadata: Map<string, { name?: string; industry?: string; sector?: string }>
): ThematicAnalysis {
  const themeExposures: Map<string, ThemeExposure> = new Map();
  const positionThemes: Map<string, Set<string>> = new Map(); // Track which themes each position belongs to

  // Initialize theme exposures
  for (const theme of INVESTMENT_THEMES) {
    themeExposures.set(theme.id, {
      theme,
      positions: [],
      totalWeight: 0,
      totalValue: 0,
      positionCount: 0,
    });
  }

  // Analyze each position
  for (const position of positions) {
    const symbol = position.symbol.toUpperCase();
    const meta = metadata.get(symbol);
    const name = meta?.name || position.symbol;
    const industry = meta?.industry?.toLowerCase() || '';
    const nameLower = name.toLowerCase();

    const matchedThemes = new Set<string>();

    // Check each theme for matches
    for (const theme of INVESTMENT_THEMES) {
      let isMatch = false;

      // Check ticker list (most reliable)
      if (theme.tickers.includes(symbol)) {
        isMatch = true;
      }

      // Check industry match
      if (!isMatch && theme.industries.length > 0) {
        for (const themeIndustry of theme.industries) {
          if (industry.includes(themeIndustry.toLowerCase())) {
            isMatch = true;
            break;
          }
        }
      }

      // Check keyword match in company name or industry
      if (!isMatch && theme.keywords.length > 0) {
        for (const keyword of theme.keywords) {
          if (nameLower.includes(keyword) || industry.includes(keyword)) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        matchedThemes.add(theme.id);
        const exposure = themeExposures.get(theme.id)!;
        exposure.positions.push({
          symbol,
          name,
          weight: position.weight,
          marketValue: position.marketValue,
        });
        exposure.totalWeight += position.weight;
        exposure.totalValue += position.marketValue;
        exposure.positionCount += 1;
      }
    }

    positionThemes.set(symbol, matchedThemes);
  }

  // Sort positions within each theme by weight
  for (const exposure of themeExposures.values()) {
    exposure.positions.sort((a, b) => b.weight - a.weight);
  }

  // Find uncategorized positions
  const uncategorized: ThematicAnalysis['uncategorized'] = [];
  for (const position of positions) {
    const symbol = position.symbol.toUpperCase();
    const themes = positionThemes.get(symbol);
    if (!themes || themes.size === 0) {
      const meta = metadata.get(symbol);
      uncategorized.push({
        symbol,
        name: meta?.name || position.symbol,
        weight: position.weight,
        marketValue: position.marketValue,
      });
    }
  }

  // Sort themes by total weight (descending)
  const sortedExposures = Array.from(themeExposures.values())
    .filter(e => e.positionCount > 0)
    .sort((a, b) => b.totalWeight - a.totalWeight);

  // Calculate total categorized weight (positions can be in multiple themes)
  const totalCategorizedWeight = positions
    .filter(p => {
      const themes = positionThemes.get(p.symbol.toUpperCase());
      return themes && themes.size > 0;
    })
    .reduce((sum, p) => sum + p.weight, 0);

  return {
    exposures: sortedExposures,
    uncategorized: uncategorized.sort((a, b) => b.weight - a.weight),
    totalCategorizedWeight,
  };
}

/**
 * Get color class for theme weight indicator
 */
export function getThemeWeightLevel(weight: number): { label: string; color: string } {
  if (weight >= 20) return { label: 'Heavy', color: 'text-red-600 dark:text-red-400' };
  if (weight >= 10) return { label: 'Significant', color: 'text-orange-600 dark:text-orange-400' };
  if (weight >= 5) return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
  if (weight > 0) return { label: 'Light', color: 'text-green-600 dark:text-green-400' };
  return { label: 'None', color: 'text-gray-400' };
}
