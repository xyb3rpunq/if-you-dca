/**
 * Menarik rasio fundamental untuk Value Lens.
 *
 * Ini satu-satunya sumber data yang butuh API key, dan key-nya TIDAK PERNAH masuk ke
 * kode frontend — hanya dibaca dari environment di dalam GitHub Actions
 * (`secrets.FMP_API_KEY` / `secrets.FINNHUB_API_KEY`).
 *
 * Tanpa key, script tetap sukses dan menulis penanda "tidak tersedia". Halaman Value
 * Lens lalu menampilkan keadaan kosong yang jujur, bukan angka karangan.
 *
 * Pakai: node scripts/compute-fundamentals.mjs
 */

import { resolve } from 'node:path';

import { COMPUTED_DIR, loadAssets, writeJson } from './lib/series.mjs';

const FMP_KEY = process.env.FMP_API_KEY?.trim();
const FINNHUB_KEY = process.env.FINNHUB_API_KEY?.trim();
const DELAY_MS = Number(process.env.FUNDAMENTALS_DELAY_MS ?? 400);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * FMP memindahkan endpoint gratisnya dari `/api/v3/...` ke `/stable/...`; key baru
 * hanya bekerja di yang kedua, key lama masih di yang pertama. Dicoba keduanya.
 */
async function fetchFmp(ticker) {
  const attempts = [
    {
      quote: `https://financialmodelingprep.com/stable/quote?symbol=${ticker}&apikey=${FMP_KEY}`,
      ratios: `https://financialmodelingprep.com/stable/ratios-ttm?symbol=${ticker}&apikey=${FMP_KEY}`,
      metrics: `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${ticker}&apikey=${FMP_KEY}`,
    },
    {
      quote: `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${FMP_KEY}`,
      ratios: `https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker}?apikey=${FMP_KEY}`,
      metrics: `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${ticker}?apikey=${FMP_KEY}`,
    },
  ];

  let lastError = null;
  for (const urls of attempts) {
    try {
      const [quote, ratios, metrics] = await Promise.all([
        getJson(urls.quote),
        getJson(urls.ratios),
        getJson(urls.metrics),
      ]);
      const q = Array.isArray(quote) ? quote[0] : quote;
      const r = Array.isArray(ratios) ? ratios[0] : ratios;
      const m = Array.isArray(metrics) ? metrics[0] : metrics;
      if (!q && !r && !m) throw new Error('respons kosong');

      return {
        provider: 'financialmodelingprep',
        price: num(q?.price),
        eps: num(q?.eps ?? r?.netIncomePerShareTTM),
        bookValuePerShare: num(m?.bookValuePerShareTTM ?? m?.bookValuePerShare),
        pe: num(q?.pe ?? r?.priceToEarningsRatioTTM ?? r?.peRatioTTM),
        pb: num(r?.priceToBookRatioTTM ?? m?.pbRatioTTM),
        ps: num(r?.priceToSalesRatioTTM ?? m?.priceToSalesRatioTTM),
        dividendYield: num(r?.dividendYielTTM ?? r?.dividendYieldTTM),
        roe: num(r?.returnOnEquityTTM ?? m?.roeTTM),
        roa: num(r?.returnOnAssetsTTM ?? m?.returnOnTangibleAssetsTTM),
        debtToEquity: num(r?.debtToEquityRatioTTM ?? r?.debtEquityRatioTTM ?? m?.debtToEquityTTM),
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('FMP gagal');
}

async function fetchFinnhub(ticker) {
  const json = await getJson(
    `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`,
  );
  const m = json?.metric;
  if (!m) throw new Error('respons kosong');
  return {
    provider: 'finnhub',
    price: null,
    eps: num(m.epsTTM ?? m.epsBasicExclExtraItemsTTM),
    bookValuePerShare: num(m.bookValuePerShareQuarterly ?? m.bookValuePerShareAnnual),
    pe: num(m.peTTM ?? m.peBasicExclExtraTTM),
    pb: num(m.pbQuarterly ?? m.pbAnnual),
    ps: num(m.psTTM ?? m.psAnnual),
    // Finnhub melaporkan yield dalam persen, sedangkan modul finance memakai desimal.
    dividendYield: m.dividendYieldIndicatedAnnual != null ? num(m.dividendYieldIndicatedAnnual) / 100 : null,
    roe: m.roeTTM != null ? num(m.roeTTM) / 100 : null,
    roa: m.roaTTM != null ? num(m.roaTTM) / 100 : null,
    debtToEquity: num(m['totalDebt/totalEquityQuarterly'] ?? m['totalDebt/totalEquityAnnual']),
  };
}

async function main() {
  const config = await loadAssets();
  const targets = config.assets.filter((a) => a.fundamentals);
  const generatedAt = new Date().toISOString();

  if (!FMP_KEY && !FINNHUB_KEY) {
    console.log('Tidak ada FMP_API_KEY maupun FINNHUB_API_KEY — Value Lens akan tampil sebagai keadaan kosong.');
    await writeJson(resolve(COMPUTED_DIR, 'fundamentals.json'), {
      generatedAt,
      available: false,
      reason: 'no-api-key',
      message:
        'Data fundamental butuh API key gratis dari Financial Modeling Prep atau Finnhub. ' +
        'Tambahkan sebagai GitHub Secret bernama FMP_API_KEY, lalu jalankan ulang workflow refresh-data.',
      assets: {},
    });
    return;
  }

  console.log(`Menarik fundamental ${targets.length} saham (${FMP_KEY ? 'FMP' : 'Finnhub'})…\n`);
  const assets = {};
  let ok = 0;

  for (const asset of targets) {
    process.stdout.write(`  ${asset.id.padEnd(8)} ${asset.fundamentals.padEnd(10)} `);
    let data = null;
    let error = null;

    if (FMP_KEY) {
      try {
        data = await fetchFmp(asset.fundamentals);
      } catch (err) {
        error = `FMP: ${err.message}`;
      }
    }
    if (!data && FINNHUB_KEY) {
      try {
        data = await fetchFinnhub(asset.fundamentals);
        error = null;
      } catch (err) {
        error = `${error ? `${error}; ` : ''}Finnhub: ${err.message}`;
      }
    }

    if (data) {
      ok += 1;
      assets[asset.id] = { ...data, ticker: asset.fundamentals, fetchedAt: generatedAt };
      console.log(`✓ ${data.provider}  P/E ${data.pe ?? 'n/a'}  P/B ${data.pb ?? 'n/a'}`);
    } else {
      assets[asset.id] = { ticker: asset.fundamentals, error, fetchedAt: generatedAt };
      console.log(`✗ ${error}`);
    }
    await sleep(DELAY_MS);
  }

  await writeJson(resolve(COMPUTED_DIR, 'fundamentals.json'), {
    generatedAt,
    available: ok > 0,
    provider: FMP_KEY ? 'financialmodelingprep' : 'finnhub',
    coverage: `${ok}/${targets.length}`,
    assets,
  });
  console.log(`\nSelesai: ${ok}/${targets.length} saham punya data fundamental.`);
}

main().catch((err) => {
  console.error(`\nGagal: ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
