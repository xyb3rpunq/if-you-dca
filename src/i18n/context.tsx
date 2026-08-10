import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Currency } from '../lib/format.ts';
import { strings } from './strings.ts';
import type { Lang, StringKey } from './strings.ts';

interface Settings {
  lang: Lang;
  currency: Currency;
  setLang: (lang: Lang) => void;
  setCurrency: (currency: Currency) => void;
  /** Ambil string terjemahan; `{placeholder}` diganti dari `vars`. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const SettingsContext = createContext<Settings | null>(null);

const STORAGE_KEY = 'value-terminal:settings';

function readStored(): { lang: Lang; currency: Currency } {
  const fallback: { lang: Lang; currency: Currency } = { lang: 'id', currency: 'IDR' };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{ lang: Lang; currency: Currency }>;
    return {
      lang: parsed.lang === 'en' ? 'en' : 'id',
      currency: parsed.currency === 'USD' ? 'USD' : 'IDR',
    };
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [{ lang, currency }, setState] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, currency }));
    } catch {
      // Mode privat memblokir localStorage — preferensi hilang saat reload, tapi
      // situsnya tetap berfungsi. Tidak perlu diributkan ke pengguna.
    }
    document.documentElement.lang = lang;
  }, [lang, currency]);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      const entry = strings[key];
      let text: string = entry ? entry[lang] : key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo<Settings>(
    () => ({
      lang,
      currency,
      t,
      setLang: (next) => setState((s) => ({ ...s, lang: next })),
      setCurrency: (next) => setState((s) => ({ ...s, currency: next })),
    }),
    [lang, currency, t],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings dipakai di luar SettingsProvider');
  return ctx;
}
