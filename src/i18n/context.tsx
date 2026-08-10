import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { ReturnBasis } from '../lib/data.ts';
import type { Currency } from '../lib/format.ts';
import { strings } from './strings.ts';
import type { Lang, StringKey } from './strings.ts';

interface Settings {
  lang: Lang;
  currency: Currency;
  /** Dividen ikut dihitung atau tidak. Lihat `ReturnBasis` di lib/data.ts. */
  basis: ReturnBasis;
  /** Setoran bulanan yang diasumsikan di seluruh situs, dalam rupiah. */
  contribution: number;
  setLang: (lang: Lang) => void;
  setCurrency: (currency: Currency) => void;
  setBasis: (basis: ReturnBasis) => void;
  setContribution: (amount: number) => void;
  /** Ambil string terjemahan; `{placeholder}` diganti dari `vars`. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const SettingsContext = createContext<Settings | null>(null);

const STORAGE_KEY = 'value-terminal:settings';

interface StoredSettings {
  lang: Lang;
  currency: Currency;
  basis: ReturnBasis;
  contribution: number;
}

/** Angka bulat yang mudah dibayangkan, dan mudah dibagi dua atau lima di kepala. */
export const DEFAULT_CONTRIBUTION = 1_000_000;
const MIN_CONTRIBUTION = 10_000;
const MAX_CONTRIBUTION = 1_000_000_000;

function readStored(): StoredSettings {
  // Bawaannya total return: mengabaikan dividen membuat saham dividen tinggi
  // tampak rugi padahal tidak. Pengguna tetap bisa memilih price return.
  const fallback: StoredSettings = {
    lang: 'id',
    currency: 'IDR',
    basis: 'total',
    contribution: DEFAULT_CONTRIBUTION,
  };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    const stored = Number(parsed.contribution);
    return {
      lang: parsed.lang === 'en' ? 'en' : 'id',
      currency: parsed.currency === 'USD' ? 'USD' : 'IDR',
      basis: parsed.basis === 'price' ? 'price' : 'total',
      // Nilai tersimpan yang rusak tidak boleh membuat seluruh angka jadi nol.
      contribution:
        Number.isFinite(stored) && stored >= MIN_CONTRIBUTION && stored <= MAX_CONTRIBUTION
          ? stored
          : DEFAULT_CONTRIBUTION,
    };
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [{ lang, currency, basis, contribution }, setState] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, currency, basis, contribution }));
    } catch {
      // Mode privat memblokir localStorage — preferensi hilang saat reload, tapi
      // situsnya tetap berfungsi. Tidak perlu diributkan ke pengguna.
    }
    document.documentElement.lang = lang;
  }, [lang, currency, basis, contribution]);

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
      basis,
      contribution,
      t,
      setLang: (next) => setState((s) => ({ ...s, lang: next })),
      setCurrency: (next) => setState((s) => ({ ...s, currency: next })),
      setBasis: (next) => setState((s) => ({ ...s, basis: next })),
      setContribution: (next) =>
        setState((s) => ({
          ...s,
          contribution: Number.isFinite(next) ? Math.min(Math.max(next, 0), MAX_CONTRIBUTION) : s.contribution,
        })),
    }),
    [lang, currency, basis, contribution, t],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings dipakai di luar SettingsProvider');
  return ctx;
}
