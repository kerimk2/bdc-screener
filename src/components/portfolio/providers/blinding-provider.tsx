'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface BlindingContextType {
  isBlinded: boolean;
  toggleBlind: () => void;
}

const BlindingContext = createContext<BlindingContextType | undefined>(undefined);

const BLIND_PLACEHOLDER = '\u2022\u2022\u2022\u2022\u2022';

export function BlindingProvider({ children }: { children: React.ReactNode }) {
  const [isBlinded, setIsBlinded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('valuesBlinded') === 'true';
  });

  const toggleBlind = useCallback(() => {
    setIsBlinded(prev => {
      const next = !prev;
      localStorage.setItem('valuesBlinded', String(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    isBlinded, toggleBlind,
  }), [isBlinded, toggleBlind]);

  return (
    <BlindingContext.Provider value={value}>
      {children}
    </BlindingContext.Provider>
  );
}

export function useBlinding() {
  const context = useContext(BlindingContext);
  if (!context) throw new Error('useBlinding must be used within BlindingProvider');
  return context;
}

export function useFormatCurrency() {
  const { isBlinded } = useBlinding();

  return useCallback((value: number): string => {
    if (isBlinded) return BLIND_PLACEHOLDER;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, [isBlinded]);
}
