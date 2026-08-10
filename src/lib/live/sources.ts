/**
 * Logika murni untuk lapisan data real-time.
 *
 * Dipisahkan dari hook-nya supaya bisa diuji tanpa jaringan maupun DOM: parsing
 * frame WebSocket, jeda sambung-ulang, penurunan kurs, dan penilaian kesegaran
 * semuanya bisa salah secara diam-diam, dan justru itu yang paling perlu diuji.
 */

export type Freshness = 'live' | 'recent' | 'stale' | 'unknown';

export interface Tick {
  /** Simbol dalam huruf besar, mis. "BTCUSDT". */
  symbol: string;
  price: number;
  /** Perubahan harga 24 jam dalam persen; null kalau tidak disediakan sumbernya. */
  changePct: number | null;
  /** Waktu peristiwa dari sumber, dalam milidetik epoch. */
  at: number;
}

/**
 * Baca satu frame stream gabungan Binance (`/stream?streams=...`).
 *
 * Sengaja sangat defensif: stream publik boleh mengirim frame kendali, pesan
 * kesalahan, atau bidang yang hilang, dan satu frame aneh tidak boleh menjatuhkan
 * seluruh harga di layar.
 */
export function parseBinanceFrame(raw: string): Tick | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;

  const envelope = payload as { data?: unknown; s?: unknown };
  const body = (typeof envelope.data === 'object' && envelope.data !== null ? envelope.data : payload) as Record<
    string,
    unknown
  >;

  const symbol = typeof body.s === 'string' ? body.s.toUpperCase() : null;
  const price = Number(body.c);
  if (!symbol || !Number.isFinite(price) || price <= 0) return null;

  const open = Number(body.o);
  const changePct = Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : null;
  const at = Number(body.E);

  return { symbol, price, changePct, at: Number.isFinite(at) ? at : Date.now() };
}

/**
 * Jeda sambung-ulang eksponensial dengan jitter.
 *
 * Jitter bukan hiasan: tanpa itu, semua tab yang terputus bersamaan akan menyambung
 * ulang pada milidetik yang sama dan menciptakan lonjakan permintaan ke sumbernya.
 */
export function reconnectDelay(attempt: number, base = 1000, max = 30_000, random = Math.random): number {
  const clamped = Math.max(0, Math.min(attempt, 10));
  const exponential = Math.min(base * 2 ** clamped, max);
  // Jitter penuh: pilih acak di [50%, 100%] dari jeda eksponensialnya.
  return Math.round(exponential * (0.5 + random() * 0.5));
}

/**
 * Turunkan kurs USD/IDR dari satu aset yang dikutip dalam kedua mata uang.
 *
 * CoinGecko bisa mengembalikan harga Bitcoin dalam USD dan IDR sekaligus, dan
 * rasionya adalah kurs yang dipakai pasar saat itu juga — jauh lebih segar daripada
 * kurs referensi bank sentral yang hanya terbit sekali sehari.
 *
 * Hasil di luar rentang wajar ditolak, karena kurs yang salah akan merusak SETIAP
 * angka rupiah di situs ini sekaligus.
 */
export function deriveFxRate(
  priceUsd: number | null | undefined,
  priceIdr: number | null | undefined,
  bounds: { min: number; max: number } = { min: 8000, max: 25_000 },
): number | null {
  if (!Number.isFinite(priceUsd) || !Number.isFinite(priceIdr)) return null;
  const usd = priceUsd as number;
  const idr = priceIdr as number;
  if (usd <= 0 || idr <= 0) return null;

  const rate = idr / usd;
  if (rate < bounds.min || rate > bounds.max) return null;
  return rate;
}

/**
 * Seberapa segar sebuah angka, dinyatakan sebagai kategori — bukan sebagai klaim
 * "live" yang dipukul rata.
 *
 * Ambangnya sengaja ketat: apa pun yang lebih tua dari beberapa menit tidak boleh
 * memakai penanda berdenyut yang sama dengan harga yang benar-benar mengalir.
 */
