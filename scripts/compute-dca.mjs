/**
 * Menghitung seluruh simulasi DCA dari deret harga mentah, lalu menulis JSON siap
 * pakai ke `data/computed/`. Frontend tinggal `fetch()` — tidak ada perhitungan berat
 * di browser, jadi halaman tetap ringan dibuka dari HP.
 *
 * Rumusnya tidak ditulis ulang di sini: script ini mengimpor modul TypeScript yang
 * sama dengan yang dipakai frontend (`src/lib/finance/`) lewat type stripping bawaan
 * Node 24. Satu sumber kebenaran, satu set unit test.
 *
 * Pakai: node scripts/compute-dca.mjs
 */

import { resolve } from 'node:path';

import { combinePortfolio, simulateDca } from '../src/lib/finance/dca.ts';
import { addMonths, monthIndex } from '../src/lib/finance/months.ts';
import { correlation, monthlyReturns } from '../src/lib/finance/risk.ts';
import { convertSeries } from '../src/lib/finance/dca.ts';
import { COMPUTED_DIR, PRICES_DIR, loadAssets, readJson, sanitizeMonthly, writeJson } from './lib/series.mjs';

// Label sengaja pendek: ini muncul di pemilih periode yang harus muat di layar 375px.
const PERIODS = [
  { key: '1y', months: 12, label_id: '1 thn', label_en: '1y' },
  { key: '3y', months: 36, label_id: '3 thn', label_en: '3y' },
  { key: '5y', months: 60, label_id: '5 thn', label_en: '5y' },
  { key: '10y', months: 120, label_id: '10 thn', label_en: '10y' },
  { key: 'max', months: null, label_id: 'Sejak awal', label_en: 'All time' },
];

/** Ambil deret gabungan kalau ada, kalau tidak jatuh ke snapshot TradingView. */
async function loadSeries(id) {
  const merged = await readJson(resolve(PRICES_DIR, `${id}.json`), null);
  if (merged) return merged;
  return readJson(resolve(PRICES_DIR, `${id}.tv.json`), null);
}

const round = (value, digits = 6) =>
  value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

/** Ringkas hasil simulasi jadi bentuk yang enak dikirim ke browser. */
function summarize(result) {
  if (!result) return null;
  return {
    from: result.from,
    to: result.to,
    months: result.months,
    contribution: result.contribution,
    totalInvested: Math.round(result.totalInvested),
    currentValue: Math.round(result.currentValue),
    units: round(result.units, 8),
    lastPrice: round(result.lastPrice, 4),
    totalReturnPct: round(result.totalReturnPct, 4),
    multiple: round(result.multiple, 6),
    xirr: round(result.xirr, 6),
    twr: round(result.twr, 6),
    volatility: round(result.volatility, 6),
    maxDrawdown: round(result.maxDrawdown, 6),
    assetMaxDrawdown: round(result.assetMaxDrawdown, 6),
    sharpe: round(result.sharpe, 4),
    sortino: round(result.sortino, 4),
    beta: round(result.beta, 4),
    alpha: round(result.alpha, 6),
    partial: result.partial,
  };
}

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

