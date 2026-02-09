'use client';

import { ThemeProvider } from '@/components/portfolio/providers/theme-provider';
import { AuthProvider } from '@/components/portfolio/providers/auth-provider';
import { AuthGate } from '@/components/portfolio/layout/auth-gate';
import { BlindingProvider } from '@/components/portfolio/providers/blinding-provider';
import { DataProvider } from '@/components/portfolio/providers/data-provider';
import { Sidebar } from '@/components/portfolio/layout/sidebar';

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <BlindingProvider>
            <DataProvider>
              <Sidebar />
              <main className="min-h-[calc(100vh-3.5rem)] pt-14 lg:ml-64 lg:pt-0">
                <div className="p-4 sm:p-6 lg:p-8">
                  {children}
                </div>
              </main>
            </DataProvider>
          </BlindingProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
