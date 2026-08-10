import { useEffect, useState } from 'react';

import { loadJson } from './data.ts';
import type { PricePoint } from './finance/types.ts';

export interface PriceFile {
  id: string;
  symbol: string;
  source: string;
  resolvedSymbol: string | null;
  currency: string;
  fetchedAt: string;
  historicalSnapshotAt: string | null;
  marketPrice: number | null;
  lastMonthIsPartial: boolean;
  count: number;
  from: string;
  to: string;
  monthly: PricePoint[];
  seam?: { mode: string; ratio: number; note: string };
}

/**
 * Muat deret harga mentah untuk perhitungan di sisi klien.
 *
 * Simulator perlu ini karena JSON pra-hitung hanya menyimpan setoran dan periode
 * standar. Rentang tanggal dan nominal bebas hanya bisa dijawab dengan menghitung
 * ulang — dan karena modul finance-nya sama persis dengan yang dipakai pipeline,
 * hasilnya dijamin konsisten dengan angka di halaman Peringkat.
 */
export function usePriceSeries(ids: readonly string[]) {
  const [series, setSeries] = useState<Record<string, PriceFile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const key = [...ids].sort().join(',');

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all(key.split(',').map((id) => loadJson<PriceFile>(`prices/${id}.json`).then((file) => [id, file] as const)))
      .then((entries) => {
        if (!alive) return;
        setSeries((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [key]);

  return { series, loading, error };
}
