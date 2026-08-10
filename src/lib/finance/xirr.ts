import type { CashFlow } from './types.ts';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

/**
 * Net present value dengan jarak waktu tidak beraturan.
 * Σ [ CF_i / (1 + r)^(t_i) ], t_i dalam tahun sejak arus kas pertama.
 */
export function xnpv(rate: number, flows: readonly CashFlow[]): number {
  const first = flows[0];
  if (!first) return 0;
  if (rate <= -1) return Number.NaN;

  const origin = first.when.getTime();
  let sum = 0;
  for (const flow of flows) {
    const years = (flow.when.getTime() - origin) / (MS_PER_DAY * DAYS_PER_YEAR);
    sum += flow.amount / Math.pow(1 + rate, years);
  }
  return sum;
}

/**
 * XIRR — laju diskonto yang membuat NPV seluruh arus kas jadi nol.
 *
 * Ini angka return yang benar untuk DCA. "Total Return %" memperlakukan setoran
 * bulan pertama dan setoran bulan lalu seolah sama-sama bekerja selama itu, padahal
 * tidak — sehingga strategi dengan durasi berbeda jadi tidak bisa dibandingkan.
 *
 * Dipakai bisection, bukan Newton-Raphson: lebih lambat beberapa mikrodetik tapi
 * tidak bisa melenceng ke daerah tak hingga saat arus kasnya ekstrem (misal aset
 * yang naik ratusan kali lipat), dan itu justru kasus yang sering muncul di sini.
 *
 * @returns laju tahunan dalam bentuk desimal (0.12 = 12%/tahun), atau null kalau
 *          tidak ada solusi di rentang yang wajar.
 */
export function xirr(
  flows: readonly CashFlow[],
  options: { lower?: number; upper?: number; tolerance?: number } = {},
): number | null {
  if (flows.length < 2) return null;
  if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;

  const tolerance = options.tolerance ?? 1e-9;
  let lo = options.lower ?? -0.9999;
  let hi = options.upper ?? 100;

  let fLo = xnpv(lo, flows);
  const fHi = xnpv(hi, flows);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (fLo === 0) return lo;
  if (fHi === 0) return hi;
  // Tanpa pergantian tanda di rentang ini, tidak ada akar yang bisa dijamin.
  if (fLo > 0 === fHi > 0) return null;

  for (let i = 0; i < 200 && hi - lo > tolerance; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = xnpv(mid, flows);
    if (!Number.isFinite(fMid)) return null;
    if (fMid === 0) return mid;
    if (fLo > 0 !== fMid > 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return (lo + hi) / 2;
}
