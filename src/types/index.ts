import { Sector } from '@/lib/sector-classifier';

export interface BDC {
  cik: string;
  name: string;
  ticker: string | null;
  dividend_yield: number | null;
  dividend_growth_3yr: number | null;
  nav_per_share: number | null;
  price: number | null;
  price_to_nav: number | null;
  non_accrual_pct: number | null;
  total_assets: number | null;
  debt_to_equity: number | null;
  net_investment_income_yield: number | null;
  market_cap: number | null;
  payout_ratio: number | null;
  beta: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  analyst_target_price: number | null;
  analyst_rating: string | null;
  institutional_ownership: number | null;
  five_yr_avg_dividend_yield: number | null;
  ex_dividend_date: string | null;
}

export interface Holding {
  id: string;
  bdc_cik: string;
  period_date: string;
  company_name: string;
  industry_raw: string | null;
  industry_sector: Sector;
  fair_value: number;
}

export interface BDCSectorExposure {
  cik: string;
  name: string;
  ticker: string | null;
  total_fair_value: number;
  period_date: string;
  sector_exposures: Record<Sector, number>; // sector -> percentage
  // Financial metrics
  dividend_yield: number | null;
  dividend_growth_3yr: number | null;
  nav_per_share: number | null;
  price: number | null;
  price_to_nav: number | null;
  non_accrual_pct: number | null;
  debt_to_equity: number | null;
  net_investment_income_yield: number | null;
  market_cap: number | null;
  payout_ratio: number | null;
  beta: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  analyst_target_price: number | null;
  analyst_rating: string | null;
  institutional_ownership: number | null;
  five_yr_avg_dividend_yield: number | null;
  ex_dividend_date: string | null;
}

export interface SectorSummary {
  sector: Sector;
  total_value: number;
  percentage: number;
  holding_count: number;
}
