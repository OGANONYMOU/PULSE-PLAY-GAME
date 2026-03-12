import React, { createContext, useContext, useState } from 'react';
import { detectCurrency, CURRENCY_SYMBOLS, type CurrencyCode } from '@/lib/currency';

const STORAGE_KEY = 'pulsepay_currency';

interface CurrencyContextType {
  currency: CurrencyCode;
  symbol: string;
  setCurrency: (c: CurrencyCode) => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'NGN',
  symbol: '₦',
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored && stored in CURRENCY_SYMBOLS) return stored;
    } catch { /* ignore */ }
    return detectCurrency();
  });

  const setCurrency = (c: CurrencyCode) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
  };

  return (
    <CurrencyContext.Provider value={{ currency, symbol: CURRENCY_SYMBOLS[currency], setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  return useContext(CurrencyContext);
}
