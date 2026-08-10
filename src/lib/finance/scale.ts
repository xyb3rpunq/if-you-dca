/**
 * Penskalaan hasil DCA terhadap besaran setoran.
 *
 * Simulasi DCA bersifat linier terhadap setoran: menyetor dua kali lipat tiap bulan
 * menghasilkan tepat dua kali lipat unit, nilai, dan keuntungan. Karena itu hasil
 * pra-hitung bisa disesuaikan ke nominal apa pun secara EKSAK, tanpa menghitung ulang
 * dan tanpa memuat ulang deret harga.
 *
 * Yang penting: rasio dan persentase TIDAK ikut diskalakan. Return, multiple, XIRR,
 * volatilitas, dan drawdown identik untuk setoran Rp500 ribu maupun Rp5 juta — dan
 * ikut mengalikannya adalah kesalahan yang menghasilkan angka yang terlihat wajar.
 */

/** Bidang yang berupa jumlah uang, jadi ikut berskala dengan setoran. */
const MONEY_FIELDS = [
  'contribution',
  'totalInvested',
  'currentValue',
  'units',
  'realTotalInvested',
] as const;

/**
 * Generik atas tipe aslinya, bukan atas `Record<string, unknown>`: pemanggilnya
 * harus tetap menerima `PeriodResult` yang bertipe penuh, bukan objek serba-unknown.
 *
 * @param result hasil satu periode dari pipeline
 * @param factor setoran pengguna dibagi setoran dasar pipeline
 */
export function scaleMoneyFields<T extends object>(result: T, factor: number): T {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return result;

  const out = { ...result } as Record<string, unknown>;
  for (const field of MONEY_FIELDS) {
    const value = out[field];
    if (typeof value === 'number' && Number.isFinite(value)) out[field] = value * factor;
  }
  return out as T;
}

/**
 * Faktor skala dari setoran dasar ke setoran pilihan pengguna.
 * Nilai yang tidak masuk akal dikembalikan sebagai 1 supaya layar tidak pernah
 * menampilkan nol atau tak hingga hanya karena kolom input sedang kosong.
 */
export function scaleFactor(userContribution: number | null | undefined, baseContribution: number): number {
  if (!Number.isFinite(userContribution) || !Number.isFinite(baseContribution)) return 1;
  if ((userContribution as number) <= 0 || baseContribution <= 0) return 1;
  return (userContribution as number) / baseContribution;
}
