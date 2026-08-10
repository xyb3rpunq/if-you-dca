import { annualize, multiple, totalReturnPct } from './basic.ts';
import { monthIndex, monthToDate } from './months.ts';
import {
  annualizedVolatility,
  beta as betaOf,
  jensensAlpha,
  maxDrawdown,
  monthlyReturns,
  sharpeRatio,
  sortinoRatio,
} from './risk.ts';
import type { CashFlow, DcaResult, DcaSeriesPoint, PricePoint } from './types.ts';
import { xirr } from './xirr.ts';

export interface DcaOptions {
  /** Deret harga bulanan dalam mata uang asal aset. */
  prices: readonly PricePoint[];
  /** Kurs USD→IDR per bulan. Null kalau aset sudah berdenominasi rupiah. */
  fx?: readonly PricePoint[] | null;
  /** Setoran per bulan, dalam mata uang dasar (IDR). */
  contribution: number;
  from?: string;
  to?: string;
  riskFreeAnnual?: number;
  /** Deret pembanding untuk Beta & Alpha, sudah dalam mata uang dasar. */
  benchmark?: readonly PricePoint[] | null;
}

/**
 * Konversi deret harga ke mata uang dasar.
 *
 * Membeli aset dolar dengan rupiah itu dua taruhan sekaligus: harga asetnya, dan
 * kurs saat setoran dikonversi. Mengalikan deret harga dengan kurs bulan yang sama
 * membuat keduanya ikut terhitung — hasilnya adalah apa yang benar-benar dialami
 * investor berbasis rupiah, bukan return versi dolar yang lebih enak dilihat.
 */
export function convertSeries(
  prices: readonly PricePoint[],
  fx?: readonly PricePoint[] | null,
): PricePoint[] {
  if (!fx || fx.length === 0) return prices.map((p) => ({ ...p }));

  const rates = new Map(fx.map((f) => [f.m, f.c]));
  const firstRate = fx[0]?.c ?? null;
  let carried: number | null = null;
  const out: PricePoint[] = [];

  for (const point of prices) {
    const direct = rates.get(point.m);
    if (direct != null && direct > 0) carried = direct;
    // Bulan tanpa data kurs memakai kurs terakhir yang diketahui; kalau deret harga
    // dimulai sebelum data kurs ada, dipakai kurs paling awal yang tersedia.
    const rate = carried ?? firstRate;
    if (rate == null || rate <= 0) continue;
    out.push({ m: point.m, c: point.c * rate, repaired: point.repaired });
  }
  return out;
}

/** Pasangkan return bulanan aset dengan benchmark, hanya untuk bulan yang ada di keduanya. */
function alignReturns(
  asset: readonly PricePoint[],
  benchmark: readonly PricePoint[],
): { asset: number[]; benchmark: number[] } {
  const bench = new Map(benchmark.map((p) => [p.m, p.c]));
  const assetOut: number[] = [];
  const benchOut: number[] = [];

  for (let i = 1; i < asset.length; i += 1) {
    const prev = asset[i - 1];
    const cur = asset[i];
    if (!prev || !cur || prev.c <= 0) continue;
    const bPrev = bench.get(prev.m);
    const bCur = bench.get(cur.m);
    if (bPrev == null || bCur == null || bPrev <= 0) continue;
    assetOut.push(cur.c / prev.c - 1);
    benchOut.push(bCur / bPrev - 1);
  }
  return { asset: assetOut, benchmark: benchOut };
}

/**
 * Simulasi Dollar-Cost Averaging: setor jumlah tetap tiap bulan, beli di harga
 * penutupan bulan itu, tidak peduli harganya sedang tinggi atau rendah.
 */
