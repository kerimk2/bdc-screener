'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/portfolio/utils';

export function ServiceWorkerRegistration() {
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          setRegistration(reg);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    }

    // Track online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <>
      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 shadow-lg dark:border-yellow-800 dark:bg-yellow-900/50 lg:left-auto lg:right-4 lg:w-80">
          <WifiOff className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              You're offline
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Showing cached data. Some features may be limited.
            </p>
          </div>
        </div>
      )}

      {/* Update available notification */}
      {updateAvailable && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-800 dark:bg-blue-900/50 lg:left-auto lg:right-4 lg:w-80">
          <RefreshCw className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Update available
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              A new version is ready to install.
            </p>
          </div>
          <button
            onClick={handleUpdate}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Update
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="rounded p-1 text-blue-400 hover:text-blue-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
