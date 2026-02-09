'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Eye, PieChart } from 'lucide-react';

const tabs = [
  { label: 'Portfolio', href: '/portfolio', icon: PieChart },
  { label: 'BDC Screener', href: '/', icon: BarChart3 },
  { label: 'Watchlist', href: '/watchlist', icon: Eye },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-8">
          <span className="text-lg font-bold text-gray-900 shrink-0">
            FinTools
          </span>
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const isActive =
                tab.href === '/'
                  ? pathname === '/' || pathname.startsWith('/bdc')
                  : pathname.startsWith(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
