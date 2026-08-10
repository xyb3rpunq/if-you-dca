/**
 * Hitung lapisan teknikal tiap aset: puncak sepanjang masa, level support &
 * resistance, dan indikator standar.
 *
 * Butuh data yang tidak dipakai simulasi DCA:
 *   - OHLC BULANAN sepanjang riwayat → puncak sesungguhnya. Puncak hampir tidak
 *     pernah terjadi tepat di penutupan, jadi memakai penutupan bisa meleset jauh.
 *   - OHLC HARIAN dua tahun → indikator dan titik balik. Menghitung RSI dari data
 *     bulanan menghasilkan angka yang benar secara aritmetika tapi tidak berarti
 *     apa-apa: satu titik per bulan tidak menggambarkan momentum.
 *
 * Pakai: node scripts/fetch-technicals.mjs [--only=aapl,btc]
 */

import { resolve } from 'node:path';

import {
  atr,
  bollinger,
  ema,
  macd,
  pivotPoints,
  rsi,
  sma,
  stochastic,
} from '../src/lib/finance/indicators.ts';
import { allTimeHigh, allTimeLow, supportResistance } from '../src/lib/finance/levels.ts';
import { COMPUTED_DIR, loadAssets, writeJson } from './lib/series.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const ONLY = args.only ? new Set(args.only.split(',').map((s) => s.trim().toLowerCase())) : null;
const DELAY_MS = Number(args.delay ?? 700);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, d = 4) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));
const last = (series) => {
  for (let i = series.length - 1; i >= 0; i -= 1) if (series[i] != null) return series[i];
  return null;
};

/** Ambil bar OHLC dari Yahoo dan petakan ke kunci periode di timezone bursanya. */
async function fetchCandles(symbol, range, interval) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false&events=none`;

  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? 'respons kosong');

  const stamps = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const tz = result.meta?.exchangeTimezoneName ?? 'Etc/UTC';

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      ...(interval === '1d' ? { day: '2-digit' } : {}),
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Etc/UTC', year: 'numeric', month: '2-digit' });
  }

  const out = [];
  for (let i = 0; i < stamps.length; i += 1) {
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const o = q.open?.[i];
    if (![h, l, c].every((v) => Number.isFinite(v) && v > 0)) continue;
    out.push({ t: formatter.format(new Date(stamps[i] * 1000)), o: Number.isFinite(o) ? o : c, h, l, c });
  }
  return { candles: out, currency: result.meta?.currency ?? null, marketPrice: result.meta?.regularMarketPrice ?? null };
}

async function main() {
  const config = await loadAssets();
  const targets = config.assets.filter((a) => a.yahoo && (!ONLY || ONLY.has(a.id)));

  console.log(`Menghitung lapisan teknikal untuk ${targets.length} aset…\n`);
  const summary = { generatedAt: new Date().toISOString(), assets: {} };
  let failures = 0;

  for (const asset of targets) {
    process.stdout.write(`  ${asset.id.padEnd(8)} ${asset.yahoo.padEnd(10)} `);
    try {
      const monthly = await fetchCandles(asset.yahoo, '30y', '1mo');
      await sleep(DELAY_MS);
      const daily = await fetchCandles(asset.yahoo, '2y', '1d');

      if (daily.candles.length < 60) throw new Error(`hanya ${daily.candles.length} bar harian`);

      const price = daily.marketPrice ?? daily.candles[daily.candles.length - 1].c;
      const closes = daily.candles.map((c) => c.c);

      const ath = allTimeHigh(monthly.candles, price);
      const atl = allTimeLow(monthly.candles, price);
      const levels = supportResistance(daily.candles, price, { lookback: 5, tolerancePct: 1.5, limit: 4 });

      // Pivot dihitung dari BULAN penuh terakhir, bukan bulan berjalan yang belum
      // tutup — pivot dari bar setengah jadi berubah tiap hari dan tidak bermakna.
      const closedMonths = monthly.candles.filter((c) => c.t !== new Date().toISOString().slice(0, 7));
      const previousMonth = closedMonths[closedMonths.length - 1];
      const pivots = previousMonth ? pivotPoints(previousMonth) : null;

      const macdOut = macd(closes);
      const bb = bollinger(closes, 20, 2);
      const stoch = stochastic(daily.candles, 14, 3);

      const payload = {
        id: asset.id,
        symbol: asset.symbol,
        currency: monthly.currency ?? asset.quoteCurrency,
        generatedAt: summary.generatedAt,
        price: round(price, 6),
        dataFrom: monthly.candles[0]?.t ?? null,
        dailyBars: daily.candles.length,

        allTimeHigh: ath ? { price: round(ath.price, 6), at: ath.at, distancePct: round(ath.distancePct, 2) } : null,
        allTimeLow: atl ? { price: round(atl.price, 6), at: atl.at, distancePct: round(atl.distancePct, 2) } : null,

        supports: levels.supports.map((l) => ({ price: round(l.price, 6), touches: l.touches, lastTouch: l.lastTouch })),
        resistances: levels.resistances.map((l) => ({
          price: round(l.price, 6),
          touches: l.touches,
          lastTouch: l.lastTouch,
        })),
        pivots: pivots
          ? Object.fromEntries(Object.entries(pivots).map(([k, v]) => [k, round(v, 6)]))
          : null,
        pivotBasis: previousMonth?.t ?? null,

        indicators: {
          rsi14: round(last(rsi(closes, 14)), 2),
          sma20: round(last(sma(closes, 20)), 6),
          sma50: round(last(sma(closes, 50)), 6),
          sma200: round(last(sma(closes, 200)), 6),
          ema12: round(last(ema(closes, 12)), 6),
          ema26: round(last(ema(closes, 26)), 6),
          macd: round(last(macdOut.macd), 6),
          macdSignal: round(last(macdOut.signal), 6),
          macdHistogram: round(last(macdOut.histogram), 6),
          bollingerUpper: round(last(bb.upper), 6),
          bollingerMiddle: round(last(bb.middle), 6),
          bollingerLower: round(last(bb.lower), 6),
          bollingerBandwidth: round(last(bb.bandwidth), 4),
          atr14: round(last(atr(daily.candles, 14)), 6),
          stochK: round(last(stoch.k), 2),
          stochD: round(last(stoch.d), 2),
        },
      };

      await writeJson(resolve(COMPUTED_DIR, 'technicals', `${asset.id}.json`), payload);
      summary.assets[asset.id] = {
        status: 'ok',
        ath: payload.allTimeHigh?.price ?? null,
        fromAth: payload.allTimeHigh?.distancePct ?? null,
        rsi14: payload.indicators.rsi14,
        supports: payload.supports.length,
        resistances: payload.resistances.length,
      };

      const fromAth = payload.allTimeHigh?.distancePct;
      console.log(
        `✓ ATH ${payload.allTimeHigh?.price ?? 'n/a'} (${fromAth == null ? 'n/a' : `${fromAth}%`})  ` +
          `RSI ${payload.indicators.rsi14 ?? 'n/a'}  S/R ${payload.supports.length}/${payload.resistances.length}`,
      );
    } catch (err) {
      failures += 1;
      summary.assets[asset.id] = { status: 'failed', error: err.message };
      console.log(`✗ ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  await writeJson(resolve(COMPUTED_DIR, 'technicals', '_summary.json'), summary);
  const ok = targets.length - failures;
  console.log(`\nSelesai: ${ok} berhasil, ${failures} gagal.`);
  if (ok === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