export function simulateDca(options: DcaOptions): DcaResult | null {
  const { contribution, riskFreeAnnual = 0.04 } = options;
  if (contribution <= 0) return null;

  const converted = convertSeries(options.prices, options.fx);
  const available = converted.filter((p) => Number.isFinite(p.c) && p.c > 0);
  if (available.length === 0) return null;

  const requestedFrom = options.from ?? available[0]?.m;
  const requestedTo = options.to ?? available[available.length - 1]?.m;
  if (!requestedFrom || !requestedTo) return null;

  // Kunci bulan "YYYY-MM" terurut secara leksikografis, jadi perbandingan string aman.
  const series = available.filter((p) => p.m >= requestedFrom && p.m <= requestedTo);
  if (series.length < 2) return null;

  const first = series[0] as PricePoint;
  const last = series[series.length - 1] as PricePoint;

  let units = 0;
  let invested = 0;
  const flows: CashFlow[] = [];
  const points: DcaSeriesPoint[] = [];

  for (const point of series) {
    units += contribution / point.c;
    invested += contribution;
    flows.push({ when: monthToDate(point.m), amount: -contribution });
    points.push({ m: point.m, invested, value: units * point.c });
  }

  const currentValue = units * last.c;
  flows.push({ when: monthToDate(last.m), amount: currentValue });

  const spanYears = (monthIndex(last.m) - monthIndex(first.m)) / 12;
  const returns = monthlyReturns(series);

  let beta: number | null = null;
  let alpha: number | null = null;
  if (options.benchmark && options.benchmark.length > 1) {
    const aligned = alignReturns(series, options.benchmark);
    if (aligned.asset.length >= 2) {
      beta = betaOf(aligned.asset, aligned.benchmark);
      alpha = jensensAlpha(aligned.asset, aligned.benchmark, riskFreeAnnual);
    }
  }

  return {
    from: first.m,
    to: last.m,
    months: series.length,
    contribution,
    totalInvested: invested,
    units,
    lastPrice: last.c,
    currentValue,
    totalReturnPct: totalReturnPct(invested, currentValue),
    multiple: multiple(invested, currentValue),
    xirr: xirr(flows),
    twr: annualize(last.c / first.c, spanYears),
    volatility: annualizedVolatility(returns),
    maxDrawdown: maxDrawdown(points.map((p) => p.value)),
    assetMaxDrawdown: maxDrawdown(series.map((p) => p.c)),
    sharpe: sharpeRatio(returns, riskFreeAnnual),
    sortino: sortinoRatio(returns, riskFreeAnnual),
    beta,
    alpha,
    partial: requestedFrom < first.m,
    series: points,
  };
}

export interface PortfolioPart {
  id: string;
  result: DcaResult;
}

export interface PortfolioResult {
  from: string;
  to: string;
  totalInvested: number;
  currentValue: number;
  totalReturnPct: number;
  multiple: number;
  xirr: number | null;
  maxDrawdown: number | null;
  series: DcaSeriesPoint[];
  parts: PortfolioPart[];
}

/**
 * Gabungkan beberapa hasil DCA jadi satu portofolio.
 *
 * Deret digabung per bulan, dan aset yang belum listing di bulan tertentu hanya
 * dihitung sejak bulan pertamanya — bukan diperlakukan seolah nilainya nol sejak awal,
 * yang akan membuat grafik portofolio seperti anjlok padahal uangnya belum disetor.
 */
export function combinePortfolio(parts: readonly PortfolioPart[]): PortfolioResult | null {
  const usable = parts.filter((p) => p.result.series.length > 0);
  if (usable.length === 0) return null;

  const months = [...new Set(usable.flatMap((p) => p.result.series.map((s) => s.m)))].sort();
  const lookup = usable.map((p) => ({
    part: p,
    byMonth: new Map(p.result.series.map((s) => [s.m, s])),
  }));

  const series: DcaSeriesPoint[] = [];
  for (const m of months) {
    let invested = 0;
    let value = 0;
    for (const { byMonth } of lookup) {
      const point = byMonth.get(m);
      if (!point) continue;
      invested += point.invested;
      value += point.value;
    }
    series.push({ m, invested, value });
  }

  const totalInvested = usable.reduce((acc, p) => acc + p.result.totalInvested, 0);
  const currentValue = usable.reduce((acc, p) => acc + p.result.currentValue, 0);

  // Arus kas gabungan: selisih setoran antar bulan, lalu nilai akhir sebagai satu pemasukan.
  const flows: CashFlow[] = [];
  let prevInvested = 0;
  for (const point of series) {
    const delta = point.invested - prevInvested;
    if (delta > 0) flows.push({ when: monthToDate(point.m), amount: -delta });
    prevInvested = point.invested;
  }
  const lastMonth = series[series.length - 1]?.m;
  if (lastMonth) flows.push({ when: monthToDate(lastMonth), amount: currentValue });

  return {
    from: series[0]?.m ?? '',
    to: lastMonth ?? '',
    totalInvested,
    currentValue,
    totalReturnPct: totalReturnPct(totalInvested, currentValue),
    multiple: multiple(totalInvested, currentValue),
    xirr: xirr(flows),
    maxDrawdown: maxDrawdown(series.map((s) => s.value)),
    series,
    parts: usable,
  };
}
