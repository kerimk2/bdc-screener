'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  BarChart3,
  Eye,
  EyeOff,
  LogOut,
  FileText,
  Settings,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Globe,
  BookOpen,
  TrendingUp,
  Receipt,
  Menu,
  X,
  Bell,
  Calendar,
  Target,
} from 'lucide-react';
import { AlertBell } from '@/components/portfolio/alerts/alert-bell';
import { cn } from '@/lib/portfolio/utils';
import { useTheme } from '@/components/portfolio/providers/theme-provider';
import { useData } from '@/components/portfolio/providers/data-provider';
import { useAuth } from '@/components/portfolio/providers/auth-provider';
import { useBlinding } from '@/components/portfolio/providers/blinding-provider';

const navigation = [
  { name: 'Dashboard', href: '/portfolio', icon: LayoutDashboard },
  { name: 'Positions', href: '/portfolio/positions', icon: Briefcase },
  { name: 'Accounts', href: '/portfolio/accounts', icon: Building2 },
  { name: 'Analytics', href: '/portfolio/analytics', icon: BarChart3 },
  { name: 'Market', href: '/portfolio/market', icon: Globe },
  { name: 'Calendar', href: '/portfolio/calendar', icon: Calendar },
  { name: 'Goals', href: '/portfolio/goals', icon: Target },
  { name: 'Taxes', href: '/portfolio/taxes', icon: Receipt },
  { name: 'Covered Calls', href: '/portfolio/covered-calls', icon: TrendingUp },
  { name: 'Alerts', href: '/portfolio/alerts', icon: Bell },
  { name: 'Watchlist', href: '/portfolio/watchlist', icon: Eye },
  { name: 'Journal', href: '/portfolio/journal', icon: BookOpen },
  { name: 'Reports', href: '/portfolio/reports', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { refreshing, refreshData } = useData();
  const { user, signOut } = useAuth();
  const { isBlinded, toggleBlind } = useBlinding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        <Link href="/portfolio" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            PortfolioView
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {/* Alert bell - desktop */}
          <div className="hidden lg:block">
            <AlertBell />
          </div>
          {/* Close button - mobile only */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation - scrollable */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navigation.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        {/* Refresh button */}
        <button
          onClick={() => refreshData()}
          disabled={refreshing}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>

        {/* Theme toggle */}
        <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-2 text-sm transition-colors',
              theme === 'light'
                ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
            title="Light mode"
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-2 text-sm transition-colors',
              theme === 'dark'
                ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
            title="Dark mode"
          >
            <Moon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTheme('system')}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-2 text-sm transition-colors',
              theme === 'system'
                ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
            title="System preference"
          >
            <Monitor className="h-4 w-4" />
          </button>
        </div>

        {/* Value blinding toggle */}
        <button
          onClick={toggleBlind}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {isBlinded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {isBlinded ? 'Show Values' : 'Hide Values'}
        </button>

        {/* Settings link */}
        <Link
          href="/portfolio/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/portfolio/settings'
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>

        {/* User & Sign Out */}
        {user && (
          <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex-1 truncate text-xs">{user.email}</span>
            <button
              onClick={signOut}
              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed left-0 right-0 top-14 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950 lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Link href="/portfolio" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">
            PortfolioView
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <AlertBell />
          <button
            onClick={toggleBlind}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {isBlinded ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar - slide from left */}
      <aside
        className={cn(
          'fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-72 transform border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar - always visible */}
      <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}