async function main() {
  const config = await loadAssets();
  const { monthlyContributionIDR, fxAsset, benchmark, riskFreeRateAnnual } = config.defaults;

  // ── Muat semua deret harga, bersihkan anomali ──────────────────────────────
  const loaded = new Map();
  const anomalyReport = {};
  let latestMonth = '0000-00';

  for (const asset of config.assets) {
    const raw = await loadSeries(asset.id);
    if (!raw?.monthly?.length) {
      console.warn(`  ! ${asset.id}: tidak ada data harga, dilewati`);
      continue;
    }
    const { monthly, anomalies } = sanitizeMonthly(raw.monthly, asset.sanity ?? {});
    if (anomalies.length > 0) {
      anomalyReport[asset.id] = anomalies;
      console.warn(`  ! ${asset.id}: ${anomalies.length} titik data diperbaiki/dibuang`);
    }
    loaded.set(asset.id, { asset, meta: raw, monthly });
    const last = monthly[monthly.length - 1];
    if (last && last.m > latestMonth) latestMonth = last.m;
  }

  const fx = loaded.get(fxAsset)?.monthly ?? null;
  if (!fx) throw new Error(`Deret kurs "${fxAsset}" tidak ditemukan — aset USD tidak bisa dihitung.`);

  // Benchmark dikonversi ke rupiah juga, supaya Beta & Alpha membandingkan hal
  // yang sejenis: sama-sama dilihat dari kacamata investor berbasis rupiah.
  const benchmarkEntry = loaded.get(benchmark);
  const benchmarkSeries = benchmarkEntry
    ? convertSeries(benchmarkEntry.monthly, benchmarkEntry.asset.quoteCurrency === 'IDR' ? null : fx)
    : null;

  // ── Hitung DCA per aset per periode ───────────────────────────────────────
  const rankings = [];
  const returnsForCorrelation = new Map();

  for (const [id, entry] of loaded) {
    const { asset, meta, monthly } = entry;
    const needsFx = asset.quoteCurrency !== config.baseCurrency;
    const seriesFx = needsFx ? fx : null;

    const inBase = convertSeries(monthly, seriesFx);
    const firstMonth = monthly[0]?.m ?? null;
    const lastMonth = monthly[monthly.length - 1]?.m ?? null;

    const periods = {};
    for (const period of PERIODS) {
      const from = period.months == null ? undefined : addMonths(latestMonth, -(period.months - 1));
      // Aset yang belum listing selama periode itu tetap dihitung sejak bulan
      // pertamanya, tapi ditandai `partial` supaya UI tidak menyamakannya
      // dengan aset yang datanya penuh.
      const result = simulateDca({
        prices: monthly,
        fx: seriesFx,
        contribution: monthlyContributionIDR,
        from,
        to: latestMonth,
        riskFreeAnnual: riskFreeRateAnnual,
        benchmark: id === benchmark ? null : benchmarkSeries,
      });
      periods[period.key] = summarize(result);
    }

    // Deret grafik hanya disimpan untuk 10 tahun & max — dua yang benar-benar
    // dipakai di UI. Menyimpan semuanya membengkakkan JSON tanpa manfaat.
    const chartSeries = {};
    for (const key of ['10y', 'max']) {
      const period = PERIODS.find((p) => p.key === key);
      const from = period.months == null ? undefined : addMonths(latestMonth, -(period.months - 1));
      const result = simulateDca({
        prices: monthly,
        fx: seriesFx,
        contribution: monthlyContributionIDR,
        from,
        to: latestMonth,
        riskFreeAnnual: riskFreeRateAnnual,
      });
      if (result) {
        chartSeries[key] = result.series.map((p) => ({
          m: p.m,
          i: Math.round(p.invested),
          v: Math.round(p.value),
        }));
      }
    }

    const lastPoint = inBase[inBase.length - 1];
    const prevPoint = inBase[inBase.length - 2];

    const record = {
      id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      quoteCurrency: asset.quoteCurrency,
      tags: asset.tags ?? [],
      role: asset.role ?? null,
      source: meta.source ?? 'unknown',
      resolvedSymbol: meta.resolvedSymbol ?? null,
      coingecko: asset.coingecko ?? null,
      dataFrom: firstMonth,
      dataTo: lastMonth,
      lastMonthIsPartial: Boolean(meta.lastMonthIsPartial),
      lastPriceNative: round(monthly[monthly.length - 1]?.c ?? null, 6),
      lastPriceIDR: Math.round(lastPoint?.c ?? 0),
      changeMoMPct: prevPoint?.c ? round(((lastPoint.c - prevPoint.c) / prevPoint.c) * 100, 3) : null,
      note_id: asset.note_id ?? null,
      note_en: asset.note_en ?? null,
      periods,
    };

    rankings.push(record);
    await writeJson(resolve(COMPUTED_DIR, 'dca', `${id}.json`), { ...record, chartSeries });

    const returns = monthlyReturns(inBase.slice(-61));
    if (returns.length >= 24) returnsForCorrelation.set(id, returns);
  }

  // ── Statistik ringkas per periode ─────────────────────────────────────────
  const summaryStats = {};
  for (const period of PERIODS) {
    const values = rankings
      .map((r) => r.periods[period.key]?.totalReturnPct)
      .filter((v) => v != null && Number.isFinite(v));
    const full = rankings.filter((r) => r.periods[period.key] && !r.periods[period.key].partial).length;
    summaryStats[period.key] = {
      count: values.length,
      fullHistoryCount: full,
      mean: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 3) : null,
      median: round(median(values), 3),
      positive: values.filter((v) => v > 0).length,
      negative: values.filter((v) => v <= 0).length,
      best: values.length ? round(Math.max(...values), 3) : null,
      worst: values.length ? round(Math.min(...values), 3) : null,
    };
  }

  // ── Matriks korelasi (5 tahun terakhir, dalam rupiah) ─────────────────────
  const ids = [...returnsForCorrelation.keys()];
  const matrix = {};
  for (const a of ids) {
    matrix[a] = {};
    for (const b of ids) {
      matrix[a][b] = a === b ? 1 : round(correlation(returnsForCorrelation.get(a), returnsForCorrelation.get(b)), 3);
    }
  }

  // ── Contoh portofolio default: 50/50 dari budget bulanan ──────────────────
  const samplePortfolio = (() => {
    const picks = ['spx', 'bbca'].filter((id) => loaded.has(id));
    if (picks.length < 2) return null;
    const half = config.defaults.portfolioBudgetIDR / picks.length;
    const parts = picks
      .map((id) => {
        const entry = loaded.get(id);
        const result = simulateDca({
          prices: entry.monthly,
          fx: entry.asset.quoteCurrency === config.baseCurrency ? null : fx,
          contribution: half,
          from: addMonths(latestMonth, -119),
          to: latestMonth,
          riskFreeAnnual: riskFreeRateAnnual,
        });
        return result ? { id, result } : null;
      })
      .filter(Boolean);
    const combined = combinePortfolio(parts);
    if (!combined) return null;
    return {
      assets: picks,
      contributionPerAsset: half,
      totalInvested: Math.round(combined.totalInvested),
      currentValue: Math.round(combined.currentValue),
      totalReturnPct: round(combined.totalReturnPct, 3),
      xirr: round(combined.xirr, 6),
    };
  })();

  await writeJson(resolve(COMPUTED_DIR, 'rankings.json'), {
    generatedAt: new Date().toISOString(),
    baseCurrency: config.baseCurrency,
    contribution: monthlyContributionIDR,
    latestMonth,
    periods: PERIODS,
    summaryStats,
    assets: rankings,
  });

  await writeJson(resolve(COMPUTED_DIR, 'correlations.json'), {
    generatedAt: new Date().toISOString(),
    window: '60 bulan terakhir, return bulanan dalam IDR',
    ids,
    matrix,
  });

  await writeJson(resolve(COMPUTED_DIR, 'meta.json'), {
    generatedAt: new Date().toISOString(),
    latestMonth,
    baseCurrency: config.baseCurrency,
    contribution: monthlyContributionIDR,
    assetCount: rankings.length,
    fxRate: round(fx[fx.length - 1]?.c ?? null, 2),
    sources: [...new Set(rankings.map((r) => r.source))],
    anomalies: anomalyReport,
    samplePortfolio,
  });

  console.log(`\n✓ ${rankings.length} aset dihitung sampai ${latestMonth}`);
  for (const period of PERIODS) {
    const s = summaryStats[period.key];
    console.log(
      `  ${period.key.padEnd(4)} median ${String(s.median).padStart(9)}%  ` +
        `positif ${s.positive}/${s.count}  data penuh ${s.fullHistoryCount}`,
    );
  }
  if (Object.keys(anomalyReport).length > 0) {
    console.log(`\n  Anomali data tercatat di data/computed/meta.json`);
  }
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
