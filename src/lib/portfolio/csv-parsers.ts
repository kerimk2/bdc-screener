interface ParsedPosition {
  symbol: string;
  shares: number;
  costBasis: number;
  purchaseDate?: string;
  assetType?: string;
}

interface ParseResult {
  success: boolean;
  positions: ParsedPosition[];
  errors: string[];
  broker: string;
}

// Detect broker format from CSV headers
export function detectBrokerFormat(headers: string[]): string | null {
  const headerStr = headers.join(',').toLowerCase();

  if (headerStr.includes('schwab') || (headerStr.includes('symbol') && headerStr.includes('quantity') && headerStr.includes('cost basis'))) {
    return 'schwab';
  }
  if (headerStr.includes('fidelity') || (headerStr.includes('symbol') && headerStr.includes('current value') && headerStr.includes('quantity'))) {
    return 'fidelity';
  }
  if (headerStr.includes('vanguard') || (headerStr.includes('account number') && headerStr.includes('investment name'))) {
    return 'vanguard';
  }
  if (headerStr.includes('td ameritrade') || headerStr.includes('tda') || (headerStr.includes('symbol') && headerStr.includes('qty') && headerStr.includes('cost'))) {
    return 'tdameritrade';
  }
  if (headerStr.includes('robinhood') || (headerStr.includes('instrument') && headerStr.includes('quantity') && headerStr.includes('average cost'))) {
    return 'robinhood';
  }
  if (headerStr.includes('etrade') || headerStr.includes('e*trade')) {
    return 'etrade';
  }
  if (headerStr.includes('merrill') || headerStr.includes('edge')) {
    return 'merrill';
  }

  return null;
}

// Parse CSV string into rows
function parseCSVRows(csv: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  // Handle potential BOM and clean headers
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_'));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// Clean number string (remove $, commas, parentheses for negative)
function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s]/g, '');
  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

// Parse Schwab CSV format
function parseSchwab(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = row.symbol?.toUpperCase();
    if (!symbol || symbol === 'CASH' || symbol.includes('SWEEP')) continue;

    const shares = parseNumber(row.quantity || row.qty);
    const costBasis = parseNumber(row.cost_basis || row.cost_basis_total);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis: costBasis || shares * parseNumber(row.price),
        assetType: detectAssetType(symbol, row.description || row.security_name),
      });
    }
  }

  return positions;
}

// Parse Fidelity CSV format
function parseFidelity(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = (row.symbol || row.ticker)?.toUpperCase();
    if (!symbol || symbol === 'CASH' || symbol === 'PENDING' || symbol.includes('**')) continue;

    const shares = parseNumber(row.quantity || row.shares);
    const costBasis = parseNumber(row.cost_basis_total || row.cost_basis);
    const currentValue = parseNumber(row.current_value);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis: costBasis || currentValue * 0.9, // Estimate if not available
        assetType: detectAssetType(symbol, row.description),
      });
    }
  }

  return positions;
}

// Parse Vanguard CSV format
function parseVanguard(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = (row.symbol || row.ticker)?.toUpperCase();
    const investmentName = row.investment_name?.toLowerCase() || '';

    if (!symbol || investmentName.includes('settlement') || investmentName.includes('money market')) continue;

    const shares = parseNumber(row.shares || row.quantity);
    const costBasis = parseNumber(row.total_cost || row.cost_basis);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis,
        assetType: detectAssetType(symbol, row.investment_name),
      });
    }
  }

  return positions;
}

// Parse TD Ameritrade CSV format
function parseTDAmeritrade(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = row.symbol?.toUpperCase();
    if (!symbol || symbol === 'CASH' || symbol.includes('MMDA')) continue;

    const shares = parseNumber(row.qty || row.quantity);
    const costBasis = parseNumber(row.cost || row.cost_basis);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis,
        assetType: detectAssetType(symbol, row.description),
      });
    }
  }

  return positions;
}

// Parse Robinhood CSV format
function parseRobinhood(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = (row.instrument || row.symbol)?.toUpperCase();
    if (!symbol) continue;

    const shares = parseNumber(row.quantity);
    const avgCost = parseNumber(row.average_cost || row.avg_cost);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis: shares * avgCost,
        assetType: detectAssetType(symbol, row.name),
      });
    }
  }

  return positions;
}

// Parse E*Trade CSV format
function parseETrade(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = row.symbol?.toUpperCase();
    if (!symbol || symbol.includes('CASH')) continue;

    const shares = parseNumber(row.quantity || row.qty);
    const costBasis = parseNumber(row.cost_basis || row.total_cost);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis,
        assetType: detectAssetType(symbol, row.description),
      });
    }
  }

  return positions;
}

// Parse Merrill Edge CSV format
function parseMerrill(rows: Record<string, string>[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = row.symbol?.toUpperCase();
    if (!symbol || symbol === 'CASH') continue;

    const shares = parseNumber(row.quantity || row.shares);
    const costBasis = parseNumber(row.cost_basis || row.total_cost);

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis,
        assetType: detectAssetType(symbol, row.description),
      });
    }
  }

  return positions;
}

