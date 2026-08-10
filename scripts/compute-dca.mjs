/**
 * Menghitung seluruh simulasi DCA dari deret harga mentah, lalu menulis JSON siap
 * pakai ke `data/computed/`. Frontend tinggal `fetch()` — tidak ada perhitungan berat
 * di browser, jadi halaman tetap ringan dibuka dari HP.
 *
 * Setiap aset dihitung dalam DUA basis:
 *   total — dividen dianggap diinvestasikan ulang (basis bawaan, paling jujur untuk
 *           membandingkan strategi jangka panjang)
 *   price — pergerakan harga saja
 * Pengguna memilih sendiri di UI. Untuk saham dividen tinggi selisihnya bukan
 * kosmetik: sebagian bahkan berpindah dari rugi ke untung.
 *
 * Rumusnya tidak ditulis ulang di sini: script ini mengimpor modul TypeScript yang
 * sama dengan yang dipakai frontend (`src/lib/finance/`) lewat type stripping bawaan
 * Node 24. Satu sumber kebenaran, satu set unit test.
 *
 * Pakai: node scripts/compute-dca.mjs
 */

import { resolve } from 'node:path';

import { combinePortfolio, convertSeries, simulateDca } from '../src/lib/finance/dca.ts';
import { buildDeflators, realMetrics } from '../src/lib/finance/inflation.ts';
import { addMonths } from '../src/lib/finance/months.ts';
import { correlation, monthlyReturns } from '../src/lib/finance/risk.ts';
import { COMPUTED_DIR, DATA_DIR, PRICES_DIR, loadAssets, readJson, sanitizeMonthly, writeJson } from './lib/series.mjs';

const PERIODS = [
  { key: '1y', months: 12, label_id: '1 thn', label_en: '1y' },
  { key: '3y', months: 36, label_id: '3 thn', label_en: '3y' },
  { key: '5y', months: 60, label_id: '5 thn', label_en: '5y' },
  { key: '10y', months: 120, label_id: '10 thn', label_en: '10y' },
  { key: 'max', months: null, label_id: 'Sejak awal', label_en: 'All time' },
];

const BASES = ['total', 'price'];
const CHART_PERIODS = ['10y', 'max'];

async function loadSeries(id) {
  const merged = await readJson(resolve(PRICES_DIR, `${id}.json`), null);
  if (merged) return merged;
  return readJson(resolve(PRICES_DIR, `${id}.tv.json`), null);
}

const round = (value, digits = 6) =>
  value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

