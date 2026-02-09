import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAssetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stock: 'Stock',
    etf: 'ETF',
    bond: 'Bond',
    crypto: 'Crypto',
    option: 'Option',
    mutual_fund: 'Mutual Fund',
    other: 'Other',
  };
  return labels[type] || type;
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    brokerage: 'Brokerage',
    ira: 'IRA',
    roth_ira: 'Roth IRA',
    '401k': '401(k)',
    crypto: 'Crypto',
    other: 'Other',
  };
  return labels[type] || type;
}

export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function downloadFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Color utilities for charts - expanded palette with 24 distinct colors
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#0ea5e9', // sky-500
  '#f43f5e', // rose-500
  '#64748b', // slate-500
  '#d946ef', // fuchsia-500
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#0891b2', // cyan-600
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Sector colors - specific colors for each sector category
export const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#3b82f6',        // blue
  'Healthcare': '#10b981',        // emerald
  'Financial Services': '#f59e0b', // amber
  'Consumer Cyclical': '#ef4444', // red
  'Communication Services': '#8b5cf6', // violet
  'Industrials': '#64748b',       // slate
  'Consumer Defensive': '#ec4899', // pink
  'Energy': '#f97316',            // orange
  'Utilities': '#06b6d4',         // cyan
  'Real Estate': '#84cc16',       // lime
  'Basic Materials': '#a855f7',   // purple
  'Fixed Income': '#14b8a6',      // teal
  'Cash & Equivalents': '#22c55e', // green
  'Commodities': '#eab308',       // yellow
  'Multi-Asset': '#6366f1',       // indigo
  'Index/Broad': '#0ea5e9',       // sky
  'Cash': '#22c55e',              // green (same as Cash & Equivalents)
  'Unknown': '#9ca3af',           // gray
  'Other': '#78716c',             // stone
};

export function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || SECTOR_COLORS['Unknown'];
}

// Region colors for geographic charts
export const REGION_COLORS: Record<string, string> = {
  'North America': '#3b82f6',     // blue
  'Europe': '#10b981',            // emerald
  'Asia Pacific': '#f59e0b',      // amber
  'Emerging Markets': '#ef4444',  // red
  'Middle East': '#8b5cf6',       // violet
  'Latin America': '#ec4899',     // pink
  'Global': '#6366f1',            // indigo
  'Other': '#9ca3af',             // gray
  'Unknown': '#78716c',           // stone
};

export function getRegionColor(region: string): string {
  return REGION_COLORS[region] || REGION_COLORS['Unknown'];
}
