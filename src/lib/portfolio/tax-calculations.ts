import { EnrichedPosition, Account, Transaction } from '@/types/portfolio';

// Tax treatment categories
export type TaxTreatment = 'tax_deferred' | 'tax_free' | 'taxable';
export type GainType = 'long_term' | 'short_term';

// Account type to tax treatment mapping
export function getAccountTaxTreatment(accountType: Account['type']): TaxTreatment {
  switch (accountType) {
    case '401k':
    case 'ira':
      return 'tax_deferred'; // Taxed on withdrawal
    case 'roth_ira':
      return 'tax_free'; // No tax on qualified withdrawals
    case 'brokerage':
    case 'crypto':
    case 'other':
    default:
      return 'taxable';
  }
}

// Determine if a position qualifies for long-term capital gains
export function getGainType(purchaseDate: string): GainType {
  const purchase = new Date(purchaseDate);
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return purchase <= oneYearAgo ? 'long_term' : 'short_term';
}

// Calculate days until long-term status
export function daysUntilLongTerm(purchaseDate: string): number {
  const purchase = new Date(purchaseDate);
  const longTermDate = new Date(purchase);
  longTermDate.setFullYear(longTermDate.getFullYear() + 1);

  const today = new Date();
  const daysRemaining = Math.ceil((longTermDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return Math.max(0, daysRemaining);
}

// Federal tax brackets for 2024 (single filer - simplified)
const FEDERAL_TAX_BRACKETS_2024 = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

// Long-term capital gains brackets for 2024 (single filer)
const LTCG_BRACKETS_2024 = [
  { min: 0, max: 47025, rate: 0.00 },
  { min: 47025, max: 518900, rate: 0.15 },
  { min: 518900, max: Infinity, rate: 0.20 },
];

// Net Investment Income Tax threshold
const NIIT_THRESHOLD = 200000;
const NIIT_RATE = 0.038;

export interface TaxablePosition extends EnrichedPosition {
  taxTreatment: TaxTreatment;
  gainType: GainType;
  daysUntilLongTerm: number;
  estimatedTax: number;
  effectiveTaxRate: number;
}

export interface TaxSummary {
  // By account treatment
  taxDeferredValue: number;
  taxFreeValue: number;
  taxableValue: number;

  // Gains by type (taxable accounts only)
  longTermGains: number;
  longTermLosses: number;
  shortTermGains: number;
  shortTermLosses: number;

  // Totals
  totalUnrealizedGains: number;
  totalUnrealizedLosses: number;
  netUnrealizedGainLoss: number;

  // Tax estimates
  estimatedLTCGTax: number;
  estimatedSTCGTax: number;
  estimatedTotalTax: number;

  // Tax loss harvesting
  harvestingCandidates: TaxablePosition[];
  potentialTaxSavings: number;

  // Positions approaching long-term
  approachingLongTerm: TaxablePosition[];
}

// Calculate estimated tax on gains
export function calculateEstimatedTax(
  gain: number,
  gainType: GainType,
  assumedIncome: number = 100000 // Default assumption for marginal rate
): { tax: number; effectiveRate: number } {
  if (gain <= 0) {
    return { tax: 0, effectiveRate: 0 };
  }

  let tax = 0;
  let effectiveRate = 0;

  if (gainType === 'long_term') {
    // Use LTCG brackets
    for (const bracket of LTCG_BRACKETS_2024) {
      if (assumedIncome >= bracket.min && assumedIncome < bracket.max) {
        tax = gain * bracket.rate;
        effectiveRate = bracket.rate;
        break;
      }
    }
    // Add NIIT if applicable
    if (assumedIncome > NIIT_THRESHOLD) {
      tax += gain * NIIT_RATE;
      effectiveRate += NIIT_RATE;
    }
  } else {
    // Short-term gains taxed as ordinary income
    // Find marginal bracket
    for (const bracket of FEDERAL_TAX_BRACKETS_2024) {
      if (assumedIncome >= bracket.min && assumedIncome < bracket.max) {
        tax = gain * bracket.rate;
        effectiveRate = bracket.rate;
        break;
      }
    }
    // Add NIIT if applicable
    if (assumedIncome > NIIT_THRESHOLD) {
      tax += gain * NIIT_RATE;
      effectiveRate += NIIT_RATE;
    }
  }

  return { tax, effectiveRate };
}

// Main function to calculate tax implications for all positions
export function calculateTaxImplications(
  positions: EnrichedPosition[],
  accounts: Account[],
  assumedIncome: number = 100000
): { positions: TaxablePosition[]; summary: TaxSummary } {
  const accountMap = new Map(accounts.map(a => [a.id, a]));

  const taxablePositions: TaxablePosition[] = positions.map(pos => {
    const account = accountMap.get(pos.account_id);
    const accountType = account?.type || 'brokerage';
    const taxTreatment = getAccountTaxTreatment(accountType);
    const gainType = getGainType(pos.purchase_date);
    const daysLeft = daysUntilLongTerm(pos.purchase_date);

    // Only calculate tax for taxable accounts with gains
    let estimatedTax = 0;
    let effectiveTaxRate = 0;

    if (taxTreatment === 'taxable' && pos.gainLoss > 0) {
      const taxCalc = calculateEstimatedTax(pos.gainLoss, gainType, assumedIncome);
      estimatedTax = taxCalc.tax;
      effectiveTaxRate = taxCalc.effectiveRate;
    }

    return {
      ...pos,
      taxTreatment,
      gainType,
      daysUntilLongTerm: daysLeft,
      estimatedTax,
      effectiveTaxRate,
    };
  });

  // Calculate summary
  let taxDeferredValue = 0;
  let taxFreeValue = 0;
  let taxableValue = 0;
  let longTermGains = 0;
  let longTermLosses = 0;
  let shortTermGains = 0;
  let shortTermLosses = 0;

  const harvestingCandidates: TaxablePosition[] = [];
  const approachingLongTerm: TaxablePosition[] = [];

  for (const pos of taxablePositions) {
    // Categorize by tax treatment
    switch (pos.taxTreatment) {
      case 'tax_deferred':
        taxDeferredValue += pos.marketValue;
        break;
      case 'tax_free':
        taxFreeValue += pos.marketValue;
        break;
      case 'taxable':
        taxableValue += pos.marketValue;

        // Track gains/losses by type
        if (pos.gainType === 'long_term') {
          if (pos.gainLoss >= 0) {
            longTermGains += pos.gainLoss;
          } else {
            longTermLosses += Math.abs(pos.gainLoss);
          }
        } else {
          if (pos.gainLoss >= 0) {
            shortTermGains += pos.gainLoss;
          } else {
            shortTermLosses += Math.abs(pos.gainLoss);
          }
        }

        // Tax loss harvesting candidates (losses > $100)
        if (pos.gainLoss < -100) {
          harvestingCandidates.push(pos);
        }

        // Positions within 30 days of long-term status
        if (pos.daysUntilLongTerm > 0 && pos.daysUntilLongTerm <= 30 && pos.gainLoss > 0) {
          approachingLongTerm.push(pos);
        }
        break;
    }
  }

  // Sort harvesting candidates by loss amount (largest first)
  harvestingCandidates.sort((a, b) => a.gainLoss - b.gainLoss);

  // Sort approaching long-term by days remaining
  approachingLongTerm.sort((a, b) => a.daysUntilLongTerm - b.daysUntilLongTerm);

  // Calculate estimated taxes
  const { tax: estimatedLTCGTax } = calculateEstimatedTax(
    Math.max(0, longTermGains - longTermLosses),
    'long_term',
    assumedIncome
  );

  const { tax: estimatedSTCGTax } = calculateEstimatedTax(
    Math.max(0, shortTermGains - shortTermLosses),
    'short_term',
    assumedIncome
  );

  // Calculate potential tax savings from harvesting
  // Losses can offset gains, plus up to $3000 of ordinary income
  const totalHarvestablelosses = harvestingCandidates.reduce((sum, p) => sum + Math.abs(p.gainLoss), 0);
  const { tax: potentialTaxSavings } = calculateEstimatedTax(
    Math.min(totalHarvestablelosses, shortTermGains + longTermGains + 3000),
    'short_term', // Use higher rate for conservative estimate
    assumedIncome
  );

  const totalUnrealizedGains = longTermGains + shortTermGains;
  const totalUnrealizedLosses = longTermLosses + shortTermLosses;

  return {
    positions: taxablePositions,
    summary: {
      taxDeferredValue,
      taxFreeValue,
      taxableValue,
      longTermGains,
      longTermLosses,
      shortTermGains,
      shortTermLosses,
      totalUnrealizedGains,
      totalUnrealizedLosses,
      netUnrealizedGainLoss: totalUnrealizedGains - totalUnrealizedLosses,
      estimatedLTCGTax,
      estimatedSTCGTax,
      estimatedTotalTax: estimatedLTCGTax + estimatedSTCGTax,
      harvestingCandidates,
      potentialTaxSavings,
      approachingLongTerm,
    },
  };
}

// Calculate realized gains from transactions
export function calculateRealizedGains(transactions: Transaction[]): {
  realizedLTCG: number;
  realizedSTCG: number;
  totalRealized: number;
} {
  let realizedLTCG = 0;
  let realizedSTCG = 0;

  for (const tx of transactions) {
    if (tx.type === 'sell' && tx.realized_pnl !== null) {
      // Note: We'd need the original purchase date to determine LTCG vs STCG
      // For now, we'll just sum total realized P/L
      // In a real implementation, you'd track lot-level data
      if (tx.realized_pnl > 0) {
        // Assume long-term for simplicity (would need lot data for accuracy)
        realizedLTCG += tx.realized_pnl;
      }
    }
  }

  return {
    realizedLTCG,
    realizedSTCG,
    totalRealized: realizedLTCG + realizedSTCG,
  };
}

// Format tax treatment for display
export function formatTaxTreatment(treatment: TaxTreatment): string {
  switch (treatment) {
    case 'tax_deferred':
      return 'Tax-Deferred';
    case 'tax_free':
      return 'Tax-Free';
    case 'taxable':
      return 'Taxable';
  }
}

// Format gain type for display
export function formatGainType(gainType: GainType): string {
  return gainType === 'long_term' ? 'Long-Term' : 'Short-Term';
}
