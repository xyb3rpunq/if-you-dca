/**
 * Menarik indeks harga konsumen Indonesia dari Bank Dunia.
 *
 * Dipakai untuk menyatakan hasil DCA dalam daya beli hari ini. Rp900.000 yang
 * disetor tahun 2016 bukan Rp900.000 yang sama dengan hari ini, dan simulasi yang
 * mengabaikan itu melebih-lebihkan keberhasilan setiap strategi jangka panjang.
 *
 * Bank Dunia dipilih karena gratis, tanpa API key, dan CORS-nya terbuka — tapi
 * datanya TAHUNAN dan tertinggal beberapa bulan, jadi bulan-bulan terbaru
 * diekstrapolasi dan ditandai sebagai perkiraan.
 *
 * Pakai: node scripts/fetch-inflation.mjs
 */

import { resolve } from 'node:path';

import { interpolateMonthlyCpi } from '../src/lib/finance/inflation.ts';
import { DATA_DIR, writeJson } from './lib/series.mjs';

const INDICATOR = 'FP.CPI.TOTL';
const COUNTRY = 'IDN';
const FROM_MONTH = '1999-01';

async function main() {
  const url = `https://api.worldbank.org/v2/country/${COUNTRY}/indicator/${INDICATOR}?format=json&per_page=200`;
  console.log('Menarik CPI Indonesia dari Bank Dunia…');

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Bank Dunia HTTP ${res.status}`);
  const json = await res.json();

  const rows = Array.isArray(json?.[1]) ? json[1] : [];
  const annual = rows
    .filter((r) => r?.value != null && Number.isFinite(r.value))
    .map((r) => ({ year: Number(r.date), value: Number(r.value) }))
    .filter((r) => Number.isFinite(r.year))
    .sort((a, b) => a.year - b.year);

  if (annual.length < 2) throw new Error('data CPI tidak cukup untuk diinterpolasi');

  const latestActualYear = annual[annual.length - 1].year;
  const now = new Date();
  // Diperpanjang satu tahun ke depan supaya bulan berjalan selalu punya nilai
  // meski publikasi Bank Dunia tertinggal.
  const toMonth = `${now.getUTCFullYear() + 1}-12`;
  const monthly = interpolateMonthlyCpi(annual, FROM_MONTH, toMonth);

  const estimatedFrom = monthly.find((p) => p.estimated && p.m > `${latestActualYear}-01`)?.m ?? null;

  await writeJson(resolve(DATA_DIR, 'inflation.json'), {
    source: 'World Bank — FP.CPI.TOTL (Indonesia)',
    sourceUrl: url,
    fetchedAt: new Date().toISOString(),
    note:
      'CPI tahunan (indeks 2010 = 100) diinterpolasi jadi bulanan secara geometrik, ' +
      'diangkurkan ke pertengahan tahun. Bulan setelah data resmi terakhir diekstrapolasi.',
    baseYear: 2010,
    latestActualYear,
    estimatedFrom,
    annual,
    monthly: monthly.map((p) => ({ m: p.m, cpi: Number(p.cpi.toFixed(4)), ...(p.estimated ? { est: true } : {}) })),
  });

  const first = annual[0];
  const last = annual[annual.length - 1];
  const tenYearsAgo = annual.find((a) => a.year === last.year - 10);
  console.log(`✓ ${annual.length} tahun data (${first.year}–${last.year}), ${monthly.length} bulan diinterpolasi`);
  if (tenYearsAgo) {
    const cumulative = ((last.value / tenYearsAgo.value - 1) * 100).toFixed(1);
    console.log(`  Inflasi kumulatif ${tenYearsAgo.year}→${last.year}: ${cumulative}%`);
  }
  console.log(`  Bulan setelah ${estimatedFrom ?? 'n/a'} ditandai sebagai perkiraan`);
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
