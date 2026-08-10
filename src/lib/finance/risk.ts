/** Ukuran risiko (Section 5B). Semua menerima array return BULANAN desimal. */

import { monthlyRate } from './basic.ts';
import type { PricePoint } from './types.ts';

export const MONTHS_PER_YEAR = 12;

/** Return bulanan berturut-turut dari deret harga. */
export function monthlyReturns(prices: readonly PricePoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1];
    const cur = prices[i];
    if (!prev || !cur || prev.c <= 0) continue;
    out.push(cur.c / prev.c - 1);
  }
  return out;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Simpangan baku sampel (pembagi n−1) — standar untuk data historis. */
export function stdev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - avg) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

/** Volatilitas tahunan = stdev(return bulanan) × √12 */
export function annualizedVolatility(returns: readonly number[]): number | null {
  const sd = stdev(returns);
  return sd == null ? null : sd * Math.sqrt(MONTHS_PER_YEAR);
}

/**
 * Max drawdown: penurunan terdalam dari puncak tertinggi sebelumnya.
 * Dikembalikan sebagai angka negatif (−0.42 = pernah turun 42% dari puncak).
 */
export function maxDrawdown(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  let peak = Number.NEGATIVE_INFINITY;
  let worst = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value > peak) peak = value;
    if (peak > 0) {
      const dd = (value - peak) / peak;
      if (dd < worst) worst = dd;
    }
  }
  return worst;
}

/** Sharpe: kelebihan return di atas aset bebas risiko, per satu unit volatilitas. */
export function sharpeRatio(returns: readonly number[], riskFreeAnnual: number): number | null {
  const sd = stdev(returns);
  if (sd == null || sd === 0) return null;
  const excessMonthly = mean(returns) - monthlyRate(riskFreeAnnual);
  return (excessMonthly / sd) * Math.sqrt(MONTHS_PER_YEAR);
}

/**
 * Sortino: seperti Sharpe, tapi hanya menghukum volatilitas ke BAWAH.
 * Naik-turun ke atas bukan risiko bagi investor — itu justru yang dicari.
 */
export function sortinoRatio(returns: readonly number[], riskFreeAnnual: number): number | null {
  if (returns.length < 2) return null;
  const target = monthlyRate(riskFreeAnnual);
  let acc = 0;
  let count = 0;
  for (const r of returns) {
    if (r < target) acc += (r - target) ** 2;
    count += 1;
  }
  if (count < 2) return null;
  const downside = Math.sqrt(acc / (count - 1));
  if (downside === 0) return null;
  return ((mean(returns) - target) / downside) * Math.sqrt(MONTHS_PER_YEAR);
}

export function covariance(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const aSlice = a.slice(a.length - n);
  const bSlice = b.slice(b.length - n);
  const aMean = mean(aSlice);
  const bMean = mean(bSlice);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    acc += ((aSlice[i] as number) - aMean) * ((bSlice[i] as number) - bMean);
  }
  return acc / (n - 1);
}

/** Korelasi Pearson, −1..1. Dipakai untuk menilai diversifikasi portofolio. */
export function correlation(a: readonly number[], b: readonly number[]): number | null {
  const cov = covariance(a, b);
  if (cov == null) return null;
  const n = Math.min(a.length, b.length);
  const sdA = stdev(a.slice(a.length - n));
  const sdB = stdev(b.slice(b.length - n));
  if (sdA == null || sdB == null || sdA === 0 || sdB === 0) return null;
  return cov / (sdA * sdB);
}

/** Beta: seberapa keras aset bergerak mengikuti pasar. 1 = seirama indeks. */
export function beta(assetReturns: readonly number[], marketReturns: readonly number[]): number | null {
  const n = Math.min(assetReturns.length, marketReturns.length);
  if (n < 2) return null;
  const market = marketReturns.slice(marketReturns.length - n);
  const cov = covariance(assetReturns, market);
  const marketSd = stdev(market);
  if (cov == null || marketSd == null || marketSd === 0) return null;
  return cov / marketSd ** 2;
}

/**
 * Alpha (Jensen), disetahunkan: kelebihan return di atas yang "seharusnya"
 * didapat untuk risiko pasar sebesar itu. Positif = mengungguli ekspektasi.
 */
export function jensensAlpha(
  assetReturns: readonly number[],
  marketReturns: readonly number[],
  riskFreeAnnual: number,
): number | null {
  const b = beta(assetReturns, marketReturns);
  if (b == null) return null;
  const n = Math.min(assetReturns.length, marketReturns.length);
  const rfMonthly = monthlyRate(riskFreeAnnual);
  const assetMean = mean(assetReturns.slice(assetReturns.length - n));
  const marketMean = mean(marketReturns.slice(marketReturns.length - n));
  const alphaMonthly = assetMean - (rfMonthly + b * (marketMean - rfMonthly));
  return (1 + alphaMonthly) ** MONTHS_PER_YEAR - 1;
}
