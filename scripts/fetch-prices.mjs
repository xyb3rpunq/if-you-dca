/**
 * Penyegaran harga terjadwal — dijalankan GitHub Actions, bukan di browser.
 *
 * Pembagian tugasnya:
 *   fetch-tradingview.mjs  → snapshot historis, dijalankan MANUAL di laptop
 *                            (TradingView Desktop tidak bisa hidup di CI runner)
 *   fetch-prices.mjs (ini) → penyegaran berkala dari Yahoo Finance di CI
 *
 * Dua sumber berbeda tidak boleh disambung mentah-mentah: harga spot emas (TVC:GOLD)
 * dan futures emas (GC=F) beda beberapa dolar, dan sambungan langsung akan terlihat
 * seperti lompatan harga yang tidak pernah terjadi. Karena itu ekor data Yahoo
 * diskalakan dulu ke level TradingView memakai bulan yang beririsan.
 *
 * Pakai:
 *   node scripts/fetch-prices.mjs
 *   node scripts/fetch-prices.mjs --only=aapl,spx
 */

import { resolve } from 'node:path';

import { PRICES_DIR, loadAssets, readJson, writeJson } from './lib/series.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const ONLY = args.only ? new Set(args.only.split(',').map((s) => s.trim().toLowerCase())) : null;
const DELAY_MS = Number(args.delay ?? 900);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Yahoo kadang membalas 429/503 saat CI menembak beruntun — coba lagi dengan jeda menaik. */
async function fetchWithRetry(url, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json,text/plain,*/*' },
      });
      if (res.ok) return res.json();
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status === 404) break;
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts) await sleep(DELAY_MS * 2 ** attempt);
  }
  throw lastError ?? new Error('gagal tanpa penjelasan');
}

/** Ambil bar bulanan Yahoo dan petakan ke kunci "YYYY-MM" di timezone bursanya. */
async function fetchYahooMonthly(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=30y&interval=1mo&includePrePost=false&events=none`;
  const json = await fetchWithRetry(url);

  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? 'respons kosong');

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];
  const tz = result.meta?.exchangeTimezoneName ?? 'Etc/UTC';

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Etc/UTC', year: 'numeric', month: '2-digit' });
  }

  const byMonth = new Map();
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    const time = timestamps[i];
    if (!Number.isFinite(close) || !Number.isFinite(time) || close <= 0) continue;
    byMonth.set(formatter.format(new Date(time * 1000)).slice(0, 7), close);
  }

  const monthly = [...byMonth.entries()].map(([m, c]) => ({ m, c })).sort((a, b) => (a.m < b.m ? -1 : 1));
  return {
    monthly,
    currency: result.meta?.currency ?? null,
    marketPrice: result.meta?.regularMarketPrice ?? null,
    marketTime: result.meta?.regularMarketTime ?? null,
    timezone: tz,
  };
}

/**
 * Sambung snapshot TradingView dengan ekor Yahoo, setelah menyamakan levelnya.
 * Mengembalikan deret gabungan plus catatan bagaimana sambungan itu dibuat, supaya
 * asal-usul tiap angka bisa ditelusuri dan tidak jadi kotak hitam.
 */
function mergeSeries(tv, yahoo) {
  if (!tv?.monthly?.length) {
    return { monthly: yahoo.monthly, seam: { mode: 'yahoo-only', ratio: 1, note: 'tidak ada snapshot TradingView' } };
  }
  if (!yahoo?.monthly?.length) {
    return { monthly: tv.monthly, seam: { mode: 'tradingview-only', ratio: 1, note: 'Yahoo tidak mengembalikan data' } };
  }

  const yahooByMonth = new Map(yahoo.monthly.map((p) => [p.m, p.c]));
  const thisMonth = new Date().toISOString().slice(0, 7);

  // Bulan berjalan belum tutup di kedua sumber, jadi tidak dipakai sebagai jangkar.
  const overlap = tv.monthly.filter((p) => yahooByMonth.has(p.m) && p.m !== thisMonth);
  if (overlap.length === 0) {
    return { monthly: tv.monthly, seam: { mode: 'tradingview-only', ratio: 1, note: 'tidak ada bulan beririsan' } };
  }

  const anchor = overlap[overlap.length - 1];
  const yahooAtAnchor = yahooByMonth.get(anchor.m);
  const ratio = yahooAtAnchor > 0 ? anchor.c / yahooAtAnchor : 1;

  // Rasio jauh dari 1 berarti kedua simbol bukan instrumen yang sama (salah ticker,
  // beda satuan, beda penyesuaian split). Menyambungnya justru merusak data.
  if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 2) {
    return {
      monthly: tv.monthly,
      seam: {
        mode: 'tradingview-only',
        ratio: Number(ratio.toFixed(4)),
        note: `rasio sambungan ${ratio.toFixed(3)} di luar batas wajar pada ${anchor.m} — ekor Yahoo ditolak`,
      },
    };
  }

  const tail = yahoo.monthly.filter((p) => p.m > anchor.m).map((p) => ({ m: p.m, c: p.c * ratio, source: 'yahoo' }));
  const head = tv.monthly.filter((p) => p.m <= anchor.m);

  return {
    monthly: [...head, ...tail],
    seam: {
      mode: 'merged',
      anchorMonth: anchor.m,
      ratio: Number(ratio.toFixed(6)),
      tailMonths: tail.length,
      note: `${tail.length} bulan dari Yahoo diskalakan ×${ratio.toFixed(4)} agar sejajar dengan level TradingView`,
    },
  };
}

async function main() {
  const config = await loadAssets();
  const targets = config.assets.filter((a) => a.yahoo && (!ONLY || ONLY.has(a.id)));

  console.log(`Menyegarkan ${targets.length} aset dari Yahoo Finance…\n`);
  const report = { source: 'yahoo-finance', fetchedAt: new Date().toISOString(), assets: {} };
  let failures = 0;

  for (const asset of targets) {
    process.stdout.write(`  ${asset.id.padEnd(8)} ${asset.yahoo.padEnd(10)} `);
    try {
      const yahoo = await fetchYahooMonthly(asset.yahoo);
      if (yahoo.monthly.length === 0) throw new Error('tidak ada bar bulanan');

      const tv = await readJson(resolve(PRICES_DIR, `${asset.id}.tv.json`), null);
      const { monthly, seam } = mergeSeries(tv, yahoo);
      const last = monthly[monthly.length - 1];

      // Sengaja hanya dua berkas per aset: snapshot TradingView (jarang berubah) dan
      // hasil gabungan. Menyimpan salinan mentah Yahoo juga akan menulis ulang 25 berkas
      // tiap kali cron jalan tanpa menambah informasi — jejak sambungannya sudah
      // terekam di `seam` dan di manifest.
      await writeJson(resolve(PRICES_DIR, `${asset.id}.json`), {
        id: asset.id,
        symbol: asset.symbol,
        source: seam.mode === 'merged' ? 'tradingview+yahoo' : seam.mode,
        resolvedSymbol: tv?.resolvedSymbol ?? asset.yahoo,
        description: tv?.description ?? asset.name,
        currency: tv?.currency ?? yahoo.currency ?? asset.quoteCurrency,
        interval: '1M',
        fetchedAt: report.fetchedAt,
        historicalSnapshotAt: tv?.fetchedAt ?? null,
        seam,
        marketPrice: yahoo.marketPrice,
        lastMonthIsPartial: last?.m === new Date().toISOString().slice(0, 7),
        count: monthly.length,
        from: monthly[0]?.m ?? null,
        to: last?.m ?? null,
        monthly,
      });

      report.assets[asset.id] = { status: 'ok', seam, count: monthly.length, to: last?.m ?? null };
      console.log(`✓ ${String(monthly.length).padStart(3)} bulan → ${last?.m}  [${seam.mode}]`);
    } catch (err) {
      failures += 1;
      report.assets[asset.id] = { status: 'failed', error: err.message };
      console.log(`✗ ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  await writeJson(resolve(PRICES_DIR, '_yahoo-manifest.json'), report);

  const ok = targets.length - failures;
  console.log(`\nSelesai: ${ok} berhasil, ${failures} gagal.`);
  // Sebagian aset gagal itu wajar (ticker delisting, Yahoo rewel sesaat) dan tidak
  // boleh menggagalkan seluruh workflow — data lama tetap terpakai. Yang fatal cuma
  // kalau tidak ada satu pun yang berhasil.
  if (ok === 0) {
    console.error('Tidak ada satu pun aset berhasil disegarkan — kemungkinan Yahoo memblokir runner.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