function summarize(result, deflators) {
  if (!result) return null;
  const real = realMetrics(result.series, result.contribution, result.currentValue, deflators, result.totalReturnPct);
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
    // Hasil yang sama, dinyatakan dalam daya beli bulan terakhir.
    realTotalInvested: real ? Math.round(real.realTotalInvested) : null,
    realTotalReturnPct: round(real?.realTotalReturnPct, 4),
    realXirr: round(real?.realXirr, 6),
    inflationDragPct: round(real?.inflationDragPct, 4),
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

  // ── Muat inflasi ──────────────────────────────────────────────────────────
  const inflation = await readJson(resolve(DATA_DIR, 'inflation.json'), null);
  if (!inflation) {
    console.warn('  ! data/inflation.json tidak ada — metrik riil dilewati. Jalankan scripts/fetch-inflation.mjs.');
  }
  const cpiMonthly = (inflation?.monthly ?? []).map((p) => ({ m: p.m, cpi: p.cpi, estimated: Boolean(p.est) }));

  // ── Muat semua deret harga, bersihkan anomali ─────────────────────────────
  const loaded = new Map();
  const anomalyReport = {};
  let latestMonth = '0000-00';

  for (const asset of config.assets) {
    const raw = await loadSeries(asset.id);
    if (!raw?.monthly?.length) {
      console.warn(`  ! ${asset.id}: tidak ada data harga, dilewati`);
      continue;
    }
    const price = sanitizeMonthly(raw.monthly, asset.sanity ?? {});
    // Seri total return divalidasi dengan aturan yang sama; kalau file lama belum
    // punya `monthlyTotal`, ia jatuh kembali ke seri harga agar tetap bisa dihitung.
    const total = raw.monthlyTotal?.length
      ? sanitizeMonthly(raw.monthlyTotal, asset.sanity ?? {})
      : { monthly: price.monthly, anomalies: [] };

    if (price.anomalies.length > 0) {
      anomalyReport[asset.id] = price.anomalies;
      console.warn(`  ! ${asset.id}: ${price.anomalies.length} titik data diperbaiki/dibuang`);
    }

    loaded.set(asset.id, { asset, meta: raw, series: { price: price.monthly, total: total.monthly } });
    const last = price.monthly[price.monthly.length - 1];
    if (last && last.m > latestMonth) latestMonth = last.m;
  }

  const deflators = cpiMonthly.length ? buildDeflators(cpiMonthly, latestMonth) : new Map();

  const fx = loaded.get(fxAsset)?.series.price ?? null;
  if (!fx) throw new Error(`Deret kurs "${fxAsset}" tidak ditemukan — aset USD tidak bisa dihitung.`);

  // Benchmark dikonversi ke rupiah juga, dan disiapkan per basis supaya Beta &
  // Alpha membandingkan hal yang sejenis: sama-sama termasuk dividen, atau sama-sama tidak.
  const benchmarkEntry = loaded.get(benchmark);
  const benchmarkSeries = {};
  for (const basis of BASES) {
    benchmarkSeries[basis] = benchmarkEntry
      ? convertSeries(benchmarkEntry.series[basis], benchmarkEntry.asset.quoteCurrency === 'IDR' ? null : fx)
      : null;
  }

  // ── Hitung DCA per aset, per basis, per periode ───────────────────────────
  const rankings = [];
  const returnsForCorrelation = new Map();

  for (const [id, entry] of loaded) {
    const { asset, meta, series } = entry;
    const needsFx = asset.quoteCurrency !== config.baseCurrency;
    const seriesFx = needsFx ? fx : null;

    const periods = {};
    const chartSeries = {};

    for (const basis of BASES) {
      periods[basis] = {};
      chartSeries[basis] = {};
      const prices = series[basis];

      for (const period of PERIODS) {
        const from = period.months == null ? undefined : addMonths(latestMonth, -(period.months - 1));
        const result = simulateDca({
          prices,
          fx: seriesFx,
          contribution: monthlyContributionIDR,
          from,
          to: latestMonth,
          riskFreeAnnual: riskFreeRateAnnual,
          benchmark: id === benchmark ? null : benchmarkSeries[basis],
        });
        periods[basis][period.key] = summarize(result, deflators);

        // Deret grafik hanya untuk periode yang benar-benar dipakai di UI.
        if (result && CHART_PERIODS.includes(period.key)) {
          chartSeries[basis][period.key] = result.series.map((p) => ({
            m: p.m,
            i: Math.round(p.invested),
            v: Math.round(p.value),
          }));
        }
      }
    }

    const inBase = convertSeries(series.price, seriesFx);
    const lastPoint = inBase[inBase.length - 1];
    const prevPoint = inBase[inBase.length - 2];
    const priceMonthly = series.price;

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
      // Simbol sumber live ikut dikirim ke frontend supaya lapisan real-time bisa
      // memetakan aset tanpa tabel terjemahan kedua yang gampang jadi tidak sinkron.
      binance: asset.binance ?? null,
      yahoo: asset.yahoo ?? null,
      dataFrom: priceMonthly[0]?.m ?? null,
      dataTo: priceMonthly[priceMonthly.length - 1]?.m ?? null,
      lastMonthIsPartial: Boolean(meta.lastMonthIsPartial),
      lastPriceNative: round(priceMonthly[priceMonthly.length - 1]?.c ?? null, 6),
      lastPriceIDR: Math.round(lastPoint?.c ?? 0),
      changeMoMPct: prevPoint?.c ? round(((lastPoint.c - prevPoint.c) / prevPoint.c) * 100, 3) : null,
      hasDividendData: Boolean(meta.hasDividendData),
      dividendContributionPct: meta.dividendContributionPct ?? 0,
      note_id: asset.note_id ?? null,
      note_en: asset.note_en ?? null,
      periods,
    };

    rankings.push(record);
    await writeJson(resolve(COMPUTED_DIR, 'dca', `${id}.json`), { ...record, chartSeries });

    const returns = monthlyReturns(convertSeries(series.total, seriesFx).slice(-61));
    if (returns.length >= 24) returnsForCorrelation.set(id, returns);
  }

  // ── Statistik ringkas per basis per periode ───────────────────────────────
  const summaryStats = {};
  for (const basis of BASES) {
    summaryStats[basis] = {};
    for (const period of PERIODS) {
      const values = rankings
        .map((r) => r.periods[basis][period.key]?.totalReturnPct)
        .filter((v) => v != null && Number.isFinite(v));
      const full = rankings.filter(
        (r) => r.periods[basis][period.key] && !r.periods[basis][period.key].partial,
      ).length;
      summaryStats[basis][period.key] = {
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
  }

  // ── Matriks korelasi (5 tahun terakhir, basis total, dalam rupiah) ────────
  const ids = [...returnsForCorrelation.keys()];
  const matrix = {};
  for (const a of ids) {
    matrix[a] = {};
    for (const b of ids) {
      matrix[a][b] = a === b ? 1 : round(correlation(returnsForCorrelation.get(a), returnsForCorrelation.get(b)), 3);
    }
  }

  const samplePortfolio = (() => {
    const picks = ['spx', 'bbca'].filter((id) => loaded.has(id));
    if (picks.length < 2) return null;
    const half = config.defaults.portfolioBudgetIDR / picks.length;
    const parts = picks
      .map((id) => {
        const entry = loaded.get(id);
        const result = simulateDca({
          prices: entry.series.total,
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
      basis: 'total',
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
    bases: BASES,
    defaultBasis: 'total',
    periods: PERIODS,
    summaryStats,
    assets: rankings,
  });

  await writeJson(resolve(COMPUTED_DIR, 'correlations.json'), {
    generatedAt: new Date().toISOString(),
    window: '60 bulan terakhir, return bulanan dalam IDR, basis total return',
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
    inflation: inflation
      ? {
          source: inflation.source,
          latestActualYear: inflation.latestActualYear,
          estimatedFrom: inflation.estimatedFrom,
          fetchedAt: inflation.fetchedAt,
        }
      : null,
    dividendCoverage: rankings.filter((r) => r.hasDividendData).length,
    anomalies: anomalyReport,
    samplePortfolio,
  });

  console.log(`\n✓ ${rankings.length} aset dihitung sampai ${latestMonth}`);
  for (const basis of BASES) {
    const label = basis === 'total' ? 'total return (dividen ikut)' : 'price return (harga saja)';
    console.log(`\n  ${label}`);
    for (const period of PERIODS) {
      const s = summaryStats[basis][period.key];
      console.log(
        `    ${period.key.padEnd(4)} median ${String(s.median).padStart(9)}%  positif ${s.positive}/${s.count}`,
      );
    }
  }
  console.log(`\n  Dividen tersedia untuk ${rankings.filter((r) => r.hasDividendData).length} aset`);
  if (deflators.size === 0) console.log('  Metrik riil TIDAK dihitung (data inflasi tidak ada)');
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
