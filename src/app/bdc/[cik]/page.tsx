import { supabase } from '@/lib/supabase';
import { classifySector, SECTORS, Sector, getSectorColor } from '@/lib/sector-classifier';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const revalidate = 3600;

interface Props {
  params: Promise<{ cik: string }>;
}

async function getBDCDetails(cik: string) {
  // Get BDC info
  const { data: bdc, error: bdcError } = await supabase
    .from('bdcs')
    .select('*')
    .eq('cik', cik)
    .single();

  if (bdcError || !bdc) {
    return null;
  }

  // Get holdings
  const { data: holdings, error: holdingsError } = await supabase
    .from('holdings')
    .select('*')
    .eq('bdc_cik', cik)
    .order('period_date', { ascending: false });

  if (holdingsError || !holdings) {
    return { bdc, holdings: [], sectorSummary: [] };
  }

  // Get latest period
  const latestPeriod = holdings[0]?.period_date;
  const latestHoldings = holdings.filter((h) => h.period_date === latestPeriod);

  // Calculate sector summary
  const sectorTotals: Record<string, { value: number; count: number }> = {};
  const totalValue = latestHoldings.reduce((sum, h) => sum + (h.fair_value || 0), 0);

  for (const holding of latestHoldings) {
    const sector = holding.industry_sector || classifySector(holding.industry_raw);
    if (!sectorTotals[sector]) {
      sectorTotals[sector] = { value: 0, count: 0 };
    }
    sectorTotals[sector].value += holding.fair_value || 0;
    sectorTotals[sector].count += 1;
  }

  const sectorSummary = SECTORS.map((sector) => ({
    sector,
    value: sectorTotals[sector]?.value || 0,
    percentage: totalValue > 0 ? ((sectorTotals[sector]?.value || 0) / totalValue) * 100 : 0,
    count: sectorTotals[sector]?.count || 0,
  }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    bdc,
    holdings: latestHoldings,
    sectorSummary,
    totalValue,
    periodDate: latestPeriod,
  };
}

export default async function BDCDetailPage({ params }: Props) {
  const { cik } = await params;
  const data = await getBDCDetails(cik);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">BDC Not Found</h1>
          <Link href="/" className="text-blue-600 hover:underline mt-4 block">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { bdc, holdings, sectorSummary, totalValue, periodDate } = data;

  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center text-blue-600 hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Screener
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {bdc.ticker && <span className="text-blue-600">{bdc.ticker}</span>}
            {bdc.ticker && ' - '}
            {bdc.name}
          </h1>
          <p className="text-gray-500 mt-1">
            CIK: {bdc.cik} | As of {periodDate}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold">{formatCurrency(totalValue || 0)}</div>
            <div className="text-gray-500 text-sm">Total Portfolio Value</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold">{holdings.length}</div>
            <div className="text-gray-500 text-sm">Portfolio Companies</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold">{sectorSummary.length}</div>
            <div className="text-gray-500 text-sm">Sectors</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Sector breakdown */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Sector Allocation</h2>
            <div className="space-y-3">
              {sectorSummary.map((s) => (
                <div key={s.sector}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center">
                      <span
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: getSectorColor(s.sector as Sector) }}
                      />
                      {s.sector}
                    </span>
                    <span className="font-mono">{s.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.percentage}%`,
                        backgroundColor: getSectorColor(s.sector as Sector),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Holdings table */}
          <div className="col-span-2 bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">
              Top Holdings ({holdings.length} total)
            </h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Company</th>
                    <th className="text-left p-2 font-medium">Sector</th>
                    <th className="text-right p-2 font-medium">Fair Value</th>
                    <th className="text-right p-2 font-medium">% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings
                    .sort((a, b) => (b.fair_value || 0) - (a.fair_value || 0))
                    .slice(0, 50)
                    .map((holding, i) => {
                      const sector =
                        holding.industry_sector ||
                        classifySector(holding.industry_raw);
                      const pct =
                        totalValue && totalValue > 0
                          ? ((holding.fair_value || 0) / totalValue) * 100
                          : 0;
                      return (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          <td className="p-2">
                            <div className="font-medium">{holding.company_name}</div>
                            {holding.industry_raw && (
                              <div className="text-xs text-gray-500">
                                {holding.industry_raw}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: `${getSectorColor(sector as Sector)}20`,
                                color: getSectorColor(sector as Sector),
                              }}
                            >
                              {sector}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono">
                            {formatCurrency(holding.fair_value || 0)}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {pct.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {holdings.length > 50 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Showing top 50 of {holdings.length} holdings
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
