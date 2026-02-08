'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BDCSectorExposure } from '@/types';
import { SECTORS, Sector, getSectorColor } from '@/lib/sector-classifier';
import Link from 'next/link';

interface BDCTableProps {
  data: BDCSectorExposure[];
}

type SortKey =
  | 'name'
  | 'total_fair_value'
  | 'price'
  | 'market_cap'
  | 'dividend_yield'
  | 'dividend_growth_3yr'
  | 'payout_ratio'
  | 'price_to_nav'
  | 'non_accrual_pct'
  | 'debt_to_equity'
  | Sector;

export function BDCTable({ data }: BDCTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('dividend_yield');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterSector, setFilterSector] = useState<Sector | 'all'>('all');
  const [viewMode, setViewMode] = useState<'sectors' | 'metrics'>('metrics');

  const sortedData = useMemo(() => {
    let filtered = data;

    // Filter BDCs that have exposure to the selected sector
    if (filterSector !== 'all') {
      filtered = data.filter(
        (bdc) => (bdc.sector_exposures[filterSector] || 0) > 0
      );
    }

    return [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortKey === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortKey === 'total_fair_value') {
        aVal = a.total_fair_value;
        bVal = b.total_fair_value;
      } else if (SECTORS.includes(sortKey as Sector)) {
        aVal = a.sector_exposures[sortKey as Sector] || 0;
        bVal = b.sector_exposures[sortKey as Sector] || 0;
      } else {
        aVal = (a[sortKey as keyof BDCSectorExposure] as number) || 0;
        bVal = (b[sortKey as keyof BDCSectorExposure] as number) || 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection, filterSector]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
    return `$${val.toLocaleString()}`;
  };

  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || val === 0) return '-';
    return `${val.toFixed(1)}%`;
  };

  const formatRatio = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return val.toFixed(2);
  };

  const formatPrice = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return `$${val.toFixed(2)}`;
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column)
      return <ArrowUpDown className="inline w-4 h-4 ml-1 opacity-40" />;
    return sortDirection === 'desc' ? (
      <ArrowDown className="inline w-4 h-4 ml-1" />
    ) : (
      <ArrowUp className="inline w-4 h-4 ml-1" />
    );
  };

  // Select which sectors to display as columns (top 5)
  const displaySectors: Sector[] = [
    'Software & Technology',
    'Healthcare',
    'Business Services',
    'Industrials',
    'Consumer',
  ];

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border">
          <button
            onClick={() => setViewMode('metrics')}
            className={`px-4 py-1.5 text-sm font-medium ${
              viewMode === 'metrics'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Financial Metrics
          </button>
          <button
            onClick={() => setViewMode('sectors')}
            className={`px-4 py-1.5 text-sm font-medium ${
              viewMode === 'sectors'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Sector Exposure
          </button>
        </div>

        <label className="text-sm font-medium text-gray-700">
          Filter by sector:
        </label>
        <select
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value as Sector | 'all')}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="all">All BDCs</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          Showing {sortedData.length} of {data.length} BDCs
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="text-left p-3 font-medium cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50"
                onClick={() => handleSort('name')}
              >
                BDC
                <SortIcon column="name" />
              </th>

              {viewMode === 'metrics' ? (
                <>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('price')}
                    title="Current stock price"
                  >
                    Price
                    <SortIcon column="price" />
                  </th>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('market_cap')}
                    title="Market capitalization"
                  >
                    Mkt Cap
                    <SortIcon column="market_cap" />
                  </th>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('dividend_yield')}
                    title="Annual dividend yield"
                  >
                    Div Yield
                    <SortIcon column="dividend_yield" />
                  </th>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('payout_ratio')}
                    title="Dividend payout ratio - above 100% may be unsustainable"
                  >
                    Payout
                    <SortIcon column="payout_ratio" />
                  </th>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('price_to_nav')}
                    title="Price to Net Asset Value ratio (premium/discount)"
                  >
                    P/NAV
                    <SortIcon column="price_to_nav" />
                  </th>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('non_accrual_pct')}
                    title="Non-accrual loans as percentage of portfolio"
                  >
                    Non-Accrual
                    <SortIcon column="non_accrual_pct" />
                  </th>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort('debt_to_equity')}
                    title="Debt to equity ratio (leverage)"
                  >
                    D/E
                    <SortIcon column="debt_to_equity" />
                  </th>
                  <th
                    className="text-right p-3 font-medium whitespace-nowrap"
                    title="52-week price range (low - high)"
                  >
                    52W Range
                  </th>
                </>
              ) : (
                <>
                  <th
                    className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('total_fair_value')}
                  >
                    AUM
                    <SortIcon column="total_fair_value" />
                  </th>
                  {displaySectors.map((sector) => (
                    <th
                      key={sector}
                      className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                      onClick={() => handleSort(sector)}
                      style={{ minWidth: '100px' }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: getSectorColor(sector) }}
                      />
                      {sector.replace(' & Technology', '').replace(' Services', '')}
                      <SortIcon column={sector} />
                    </th>
                  ))}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((bdc) => (
              <tr
                key={bdc.cik}
                className="border-t hover:bg-gray-50 cursor-pointer"
              >
                <td className="p-3 sticky left-0 bg-white">
                  <Link
                    href={`/bdc/${bdc.cik}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {bdc.ticker || bdc.name}
                  </Link>
                  {bdc.ticker && (
                    <span className="text-gray-500 ml-2 text-xs hidden lg:inline">
                      {bdc.name}
                    </span>
                  )}
                </td>

                {viewMode === 'metrics' ? (
                  <>
                    <td className="p-3 text-right font-mono">
                      {formatPrice(bdc.price)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {bdc.market_cap ? formatCurrency(bdc.market_cap) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span
                        className={
                          (bdc.dividend_yield || 0) >= 12
                            ? 'text-green-600 font-semibold'
                            : (bdc.dividend_yield || 0) >= 10
                            ? 'text-gray-900'
                            : 'text-gray-500'
                        }
                      >
                        {formatPercent(bdc.dividend_yield)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span
                        className={
                          (bdc.payout_ratio || 0) > 1.0
                            ? 'text-red-600 font-semibold'
                            : (bdc.payout_ratio || 0) > 0.9
                            ? 'text-orange-600'
                            : (bdc.payout_ratio || 0) > 0
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }
                      >
                        {bdc.payout_ratio != null
                          ? `${(bdc.payout_ratio * 100).toFixed(0)}%`
                          : '-'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span
                        className={
                          (bdc.price_to_nav || 0) < 0.9
                            ? 'text-green-600 font-semibold'
                            : (bdc.price_to_nav || 0) > 1.2
                            ? 'text-orange-600'
                            : 'text-gray-900'
                        }
                      >
                        {formatRatio(bdc.price_to_nav)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span
                        className={
                          (bdc.non_accrual_pct || 0) > 5
                            ? 'text-red-600 font-semibold'
                            : (bdc.non_accrual_pct || 0) > 3
                            ? 'text-orange-600'
                            : (bdc.non_accrual_pct || 0) < 1.5
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }
                      >
                        {formatPercent(bdc.non_accrual_pct)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span
                        className={
                          (bdc.debt_to_equity || 0) > 1.2
                            ? 'text-orange-600'
                            : (bdc.debt_to_equity || 0) < 0.8
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }
                      >
                        {formatRatio(bdc.debt_to_equity)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-xs whitespace-nowrap">
                      {bdc.fifty_two_week_low != null && bdc.fifty_two_week_high != null
                        ? `${formatPrice(bdc.fifty_two_week_low)} - ${formatPrice(bdc.fifty_two_week_high)}`
                        : '-'}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 text-right font-mono">
                      {formatCurrency(bdc.total_fair_value)}
                    </td>
                    {displaySectors.map((sector) => (
                      <td key={sector} className="p-3 text-right font-mono">
                        <span
                          className={
                            bdc.sector_exposures[sector] > 20
                              ? 'font-semibold'
                              : bdc.sector_exposures[sector] > 10
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }
                        >
                          {formatPercent(bdc.sector_exposures[sector] || 0)}
                        </span>
                      </td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No BDCs found with exposure to this sector
        </div>
      )}

      {/* Legend for metrics view */}
      {viewMode === 'metrics' && (
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p><strong>Div Yield:</strong> Annual dividend yield. <span className="text-green-600">Green</span> = 12%+</p>
          <p><strong>Payout:</strong> Dividend payout ratio. <span className="text-green-600">Green</span> = &lt;90% (sustainable), <span className="text-orange-600">Orange</span> = 90-100%, <span className="text-red-600">Red</span> = &gt;100% (may be unsustainable)</p>
          <p><strong>P/NAV:</strong> Price to Net Asset Value. <span className="text-green-600">Green</span> = &lt;0.9 (discount), <span className="text-orange-600">Orange</span> = &gt;1.2 (premium)</p>
          <p><strong>Non-Accrual:</strong> Non-performing loans as % of portfolio. <span className="text-green-600">Green</span> = &lt;1.5%, <span className="text-red-600">Red</span> = &gt;5%</p>
          <p><strong>D/E:</strong> Debt to Equity ratio. <span className="text-green-600">Green</span> = &lt;0.8, <span className="text-orange-600">Orange</span> = &gt;1.2</p>
        </div>
      )}
    </div>
  );
}
