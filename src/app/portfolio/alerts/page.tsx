'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  Settings,
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  PieChart,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/portfolio/utils';
import { Alert, AlertSettings, AlertType } from '@/types/portfolio';
import { useAuth } from '@/components/portfolio/providers/auth-provider';
import { DEFAULT_ALERT_SETTINGS, getAlertColor } from '@/lib/portfolio/alert-engine';

export default function AlertsPage() {
  const { session } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState<AlertType | 'all'>('all');
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch alerts
  const fetchAlerts = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/portfolio/alerts?limit=100', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  // Fetch settings
  const fetchSettings = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/portfolio/alerts/settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAlerts(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, [session?.access_token]);

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
      setAlerts(alerts.map((a) => ({ ...a, is_read: true })));
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
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (!session?.access_token) return;

    setSavingSettings(true);
    try {
      await fetch('/api/portfolio/alerts/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      });
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const getAlertIcon = (alertType: AlertType) => {
    switch (alertType) {
      case 'large_price_move':
        return <TrendingUp className="h-5 w-5" />;
      case 'earnings_upcoming':
        return <Calendar className="h-5 w-5" />;
      case 'dividend_ex_date':
        return <DollarSign className="h-5 w-5" />;
      case 'target_reached':
        return <Target className="h-5 w-5" />;
      case 'concentration_warning':
        return <PieChart className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getAlertTypeName = (alertType: AlertType) => {
    switch (alertType) {
      case 'large_price_move':
        return 'Price Move';
      case 'earnings_upcoming':
        return 'Earnings';
      case 'dividend_ex_date':
        return 'Dividend';
      case 'target_reached':
        return 'Target Reached';
      case 'concentration_warning':
        return 'Concentration';
      default:
        return 'Alert';
    }
  };

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter((a) => a.alert_type === filter);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Alerts
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
        {(['all', 'large_price_move', 'earnings_upcoming', 'dividend_ex_date', 'target_reached', 'concentration_warning'] as const).map(
          (type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filter === type
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              {type === 'all' ? 'All' : getAlertTypeName(type as AlertType)}
            </button>
          )
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <Bell className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              {filter === 'all' ? 'No alerts yet' : `No ${getAlertTypeName(filter as AlertType).toLowerCase()} alerts`}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'relative flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors dark:border-gray-700 dark:bg-gray-900',
                !alert.is_read && 'border-l-4 border-l-blue-500'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                  alert.severity === 'critical'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                )}
              >
                {getAlertIcon(alert.alert_type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('font-semibold', getAlertColor(alert.severity))}>
                    {alert.symbol}
                  </span>
                  <span className="text-xs text-gray-400">
                    {getAlertTypeName(alert.alert_type)}
                  </span>
                  {!alert.is_read && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {alert.title}
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  {alert.message}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(alert.triggered_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                title="Dismiss"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Alert Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Thresholds */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Thresholds
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400">
                      Price move threshold (%)
                    </label>
                    <input
                      type="number"
                      value={settings.price_move_threshold}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          price_move_threshold: parseFloat(e.target.value) || 10,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      min="1"
                      max="50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Alert when a position moves more than this % in a day
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400">
                      Concentration threshold (%)
                    </label>
                    <input
                      type="number"
                      value={settings.concentration_threshold}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          concentration_threshold: parseFloat(e.target.value) || 15,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      min="5"
                      max="50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Alert when a position exceeds this % of portfolio
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400">
                        Days before earnings
                      </label>
                      <input
                        type="number"
                        value={settings.days_before_earnings}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            days_before_earnings: parseInt(e.target.value) || 1,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        min="0"
                        max="7"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400">
                        Days before ex-dividend
                      </label>
                      <input
                        type="number"
                        value={settings.days_before_dividend}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            days_before_dividend: parseInt(e.target.value) || 3,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        min="0"
                        max="14"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enable/Disable */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alert Types
                </h3>
                <div className="space-y-3">
                  {[
                    { key: 'enable_price_alerts', label: 'Large price moves' },
                    { key: 'enable_earnings_alerts', label: 'Upcoming earnings' },
                    { key: 'enable_dividend_alerts', label: 'Dividend ex-dates' },
                    { key: 'enable_target_alerts', label: 'Watchlist targets reached' },
                    { key: 'enable_concentration_alerts', label: 'Concentration warnings' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings[key as keyof AlertSettings] as boolean}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [key]: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
