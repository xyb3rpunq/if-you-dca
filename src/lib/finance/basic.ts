/** Rumus dasar pertumbuhan uang (Section 5A & 5D). Semua pure, tanpa efek samping. */

/** (akhir − awal) / awal × 100 */
export function totalReturnPct(invested: number, currentValue: number): number {
  if (invested <= 0) return 0;
  return ((currentValue - invested) / invested) * 100;
}

/** Berapa kali lipat uang berkembang. 1x artinya balik modal. */
export function multiple(invested: number, currentValue: number): number {
  if (invested <= 0) return 0;
  return currentValue / invested;
}

/**
 * CAGR — laju pertumbuhan tahunan rata-rata untuk investasi sekali setor.
 * Untuk DCA pakai `xirr()`, bukan ini: CAGR mengabaikan kapan uangnya masuk.
 */
export function cagr(beginValue: number, endValue: number, years: number): number | null {
  if (beginValue <= 0 || endValue <= 0 || years <= 0) return null;
  return Math.pow(endValue / beginValue, 1 / years) - 1;
}

/** Bunga majemuk: A = P(1 + r/n)^(nt) */
export function compoundInterest(
  principal: number,
  annualRate: number,
  compoundsPerYear: number,
  years: number,
): number {
  if (compoundsPerYear <= 0) return principal;
  return principal * Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear * years);
}

/** Rule of 72 — perkiraan kasar berapa tahun uang jadi dua kali lipat. */
export function ruleOf72(annualRatePercent: number): number | null {
  if (annualRatePercent <= 0) return null;
  return 72 / annualRatePercent;
}

/** Ubah return total sepanjang periode menjadi setara tahunan. */
export function annualize(totalGrowthRatio: number, years: number): number | null {
  if (totalGrowthRatio <= 0 || years <= 0) return null;
  return Math.pow(totalGrowthRatio, 1 / years) - 1;
}

/** Bunga majemuk bulanan dari laju tahunan. */
export function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}
