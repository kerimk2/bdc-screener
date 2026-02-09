'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, TrendingDown } from 'lucide-react';
import { ScenarioResult } from '@/types/portfolio';
import { useBlinding } from '@/components/portfolio/providers/blinding-provider';

interface ScenarioTableProps {
  scenarios: ScenarioResult[];
  totalPortfolioValue: number;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getImpactColor(value: number): string {
  if (value >= 0) return 'text-green-600 dark:text-green-400';
  if (value >= -0.2) return 'text-yellow-600 dark:text-yellow-400';
  if (value >= -0.4) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

export function ScenarioTable({ scenarios, totalPortfolioValue }: ScenarioTableProps) {
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const { isBlinded } = useBlinding();

  return (
    <div className="space-y-4">
      {scenarios.map((scenario) => {
        const isExpanded = expandedScenario === scenario.name;
        const portfolioLoss = totalPortfolioValue * scenario.portfolioImpact;
        const isWorse = scenario.portfolioImpact < scenario.marketImpact;

        return (
          <div
            key={scenario.name}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Scenario Header */}
            <button
              onClick={() => setExpandedScenario(isExpanded ? null : scenario.name)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {scenario.name}
                    </span>
                    {isWorse && (
                      <span title="Portfolio more exposed than market">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scenario.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Market</div>
                  <div className={`font-medium ${getImpactColor(scenario.marketImpact)}`}>
                    {formatPercent(scenario.marketImpact)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Portfolio</div>
                  <div className={`font-medium ${getImpactColor(scenario.portfolioImpact)}`}>
                    {formatPercent(scenario.portfolioImpact)}
                  </div>
                </div>
                <div className="w-24">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Est. Loss</div>
                  <div className={`font-medium ${getImpactColor(scenario.portfolioImpact)}`}>
                    {isBlinded ? '•••••' : formatCurrency(portfolioLoss)}
                  </div>
                </div>
              </div>
            </button>

            {/* Expanded Position Details */}
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Position Impacts
                </h4>
                <div className="space-y-2">
                  {scenario.positionImpacts.slice(0, 10).map((position) => (
                    <div
                      key={position.symbol}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {position.symbol}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className={getImpactColor(position.impact)}>
                          {formatPercent(position.impact)}
                        </span>
                        <span className={`w-24 text-right ${getImpactColor(position.impact)}`}>
                          {isBlinded ? '•••••' : formatCurrency(position.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {scenario.positionImpacts.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                      +{scenario.positionImpacts.length - 10} more positions
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Risk Summary */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
          Stress Test Summary
        </h4>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          These scenarios show estimated portfolio impact based on historical sector behavior during
          market events. Actual results may vary based on individual stock characteristics.
        </p>
      </div>
    </div>
  );
}
