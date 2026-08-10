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
  return { rankings: data, usdRate: fxRateOf(data), error, loading, reload };
}

/** Kurs USD/IDR dari snapshot peringkat. Nol atau negatif diperlakukan sebagai
 *  tidak ada — membaginya hanya menghasilkan Infinity atau angka bertanda terbalik. */
export function fxRateOf(data: RankingsFile | null): number | null {
  const rate = data?.assets.find((a) => a.id === 'usdidr')?.lastPriceNative ?? null;
  return rate && rate > 0 ? rate : null;
}

/**
 * Kurs saja, untuk komponen yang perlu menampilkan rupiah dan dolar berdampingan
 * tanpa ikut menerima seluruh data peringkat lewat prop.
 *
 * Tidak menambah permintaan jaringan: `useJson` memakai cache modul, jadi ini
 * membaca berkas yang sudah diambil halaman induknya.
 */
export function useUsdRate(): number | null {
  const { data } = useJson<RankingsFile>('computed/rankings.json');
  return fxRateOf(data);
}
