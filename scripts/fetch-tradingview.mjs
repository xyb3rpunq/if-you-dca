/**
 * Menarik riwayat harga BULANAN dari TradingView Desktop lewat Chrome DevTools Protocol.
 *
 * Kenapa lewat CDP dan bukan HTTP API?
 *   TradingView tidak menyediakan API historis gratis, dan `exportData()` di aplikasi
 *   desktop dikunci ("Data export is not supported") pada paket non-berbayar. Tapi bar
 *   yang SUDAH dimuat ke chart bisa dibaca langsung dari model chart-nya. Itu yang
 *   dilakukan script ini: ganti simbol -> tunggu resolve -> baca `mainSeries().bars()`.
 *
 * Ini script LOKAL, bukan bagian dari CI. GitHub Actions tidak bisa menjalankan
 * TradingView Desktop, jadi hasil script ini di-commit sebagai snapshot historis dan
 * `fetch-prices.mjs` (Yahoo Finance) yang mengurus penyegaran berkala di atasnya.
 *
 * Pakai:
 *   node scripts/fetch-tradingview.mjs
 *   node scripts/fetch-tradingview.mjs --only=aapl,btc,usdidr
 *   node scripts/fetch-tradingview.mjs --port=9222 --timeout=40000
 */

import { connectToChart, sleep } from './lib/cdp.mjs';
import { PRICES_DIR, currentMonthKey, loadAssets, writeJson } from './lib/series.mjs';
import { resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

const PORT = Number(args.port ?? 9222);
const RESOLVE_TIMEOUT_MS = Number(args.timeout ?? 35_000);
const ONLY = args.only ? new Set(args.only.split(',').map((s) => s.trim().toLowerCase())) : null;

/** Suruh chart pindah simbol + timeframe bulanan. */
const setSymbolExpr = (tvSymbol) => `(() => {
  const chart = window.TradingViewApi.activeChart();
  chart.setSymbol(${JSON.stringify(tvSymbol)});
  chart.setResolution('1M');
  return true;
})()`;

/** Laporkan status chart saat ini — dipakai untuk polling kesiapan. */
const probeExpr = `(() => {
  try {
    const chart = window.TradingViewApi.activeChart();
    const series = chart.chartModel().mainSeries();
    const info = series.symbolInfo();
    const bars = series.bars();
    return {
      ok: true,
      name: info ? (info.name || null) : null,
      fullName: info ? (info.full_name || null) : null,
      description: info ? (info.description || null) : null,
      currency: info ? (info.currency_code || null) : null,
      type: info ? (info.type || null) : null,
      exchange: info ? (info.listed_exchange || info.exchange || null) : null,
      timezone: info ? (info.timezone || null) : null,
      interval: series.interval(),
      size: bars.size(),
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
})()`;

/**
 * Baca seluruh bar yang sudah dimuat sebagai [bulan, close] — sisanya tidak dipakai.
 *
 * Penanggalan tidak boleh diambil dari timestamp bar begitu saja. Timestamp itu adalah
 * jam BUKA sesi, dan untuk instrumen 24x5 (forex, CFD komoditas) sesi bulanan dibuka
 * Minggu malam SEBELUM tanggal 1 — bar Oktober 2001 misalnya bertimestamp 30 September.
 * Dipetakan mentah-mentah, ~80 dari 300 bar tumpang tindih dengan bulan tetangganya.
 * Karena itu bulan diambil dari akhir periode bar (API resmi chart), lalu diformat
 * dengan timezone bursa simbolnya.
 */
const readBarsExpr = `(() => {
  const chart = window.TradingViewApi.activeChart();
  const series = chart.chartModel().mainSeries();
  const info = series.symbolInfo() || {};
  const tz = info.timezone || 'Etc/UTC';
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' });
  } catch (err) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Etc/UTC', year: 'numeric', month: '2-digit' });
  }
  const THREE_DAYS = 3 * 24 * 3600;
  let usedFallback = false;
  const toMonth = (barTime) => {
    let stamp = null;
    try {
      const end = chart.barTimeToEndOfPeriod(barTime);
      if (Number.isFinite(end)) stamp = end;
    } catch (err) { /* jatuh ke fallback di bawah */ }
    if (stamp == null) {
      // Cadangan: bar bulanan selalu dibuka dalam rentang [3 hari terakhir bulan
      // sebelumnya .. awal bulan berjalan], jadi geser 3 hari mendaratkannya di bulan yang benar.
      usedFallback = true;
      stamp = barTime + THREE_DAYS;
    }
    return fmt.format(new Date(stamp * 1000)).slice(0, 7);
  };
  const bars = series.bars();
  const first = bars.firstIndex();
  const last = bars.lastIndex();
  const rows = [];
  for (let i = first; i <= last; i += 1) {
    const v = bars.valueAt(i);
    if (!v) continue;
    const time = v[0];
    const close = v[4];
    if (!Number.isFinite(time) || !Number.isFinite(close)) continue;
    rows.push([toMonth(time), close]);
  }
  return { timezone: tz, usedFallback, barCount: rows.length, rows };
})()`;

/** Tunggu sampai simbol yang diminta benar-benar ter-resolve DAN jumlah bar stabil. */
async function waitForSymbol(evaluate, expectedTicker) {
  const deadline = Date.now() + RESOLVE_TIMEOUT_MS;
  let lastSize = -1;
  let stableCount = 0;
  let lastProbe = null;

  while (Date.now() < deadline) {
    await sleep(300);
    const probe = await evaluate(probeExpr);
    lastProbe = probe;
    if (!probe?.ok) continue;

    // TradingView boleh me-route ke bursa lain (NASDAQ:AAPL -> BATS:AAPL), jadi yang
    // dicocokkan cuma tickernya, bukan prefix bursanya.
    const matches = (probe.name ?? '').toUpperCase() === expectedTicker;
    if (!matches || probe.interval !== '1M' || probe.size <= 0) {
      stableCount = 0;
      lastSize = -1;
      continue;
    }

    if (probe.size === lastSize) {
      stableCount += 1;
      if (stableCount >= 2) return probe;
    } else {
      stableCount = 0;
      lastSize = probe.size;
    }
  }

  throw new Error(
    `timeout menunggu ${expectedTicker} (terakhir: ${JSON.stringify(lastProbe)})`,
  );
}

async function main() {
  const config = await loadAssets();
  const targets = config.assets.filter((a) => a.tv && (!ONLY || ONLY.has(a.id)));

  if (targets.length === 0) {
    console.error('Tidak ada aset yang cocok dengan filter --only.');
    process.exitCode = 1;
    return;
  }

  console.log(`Menghubungkan ke TradingView Desktop (CDP port ${PORT})…`);
  const { evaluate, targetUrl, close } = await connectToChart({ port: PORT });
  console.log(`Terhubung: ${targetUrl}`);
  console.log(`Menarik ${targets.length} simbol pada timeframe bulanan.\n`);

  const thisMonth = currentMonthKey();
  const manifest = { source: 'tradingview-desktop', fetchedAt: new Date().toISOString(), assets: {} };
  let failures = 0;

  for (const asset of targets) {
    const expectedTicker = asset.tv.split(':').pop().toUpperCase();
    process.stdout.write(`  ${asset.id.padEnd(8)} ${asset.tv.padEnd(18)} `);

    try {
      await evaluate(setSymbolExpr(asset.tv));
      const probe = await waitForSymbol(evaluate, expectedTicker);
      const raw = await evaluate(readBarsExpr);

      const seen = new Map();
      for (const [month, close] of raw.rows) seen.set(month, close);
      const monthly = [...seen.entries()]
        .map(([m, c]) => ({ m, c }))
        .sort((a, b) => (a.m < b.m ? -1 : 1));

      if (monthly.length === 0) throw new Error('tidak ada bar yang terbaca');
      // Satu bar bulanan = satu bulan. Kalau jumlahnya menyusut, penanggalannya salah
      // dan diamnya jauh lebih berbahaya daripada gagal terang-terangan.
      if (monthly.length !== raw.barCount) {
        throw new Error(
          `${raw.barCount} bar menyusut jadi ${monthly.length} bulan unik (timezone ${raw.timezone}) — penanggalan tidak tepercaya`,
        );
      }

      const last = monthly[monthly.length - 1];
      const payload = {
        id: asset.id,
        symbol: asset.symbol,
        source: 'tradingview',
        tvSymbol: asset.tv,
        resolvedSymbol: probe.fullName ?? asset.tv,
        description: probe.description ?? asset.name,
        currency: probe.currency ?? asset.quoteCurrency,
        assetType: probe.type ?? null,
        exchange: probe.exchange ?? null,
        timezone: raw.timezone,
        interval: '1M',
        fetchedAt: new Date().toISOString(),
        lastMonthIsPartial: last.m === thisMonth,
        count: monthly.length,
        from: monthly[0].m,
        to: last.m,
        monthly,
      };

      await writeJson(resolve(PRICES_DIR, `${asset.id}.tv.json`), payload);
      manifest.assets[asset.id] = {
        status: 'ok',
        resolvedSymbol: payload.resolvedSymbol,
        currency: payload.currency,
        count: payload.count,
        from: payload.from,
        to: payload.to,
      };
      console.log(`✓ ${String(payload.count).padStart(3)} bulan  ${payload.from} → ${payload.to}  (${payload.currency})`);
    } catch (err) {
      failures += 1;
      manifest.assets[asset.id] = { status: 'failed', error: err.message };
      console.log(`✗ ${err.message}`);
    }
  }

  await writeJson(resolve(PRICES_DIR, '_tradingview-manifest.json'), manifest);
  close();

  const ok = targets.length - failures;
  console.log(`\nSelesai: ${ok} berhasil, ${failures} gagal. Manifest: data/prices/_tradingview-manifest.json`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nGagal: ${err.message}`);
  process.exitCode = 1;
});
