/**
 * Menarik data fundamental untuk Value Lens.
 *
 * Sumber utamanya Yahoo Finance, bukan Financial Modeling Prep seperti rencana
 * awal, karena satu alasan yang menentukan: tier gratis FMP dan Finnhub praktis
 * tidak meliput ticker `.JK`, sedangkan 18 dari 25 aset di sini adalah saham IDX.
 * Yahoo meliputnya, dan tanpa API key sama sekali.
 *
 * Selain rasio saat ini, script ini menarik tiga tahun laporan keuangan supaya
 * kualitas bisnis bisa dinilai dari TREN, bukan dari satu potret. ROE 20% sekali
 * dan ROE 20% lima tahun berturut-turut adalah dua hal yang sangat berbeda.
 *
 * Pakai: node scripts/compute-fundamentals.mjs [--only=bbca,nvda]
 */

import { resolve } from 'node:path';

import { reconcileBookValue } from '../src/lib/finance/value.ts';
import { COMPUTED_DIR, PRICES_DIR, loadAssets, readJson, writeJson } from './lib/series.mjs';
import { debtToEquityRatio, fetchQuoteSummary, fetchTimeseries, raw } from './lib/yahoo.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const ONLY = args.only ? new Set(args.only.split(',').map((s) => s.trim().toLowerCase())) : null;
const DELAY_MS = Number(args.delay ?? 600);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, d = 6) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

const TIMESERIES_TYPES = [
  'annualNetIncome',
  'annualTotalRevenue',
  'annualStockholdersEquity',
  'annualTotalAssets',
  'annualFreeCashFlow',
];

function extract(result, fxRate) {
  const stats = result.defaultKeyStatistics ?? {};
  const fin = result.financialData ?? {};
  const detail = result.summaryDetail ?? {};

  const price = raw(fin.currentPrice);
  const marketCap = raw(detail.marketCap);
  const freeCashflow = raw(fin.freeCashflow);
  const trailingEps = raw(stats.trailingEps);
  const pe = raw(detail.trailingPE);

  // Yahoo kadang melaporkan nilai buku saham IDX dalam dolar sementara harganya
  // dalam rupiah. Dibiarkan, P/B terbaca puluhan ribu dan Graham Number ikut rusak.
  const reconciled = reconcileBookValue({ price, bookValuePerShare: raw(stats.bookValue), fxRate });
  const bookValue = reconciled.bookValuePerShare;
  const pb = bookValue != null && price != null && bookValue > 0 ? price / bookValue : raw(stats.priceToBook);

  return {
    // ── Valuasi ────────────────────────────────────────────────────────────
    price,
    marketCap,
    pe,
    forwardPe: raw(detail.forwardPE),
    pb,
    bookValueConverted: reconciled.converted,
    bookValueNote: reconciled.note,
    ps: raw(detail.priceToSalesTrailing12Months),
    peg: raw(stats.pegRatio),
    eps: trailingEps,
    forwardEps: raw(stats.forwardEps),
    bookValuePerShare: bookValue,
    enterpriseValue: raw(stats.enterpriseValue),
    // Earnings yield adalah kebalikan P/E, dan jauh lebih mudah dibandingkan
    // dengan bunga deposito atau obligasi daripada P/E itu sendiri.
    earningsYield: pe != null && pe > 0 ? 1 / pe : null,
    freeCashflowYield: freeCashflow != null && marketCap ? freeCashflow / marketCap : null,

    // ── Kualitas ───────────────────────────────────────────────────────────
    roe: raw(fin.returnOnEquity),
    roa: raw(fin.returnOnAssets),
    grossMargin: raw(fin.grossMargins),
    operatingMargin: raw(fin.operatingMargins),
    profitMargin: raw(fin.profitMargins),
    revenueGrowth: raw(fin.revenueGrowth),
    earningsGrowth: raw(fin.earningsGrowth),

    // ── Kesehatan keuangan ─────────────────────────────────────────────────
    debtToEquity: debtToEquityRatio(fin.debtToEquity),
    currentRatio: raw(fin.currentRatio),
    quickRatio: raw(fin.quickRatio),
    totalCash: raw(fin.totalCash),
    totalDebt: raw(fin.totalDebt),
    freeCashflow,
    operatingCashflow: raw(fin.operatingCashflow),

    // ── Dividen ────────────────────────────────────────────────────────────
    dividendYield: raw(detail.dividendYield),
    payoutRatio: raw(detail.payoutRatio),

  };
}

