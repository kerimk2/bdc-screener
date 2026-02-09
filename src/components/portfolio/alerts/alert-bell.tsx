'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/portfolio/utils';
import { Alert, AlertType } from '@/types/portfolio';
import { getAlertColor } from '@/lib/portfolio/alert-engine';
import { useAuth } from '@/components/portfolio/providers/auth-provider';

interface AlertBellProps {
  className?: string;
}

export function AlertBell({ className }: AlertBellProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch alerts
  const fetchAlerts = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      const response = await fetch('/api/portfolio/alerts?limit=5', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchAlerts();
    // Poll every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.access_token]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark all as read
  const markAllRead = async () => {
    if (!session?.access_token) return;

    try {
      await fetch('/api/portfolio/alerts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
    } catch (error) {
      console.error('Failed to mark alerts as read:', error);
    }
  };

  // Dismiss alert
  const dismissAlert = async (alertId: string) => {
    if (!session?.access_token) return;

    try {
      await fetch('/api/portfolio/alerts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ alertId, action: 'dismiss' }),
      });
      setAlerts(alerts.filter(a => a.id !== alertId));
      fetchAlerts(); // Refresh count
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  const getAlertIcon = (alertType: AlertType) => {
    switch (alertType) {
      case 'large_price_move':
        return '📈';
      case 'earnings_upcoming':
        return '📅';
      case 'dividend_ex_date':
        return '💰';
      case 'target_reached':
        return '🎯';
      case 'concentration_warning':
        return '⚠️';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        title="Alerts"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Alerts</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Alert list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No alerts
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'relative px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
                      !alert.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getAlertIcon(alert.alert_type)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'font-medium',
                              getAlertColor(alert.severity)
                            )}
                          >
                            {alert.symbol}
                          </span>
                          {!alert.is_read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {alert.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          {formatTimeAgo(alert.triggered_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissAlert(alert.id);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
            <Link
              href="/alerts"
              className="flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => setIsOpen(false)}
            >
              View all alerts
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
