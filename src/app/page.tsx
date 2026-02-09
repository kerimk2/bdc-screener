import { supabase } from '@/lib/supabase';
import { BDCTable } from '@/components/bdc-table';
import { BDCSectorExposure } from '@/types';
import { classifySector, SECTORS, Sector } from '@/lib/sector-classifier';


export const revalidate = 3600; // Revalidate at most once per hour

async function getBDCData(): Promise<{ data: BDCSectorExposure[]; lastUpdated: string | null }> {
  // Get all BDCs with financial metrics
  const { data: bdcs, error: bdcError } = await supabase
    .from('bdcs')
    .select('*');

  if (bdcError || !bdcs) {
    console.error('Error fetching BDCs:', bdcError);
    return { data: [], lastUpdated: null };
  }

  // Find the most recent update timestamp across all BDCs
  const lastUpdated = bdcs.reduce((latest: string | null, bdc: Record<string, unknown>) => {
    const updatedAt = bdc.updated_at as string | null;
    if (!updatedAt) return latest;
    if (!latest) return updatedAt;
    return updatedAt > latest ? updatedAt : latest;
  }, null);

  // Get latest holdings for each BDC
  const results: BDCSectorExposure[] = [];

  for (const bdc of bdcs) {
    // Get the most recent period's holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .eq('bdc_cik', bdc.cik)
      .order('period_date', { ascending: false });

    let totalFairValue = 0;
    let latestPeriod = '';
    const sectorExposures: Record<Sector, number> = {} as Record<Sector, number>;

    if (!holdingsError && holdings && holdings.length > 0) {
      // Get the latest period date
      latestPeriod = holdings[0].period_date;
      const latestHoldings = holdings.filter((h) => h.period_date === latestPeriod);

      // Calculate total fair value
      totalFairValue = latestHoldings.reduce(
        (sum, h) => sum + (h.fair_value || 0),
        0
      );

      // Calculate sector exposures
      if (totalFairValue > 0) {
        const sectorTotals: Record<string, number> = {};
        for (const holding of latestHoldings) {
          const sector = holding.industry_sector || classifySector(holding.industry_raw);
          sectorTotals[sector] = (sectorTotals[sector] || 0) + (holding.fair_value || 0);
        }
        for (const sector of SECTORS) {
          sectorExposures[sector] = ((sectorTotals[sector] || 0) / totalFairValue) * 100;
        }
      }
    }

    // Initialize any missing sectors to 0
    for (const sector of SECTORS) {
      if (sectorExposures[sector] == null) sectorExposures[sector] = 0;
    }

    // Skip BDCs with no holdings AND no financial data (truly empty records)
    if (totalFairValue === 0 && bdc.price == null && bdc.dividend_yield == null) {
      continue;
    }

    results.push({
      cik: bdc.cik,
      name: bdc.name,
      ticker: bdc.ticker,
      total_fair_value: totalFairValue,
      period_date: latestPeriod,
      sector_exposures: sectorExposures,
      // Financial metrics from BDC record
      dividend_yield: bdc.dividend_yield,
      dividend_growth_3yr: bdc.dividend_growth_3yr,
      nav_per_share: bdc.nav_per_share,
      price: bdc.price,
      price_to_nav: bdc.price_to_nav,
      non_accrual_pct: bdc.non_accrual_pct,
      debt_to_equity: bdc.debt_to_equity,
      net_investment_income_yield: bdc.net_investment_income_yield,
      market_cap: bdc.market_cap,
      payout_ratio: bdc.payout_ratio,
      beta: bdc.beta,
      fifty_two_week_high: bdc.fifty_two_week_high,
      fifty_two_week_low: bdc.fifty_two_week_low,
      analyst_target_price: bdc.analyst_target_price,
      analyst_rating: bdc.analyst_rating,
      institutional_ownership: bdc.institutional_ownership,
      five_yr_avg_dividend_yield: bdc.five_yr_avg_dividend_yield,
      ex_dividend_date: bdc.ex_dividend_date,
    });
  }

  return { data: results, lastUpdated };
}

export default async function Home() {
  const { data: bdcData, lastUpdated } = await getBDCData();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            BDC Portfolio Screener
          </h1>
          <p className="text-gray-600 mt-2">
            Compare Business Development Companies by sector exposure. Click any
            column header to sort.
          </p>
        </div>

        {/* Data status */}
        {bdcData.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-800">
              No Data Loaded Yet
            </h2>
            <p className="text-yellow-700 mt-2">
              To get started, run the data import script:
            </p>
            <pre className="bg-yellow-100 p-3 rounded mt-3 text-sm font-mono">
              npx tsx scripts/import-sec-data.ts
            </pre>
            <p className="text-yellow-700 mt-3">
              This will download and import BDC portfolio data from the SEC.
            </p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white rounded-lg border p-4">
                <div className="text-2xl font-bold">{bdcData.length}</div>
                <div className="text-gray-500 text-sm">BDCs Tracked</div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-2xl font-bold">
                  $
                  {(
                    bdcData.reduce((sum, b) => sum + b.total_fair_value, 0) / 1e9
                  ).toFixed(1)}
                  B
                </div>
                <div className="text-gray-500 text-sm">Total AUM</div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-2xl font-bold">
                  {(
                    bdcData.filter(b => b.dividend_yield).reduce((sum, b) => sum + (b.dividend_yield || 0), 0) /
                    bdcData.filter(b => b.dividend_yield).length
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-gray-500 text-sm">Avg Div Yield</div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-2xl font-bold">
                  {(
                    bdcData.filter(b => b.price_to_nav).reduce((sum, b) => sum + (b.price_to_nav || 0), 0) /
                    bdcData.filter(b => b.price_to_nav).length
                  ).toFixed(2)}
                  x
                </div>
                <div className="text-gray-500 text-sm">Avg P/NAV</div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-2xl font-bold">
                  {(
                    bdcData.filter(b => b.non_accrual_pct).reduce((sum, b) => sum + (b.non_accrual_pct || 0), 0) /
                    bdcData.filter(b => b.non_accrual_pct).length
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-gray-500 text-sm">Avg Non-Accrual</div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="text-2xl font-bold">
                  {Math.max(
                    ...bdcData.map(
                      (b) => b.sector_exposures['Software & Technology'] || 0
                    )
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-gray-500 text-sm">Max Software Exp</div>
              </div>
            </div>

            {/* Main table */}
            <div className="bg-white rounded-lg border p-6">
              <BDCTable data={bdcData} />
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          {lastUpdated && (
            <p className="mb-1">
              Financial data last updated:{' '}
              {new Date(lastUpdated).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </p>
          )}
          <p>
            Data sourced from{' '}
            <a
              href="https://www.sec.gov/data-research/sec-markets-data/bdc-data-sets"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              SEC BDC Data Sets
            </a>
            {' & '}
            <a
              href="https://finance.yahoo.com"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Yahoo Finance
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
