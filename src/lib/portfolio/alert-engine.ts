/**
 * Alert Engine
 * Evaluates portfolio positions and market data to generate alerts
 * for significant events only (non-obnoxious approach)
 */

import {
  Alert,
  AlertSettings,
  AlertType,
  AlertSeverity,
  EnrichedPosition,
  WatchlistItem,
  Quote,
} from '@/types/portfolio';

export interface EarningsEvent {
  symbol: string;
  date: string;
  daysUntil: number;
}

export interface DividendEvent {
  symbol: string;
  exDate: string;
  daysUntil: number;
  amount: number;
}

export interface PendingAlert {
  alert_type: AlertType;
  symbol: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata: Record<string, unknown>;
}

// Default settings if user hasn't configured any
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  id: '',
  user_id: '',
  price_move_threshold: 10.0, // 10% daily move
  concentration_threshold: 15.0, // 15% of portfolio
  days_before_earnings: 1,
  days_before_dividend: 3,
  enable_price_alerts: true,
  enable_earnings_alerts: true,
  enable_dividend_alerts: true,
  enable_target_alerts: true,
  enable_concentration_alerts: true,
  created_at: '',
  updated_at: '',
};

/**
 * Main alert evaluation function
 * Checks all alert types and returns pending alerts that should be created
 */
export function evaluateAlerts(
  positions: EnrichedPosition[],
  watchlist: WatchlistItem[],
  quotes: Map<string, Quote>,
  upcomingEarnings: EarningsEvent[],
  upcomingDividends: DividendEvent[],
  settings: AlertSettings | null,
  totalPortfolioValue: number
): PendingAlert[] {
  const config = settings || DEFAULT_ALERT_SETTINGS;
  const alerts: PendingAlert[] = [];

  // Check large price moves
  if (config.enable_price_alerts) {
    for (const position of positions) {
      const alert = checkLargePriceMove(position, config.price_move_threshold);
      if (alert) alerts.push(alert);
    }
  }

  // Check concentration warnings
  if (config.enable_concentration_alerts && totalPortfolioValue > 0) {
    for (const position of positions) {
      const alert = checkConcentration(
        position,
        totalPortfolioValue,
        config.concentration_threshold
      );
      if (alert) alerts.push(alert);
    }
  }

  // Check upcoming earnings
  if (config.enable_earnings_alerts) {
    const positionSymbols = new Set(positions.map(p => p.symbol.toUpperCase()));
    for (const event of upcomingEarnings) {
      if (
        positionSymbols.has(event.symbol.toUpperCase()) &&
        event.daysUntil <= config.days_before_earnings
      ) {
        alerts.push(createEarningsAlert(event));
      }
    }
  }

  // Check upcoming dividend ex-dates
  if (config.enable_dividend_alerts) {
    const positionSymbols = new Set(positions.map(p => p.symbol.toUpperCase()));
    for (const event of upcomingDividends) {
      if (
        positionSymbols.has(event.symbol.toUpperCase()) &&
        event.daysUntil <= config.days_before_dividend &&
        event.daysUntil >= 0
      ) {
        alerts.push(createDividendAlert(event));
      }
    }
  }

  // Check watchlist target prices
  if (config.enable_target_alerts) {
    for (const item of watchlist) {
      if (item.target_price) {
        const quote = quotes.get(item.symbol.toUpperCase());
        if (quote) {
          const alert = checkTargetReached(item, quote);
          if (alert) alerts.push(alert);
        }
      }
    }
  }

  return alerts;
}

/**
 * Check if a position had a large daily price move
 */
export function checkLargePriceMove(
  position: EnrichedPosition,
  threshold: number
): PendingAlert | null {
  const changePercent = Math.abs(position.dayChangePercent);

  if (changePercent >= threshold) {
    const direction = position.dayChangePercent > 0 ? 'up' : 'down';
    const severity: AlertSeverity =
      changePercent >= threshold * 2 ? 'critical' : 'warning';

    return {
      alert_type: 'large_price_move',
      symbol: position.symbol,
      title: `${position.symbol} ${direction} ${changePercent.toFixed(1)}%`,
      message: `${position.symbol} moved ${direction} ${changePercent.toFixed(1)}% today (${
        position.dayChangePercent > 0 ? '+' : ''
      }$${position.dayChange.toFixed(2)} per share). Current price: $${position.currentPrice.toFixed(2)}`,
      severity,
      metadata: {
        changePercent: position.dayChangePercent,
        currentPrice: position.currentPrice,
        dayChange: position.dayChange,
        direction,
      },
    };
  }

  return null;
}

