import { useJson } from './data.ts';
import type { RankingsFile } from './data.ts';

/**
 * Sumber data bersama untuk hampir semua halaman.
 *
 * Kurs USD/IDR diambil dari aset `usdidr` di dalam berkas yang sama, bukan dari
 * permintaan terpisah — jadi angka rupiah dan dolar di layar selalu berasal dari
 * satu snapshot yang konsisten, tidak pernah campuran dua waktu berbeda.
 */
export function useRankings() {
  const { data, error, loading, reload } = useJson<RankingsFile>('computed/rankings.json');
  const usdRate = data?.assets.find((a) => a.id === 'usdidr')?.lastPriceNative ?? null;
  return { rankings: data, usdRate, error, loading, reload };
}