export function freshnessOf(
  at: number | null | undefined,
  now: number = Date.now(),
  thresholds: { live: number; recent: number } = { live: 60_000, recent: 15 * 60_000 },
): Freshness {
  if (at == null || !Number.isFinite(at)) return 'unknown';
  const age = now - at;
  if (age < 0) return 'live';
  if (age <= thresholds.live) return 'live';
  if (age <= thresholds.recent) return 'recent';
  return 'stale';
}

/** URL stream gabungan Binance untuk sekumpulan simbol. */
export function binanceStreamUrl(symbols: readonly string[]): string | null {
  const clean = [...new Set(symbols.map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  if (clean.length === 0) return null;
  return `wss://stream.binance.com:9443/stream?streams=${clean.map((s) => `${s}@miniTicker`).join('/')}`;
}

export interface QuoteRow {
  symbol: string;
  price: number;
  changePct: number | null;
  currency: string | null;
  at: number;
}

export interface LiveAsset {
  id: string;
  binance?: string | null;
  yahoo?: string | null;
  lastPriceNative: number | null;
  changeMoMPct: number | null;
}

export interface LivePrice {
  price: number;
  changePct: number | null;
  at: number | null;
  source: 'binance' | 'proxy' | 'snapshot';
  freshness: Freshness;
}

/**
 * Gabungkan tiga tingkat kesegaran menjadi satu harga per aset.
 *
 * Urutannya tetap: tick WebSocket mengalahkan kuotasi proxy, dan keduanya
 * mengalahkan snapshot terjadwal. Yang penting bukan sekadar memilih yang termuda,
 * tapi juga MENCATAT dari mana angkanya berasal — supaya UI tidak pernah memasang
 * penanda berdenyut di atas harga yang sebenarnya berumur delapan jam.
 */
export function mergeRealtime(
  assets: readonly LiveAsset[],
  ticks: Readonly<Record<string, Tick>>,
  quotes: Readonly<Record<string, QuoteRow>>,
  now: number = Date.now(),
): Record<string, LivePrice> {
  const out: Record<string, LivePrice> = {};

  for (const asset of assets) {
    const tick = asset.binance ? ticks[asset.binance.toUpperCase()] : undefined;
    if (tick) {
      out[asset.id] = {
        price: tick.price,
        changePct: tick.changePct,
        at: tick.at,
        source: 'binance',
        freshness: freshnessOf(tick.at, now),
      };
      continue;
    }

    const quote = asset.yahoo ? quotes[asset.yahoo] : undefined;
    if (quote) {
      out[asset.id] = {
        price: quote.price,
        changePct: quote.changePct,
        at: quote.at,
        source: 'proxy',
        freshness: freshnessOf(quote.at, now),
      };
      continue;
    }

    if (asset.lastPriceNative != null && Number.isFinite(asset.lastPriceNative)) {
      out[asset.id] = {
        price: asset.lastPriceNative,
        changePct: asset.changeMoMPct,
        at: null,
        // Snapshot tidak pernah mengaku segar. Umurnya dinyatakan lewat waktu
        // pembuatan berkas datanya, bukan lewat penanda live.
        source: 'snapshot',
        freshness: 'unknown',
      };
    }
  }

  return out;
}

/**
 * Baca balasan proxy kuotasi saham.
 *
 * Bentuknya sengaja ditetapkan di sini, bukan mengikuti bentuk Yahoo mentah, supaya
 * proxy bisa diganti tanpa menyentuh frontend.
 */
export function parseQuoteResponse(payload: unknown): QuoteRow[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const rows = (payload as { quotes?: unknown }).quotes;
  if (!Array.isArray(rows)) return [];

  const out: QuoteRow[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const symbol = typeof r.symbol === 'string' ? r.symbol : null;
    const price = Number(r.price);
    if (!symbol || !Number.isFinite(price) || price <= 0) continue;
    const changePct = Number(r.changePct);
    const at = Number(r.at);
    out.push({
      symbol,
      price,
      changePct: Number.isFinite(changePct) ? changePct : null,
      currency: typeof r.currency === 'string' ? r.currency : null,
      at: Number.isFinite(at) ? at : Date.now(),
    });
  }
  return out;
}