/**
 * Check if a position is too concentrated in the portfolio
 */
export function checkConcentration(
  position: EnrichedPosition,
  totalValue: number,
  threshold: number
): PendingAlert | null {
  const weight = (position.marketValue / totalValue) * 100;

  if (weight >= threshold) {
    const severity: AlertSeverity = weight >= threshold * 1.5 ? 'warning' : 'info';

    return {
      alert_type: 'concentration_warning',
      symbol: position.symbol,
      title: `${position.symbol} is ${weight.toFixed(1)}% of portfolio`,
      message: `${position.symbol} represents ${weight.toFixed(1)}% of your portfolio ($${position.marketValue.toLocaleString()}). Consider rebalancing to reduce concentration risk.`,
      severity,
      metadata: {
        weight,
        marketValue: position.marketValue,
        threshold,
      },
    };
  }

  return null;
}

/**
 * Create an earnings upcoming alert
 */
function createEarningsAlert(event: EarningsEvent): PendingAlert {
  const daysText =
    event.daysUntil === 0
      ? 'today'
      : event.daysUntil === 1
      ? 'tomorrow'
      : `in ${event.daysUntil} days`;

  return {
    alert_type: 'earnings_upcoming',
    symbol: event.symbol,
    title: `${event.symbol} earnings ${daysText}`,
    message: `${event.symbol} reports earnings ${daysText} (${event.date}). Consider reviewing your position before the announcement.`,
    severity: 'info',
    metadata: {
      earningsDate: event.date,
      daysUntil: event.daysUntil,
    },
  };
}

/**
 * Create a dividend ex-date alert
 */
function createDividendAlert(event: DividendEvent): PendingAlert {
  const daysText =
    event.daysUntil === 0
      ? 'today'
      : event.daysUntil === 1
      ? 'tomorrow'
      : `in ${event.daysUntil} days`;

  return {
    alert_type: 'dividend_ex_date',
    symbol: event.symbol,
    title: `${event.symbol} ex-dividend ${daysText}`,
    message: `${event.symbol} goes ex-dividend ${daysText} (${event.exDate}). Dividend: $${event.amount.toFixed(2)} per share.`,
    severity: 'info',
    metadata: {
      exDate: event.exDate,
      daysUntil: event.daysUntil,
      amount: event.amount,
    },
  };
}

/**
 * Check if a watchlist item hit its target price
 */
function checkTargetReached(
  item: WatchlistItem,
  quote: Quote
): PendingAlert | null {
  if (!item.target_price) return null;

  const currentPrice = quote.price;
  const targetPrice = item.target_price;

  // Check if current price crossed the target (either direction)
  // We consider it "reached" if within 1% of target or past it
  const percentFromTarget = ((currentPrice - targetPrice) / targetPrice) * 100;

  if (Math.abs(percentFromTarget) <= 1) {
    return {
      alert_type: 'target_reached',
      symbol: item.symbol,
      title: `${item.symbol} hit target price`,
      message: `${item.symbol} reached your target price of $${targetPrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`,
      severity: 'info',
      metadata: {
        targetPrice,
        currentPrice,
        percentFromTarget,
      },
    };
  }

  // Check if price crossed through target (was below, now above or vice versa)
  // This would require historical comparison which we don't have here
  // For now, just check if we're very close to target

  return null;
}

/**
 * Format alert for display
 */
export function formatAlertForToast(alert: Alert): {
  title: string;
  description: string;
  variant: 'default' | 'destructive';
} {
  return {
    title: alert.title,
    description: alert.message,
    variant: alert.severity === 'critical' ? 'destructive' : 'default',
  };
}

/**
 * Get icon name for alert type
 */
export function getAlertIcon(alertType: AlertType): string {
  switch (alertType) {
    case 'large_price_move':
      return 'trending-up';
    case 'earnings_upcoming':
      return 'calendar';
    case 'dividend_ex_date':
      return 'dollar-sign';
    case 'target_reached':
      return 'target';
    case 'concentration_warning':
      return 'pie-chart';
    default:
      return 'bell';
  }
}

/**
 * Get color for alert severity
 */
export function getAlertColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'text-red-500';
    case 'warning':
      return 'text-yellow-500';
    case 'info':
    default:
      return 'text-blue-500';
  }
}
