'use client';

import { useAuth } from '@/components/portfolio/providers/auth-provider';
import { LoginPage } from '@/components/portfolio/layout/login-page';
import { Loading } from '@/components/portfolio/ui/loading';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loading message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
