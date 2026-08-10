/**
 * Proxy kuotasi untuk Value Terminal.
 *
 * Alasan keberadaannya cuma satu: tidak ada penyedia harga saham gratis yang
 * mengizinkan CORS, jadi halaman statis tidak bisa memanggilnya langsung. Worker ini
 * berdiri di antaranya — mengambil dari Yahoo Finance di sisi server, lalu
 * mengembalikannya dengan header CORS yang benar.
 *
 * Sengaja dibuat sekecil mungkin dan tanpa dependensi. Ia tidak menyimpan apa pun,
 * tidak butuh API key, dan tidak menerima simbol sembarangan.
 *
 * Deploy: lihat worker/README.md (gratis, kuota 100.000 permintaan/hari).
 */

/** Batas jumlah simbol per permintaan, supaya satu panggilan tidak jadi beban besar. */
const MAX_SYMBOLS = 40;

/**
 * Ticker bursa saja: huruf, angka, titik, strip, caret, dan sama-dengan.
 * Ini menutup upaya menjadikan worker sebagai proxy terbuka ke URL mana pun.
 */
const SYMBOL_PATTERN = /^[A-Za-z0-9.^=-]{1,15}$/;

const CACHE_SECONDS = 30;

function corsHeaders(origin, allowed) {
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? (origin ?? '*') : allowed[0] ?? '*';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

/** Ubah satu hasil chart Yahoo jadi bentuk yang dipakai frontend. */
function toQuote(result) {
  const meta = result?.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  const previous = Number(meta.chartPreviousClose ?? meta.previousClose);
  const changePct = Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : null;

  return {
    symbol: meta.symbol,
    price,
    changePct,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? null,
    // Waktu dari bursa, bukan waktu server — supaya frontend bisa menilai kesegaran
    // yang sebenarnya, termasuk saat pasarnya sedang tutup.
    at: Number.isFinite(Number(meta.regularMarketTime)) ? Number(meta.regularMarketTime) * 1000 : Date.now(),
    marketState: meta.marketState ?? null,
  };
}

async function fetchQuote(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1d&interval=1d&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      accept: 'application/json',
    },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return toQuote(body?.chart?.result?.[0]);
}

export default {
  async fetch(request, env) {
    const allowed = (env?.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'method tidak didukung' }, 405, cors);

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, at: Date.now() }, 200, cors);

    const raw = (url.searchParams.get('symbols') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const symbols = [...new Set(raw)].filter((s) => SYMBOL_PATTERN.test(s)).slice(0, MAX_SYMBOLS);
    const rejected = raw.length - symbols.length;

    if (symbols.length === 0) {
      return json({ error: 'parameter symbols kosong atau tidak sah', quotes: [] }, 400, cors);
    }

    // Balasan disimpan di cache tepi supaya banyak pembaca sekaligus tidak
    // menembak Yahoo berkali-kali untuk simbol yang sama.
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/quote?symbols=${symbols.join(',')}`, request);
    const cached = await cache.match(cacheKey);
    if (cached) {
      const clone = new Response(cached.body, cached);
      for (const [k, v] of Object.entries(cors)) clone.headers.set(k, v);
      clone.headers.set('x-vt-cache', 'hit');
      return clone;
    }

    const settled = await Promise.allSettled(symbols.map(fetchQuote));
    const quotes = settled
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value);

    const response = json(
      {
        quotes,
        requested: symbols.length,
        returned: quotes.length,
        rejected,
        at: Date.now(),
      },
      200,
      { ...cors, 'cache-control': `public, max-age=${CACHE_SECONDS}`, 'x-vt-cache': 'miss' },
    );

    await cache.put(cacheKey, response.clone());
    return response;
  },
};
