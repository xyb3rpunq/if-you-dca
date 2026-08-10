import { useMemo } from 'react';

import { useJson } from './data.ts';
import type { InflationFile } from './data.ts';
import { buildDeflators } from './finance/inflation.ts';

/**
 * Faktor inflasi untuk menyatakan hasil dalam daya beli bulan acuan.
 *
 * Simulator menghitung di sisi klien (karena nominal dan rentangnya bebas), jadi
 * ia butuh deflator yang sama dengan yang dipakai pipeline. Modul perhitungannya
 * identik, jadi angka riil di Simulator konsisten dengan halaman Peringkat.
 */
export function useDeflators(baseMonth: string | null) {
  const { data } = useJson<InflationFile>('inflation.json');

  return useMemo(() => {
    if (!data?.monthly?.length || !baseMonth) {
      return { deflators: new Map<string, number>(), meta: data ?? null };
    }
    const monthly = data.monthly.map((p) => ({ m: p.m, cpi: p.cpi, estimated: Boolean(p.est) }));
    return { deflators: buildDeflators(monthly, baseMonth), meta: data };
  }, [data, baseMonth]);
}