async function main() {
  const config = await loadAssets();
  const targets = config.assets.filter((a) => a.fundamentals && (!ONLY || ONLY.has(a.id)));
  const generatedAt = new Date().toISOString();

  // Kurs dipakai untuk mendeteksi dan mengoreksi nilai buku yang dilaporkan
  // dalam mata uang berbeda dari harganya.
  const fx = await readJson(resolve(PRICES_DIR, `${config.defaults.fxAsset}.json`), null);
  const fxRate = fx?.monthly?.[fx.monthly.length - 1]?.c ?? null;
  console.log(`Menarik fundamental ${targets.length} saham dari Yahoo Finance (kurs acuan ${fxRate ?? '—'})…\n`);

  const assets = {};
  let ok = 0;
  let repaired = 0;

  for (const asset of targets) {
    process.stdout.write(`  ${asset.id.padEnd(8)} ${asset.fundamentals.padEnd(10)} `);
    try {
      const result = await fetchQuoteSummary(asset.fundamentals);
      const data = extract(result, fxRate);
      if (data.bookValueConverted) repaired += 1;

      // Riwayat tahunan datang dari endpoint terpisah: modul neraca dan arus kas
      // di quoteSummary sudah dikosongkan Yahoo.
      let history = {};
      try {
        const series = await fetchTimeseries(asset.fundamentals, TIMESERIES_TYPES);
        history = {
          netIncome: series.annualNetIncome ?? [],
          revenue: series.annualTotalRevenue ?? [],
          equity: series.annualStockholdersEquity ?? [],
          totalAssets: series.annualTotalAssets ?? [],
          freeCashflow: series.annualFreeCashFlow ?? [],
        };
      } catch (err) {
        // Riwayat itu pelengkap; rasio saat ini tetap berguna tanpanya.
        history = { error: err.message };
      }
      data.history = history;

      // Tanpa harga dan laba per saham, tidak ada satu pun rasio yang bisa
      // dihitung — lebih baik dicatat gagal daripada menampilkan baris kosong.
      if (data.price == null && data.pe == null) throw new Error('tidak ada data valuasi');

      const rounded = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]),
      );

      assets[asset.id] = { ...rounded, ticker: asset.fundamentals, provider: 'yahoo', fetchedAt: generatedAt };
      ok += 1;
      console.log(
        `✓ P/E ${data.pe?.toFixed(1) ?? '—'}  P/B ${data.pb?.toFixed(2) ?? '—'}  ` +
          `ROE ${data.roe != null ? `${(data.roe * 100).toFixed(1)}%` : '—'}  ` +
          `yield ${data.dividendYield != null ? `${(data.dividendYield * 100).toFixed(1)}%` : '—'}` +
          (data.bookValueConverted ? '  [nilai buku dikoreksi satuannya]' : ''),
      );
    } catch (err) {
      assets[asset.id] = { ticker: asset.fundamentals, error: err.message, fetchedAt: generatedAt };
      console.log(`✗ ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  await writeJson(resolve(COMPUTED_DIR, 'fundamentals.json'), {
    generatedAt,
    available: ok > 0,
    provider: 'yahoo-finance',
    coverage: `${ok}/${targets.length}`,
    note:
      'Yahoo Finance dipakai karena meliput ticker .JK, yang tidak dijangkau tier gratis ' +
      'Financial Modeling Prep maupun Finnhub. Tidak memerlukan API key.',
    assets,
  });

  console.log(`\nSelesai: ${ok}/${targets.length} saham punya data fundamental.`);
  if (repaired > 0) {
    console.log(`  ${repaired} saham nilai bukunya dikoreksi satuannya (dilaporkan dalam mata uang lain).`);
  }
  if (ok === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