// Detect asset type from symbol and description
function detectAssetType(symbol: string, description?: string): string {
  const desc = description?.toLowerCase() || '';
  const sym = symbol.toUpperCase();

  // ETF detection
  if (desc.includes('etf') || desc.includes('exchange traded') ||
      sym.endsWith('X') || ['SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'DIA', 'VEA', 'VWO', 'BND', 'AGG'].includes(sym)) {
    return 'etf';
  }

  // Mutual fund detection
  if (desc.includes('mutual fund') || desc.includes('fund') || sym.length === 5 && sym.endsWith('X')) {
    return 'mutual_fund';
  }

  // Bond detection
  if (desc.includes('bond') || desc.includes('treasury') || desc.includes('note')) {
    return 'bond';
  }

  // Crypto detection
  if (['BTC', 'ETH', 'DOGE', 'SOL', 'ADA', 'XRP', 'DOT', 'AVAX', 'MATIC', 'LINK'].includes(sym) ||
      desc.includes('crypto') || desc.includes('bitcoin') || desc.includes('ethereum')) {
    return 'crypto';
  }

  // Option detection (usually has specific format)
  if (sym.length > 6 && /\d{6}[CP]\d+/.test(sym)) {
    return 'option';
  }

  return 'stock';
}

// Generic parser for unknown formats
function parseGeneric(rows: Record<string, string>[], headers: string[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];

  // Try to find relevant columns
  const symbolCol = headers.find(h => ['symbol', 'ticker', 'instrument', 'security'].includes(h));
  const sharesCol = headers.find(h => ['shares', 'quantity', 'qty', 'units'].includes(h));
  const costCol = headers.find(h => ['cost_basis', 'cost', 'total_cost', 'average_cost', 'avg_cost', 'book_cost'].includes(h));
  const descCol = headers.find(h => ['description', 'name', 'security_name', 'investment_name'].includes(h));

  if (!symbolCol || !sharesCol) {
    return positions;
  }

  for (const row of rows) {
    const symbol = row[symbolCol]?.toUpperCase();
    if (!symbol) continue;

    const shares = parseNumber(row[sharesCol]);
    const costBasis = costCol ? parseNumber(row[costCol]) : 0;

    if (shares > 0) {
      positions.push({
        symbol,
        shares,
        costBasis,
        assetType: detectAssetType(symbol, descCol ? row[descCol] : undefined),
      });
    }
  }

  return positions;
}

// Main parse function
export function parseCSV(csv: string): ParseResult {
  const errors: string[] = [];

  try {
    const { headers, rows } = parseCSVRows(csv);

    if (headers.length === 0 || rows.length === 0) {
      return {
        success: false,
        positions: [],
        errors: ['CSV file is empty or has no data rows'],
        broker: 'unknown',
      };
    }

    const broker = detectBrokerFormat(headers);
    let positions: ParsedPosition[] = [];

    switch (broker) {
      case 'schwab':
        positions = parseSchwab(rows);
        break;
      case 'fidelity':
        positions = parseFidelity(rows);
        break;
      case 'vanguard':
        positions = parseVanguard(rows);
        break;
      case 'tdameritrade':
        positions = parseTDAmeritrade(rows);
        break;
      case 'robinhood':
        positions = parseRobinhood(rows);
        break;
      case 'etrade':
        positions = parseETrade(rows);
        break;
      case 'merrill':
        positions = parseMerrill(rows);
        break;
      default:
        positions = parseGeneric(rows, headers);
    }

    if (positions.length === 0) {
      errors.push('No valid positions found in CSV');
    }

    return {
      success: positions.length > 0,
      positions,
      errors,
      broker: broker || 'generic',
    };
  } catch (error) {
    return {
      success: false,
      positions: [],
      errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      broker: 'unknown',
    };
  }
}

// Aggregate duplicate symbols
export function aggregatePositions(positions: ParsedPosition[]): ParsedPosition[] {
  const symbolMap = new Map<string, ParsedPosition>();

  for (const position of positions) {
    const existing = symbolMap.get(position.symbol);
    if (existing) {
      existing.shares += position.shares;
      existing.costBasis += position.costBasis;
    } else {
      symbolMap.set(position.symbol, { ...position });
    }
  }

  return Array.from(symbolMap.values());
}

// Validate positions before import
export function validatePositions(positions: ParsedPosition[]): { valid: ParsedPosition[]; invalid: { position: ParsedPosition; reason: string }[] } {
  const valid: ParsedPosition[] = [];
  const invalid: { position: ParsedPosition; reason: string }[] = [];

  for (const position of positions) {
    // Symbol validation
    if (!position.symbol || position.symbol.length > 10 || !/^[A-Z0-9.]+$/.test(position.symbol)) {
      invalid.push({ position, reason: 'Invalid symbol format' });
      continue;
    }

    // Shares validation
    if (position.shares <= 0 || !isFinite(position.shares)) {
      invalid.push({ position, reason: 'Invalid share count' });
      continue;
    }

    // Cost basis validation (warn but allow 0)
    if (position.costBasis < 0 || !isFinite(position.costBasis)) {
      invalid.push({ position, reason: 'Invalid cost basis' });
      continue;
    }

    valid.push(position);
  }

  return { valid, invalid };
}
