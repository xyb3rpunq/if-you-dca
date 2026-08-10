import type { Candle } from './indicators.ts';

export interface Extreme {
  price: number;
  /** Periode terjadinya, memakai kunci `t` dari candle-nya. */
  at: string;
  /** Jarak harga sekarang dari titik ini, dalam persen. */
  distancePct: number | null;
}

/**
 * Puncak tertinggi sepanjang data yang tersedia.
 *
 * Memakai HIGH tiap bar, bukan penutupan. Puncak sesungguhnya hampir tidak pernah
 * terjadi tepat di penutupan, dan memakai penutupan bisa meleset belasan persen
 * pada aset yang volatil.
 *
 * Catatan kejujuran: ini "tertinggi sepanjang data yang dimiliki", bukan sepanjang
 * sejarah instrumen. Untuk aset yang datanya dimulai 2001, keduanya sama; untuk
 * yang lebih tua, tidak.
 */
export function allTimeHigh(candles: readonly Candle[], currentPrice?: number | null): Extreme | null {
  return extremeOf(candles, 'high', currentPrice);
}

/** Titik terendah sepanjang data, memakai LOW tiap bar. */
export function allTimeLow(candles: readonly Candle[], currentPrice?: number | null): Extreme | null {
  return extremeOf(candles, 'low', currentPrice);
}

function extremeOf(
  candles: readonly Candle[],
  kind: 'high' | 'low',
  currentPrice?: number | null,
): Extreme | null {
  let best: Candle | null = null;
  for (const candle of candles) {
    const value = kind === 'high' ? candle.h : candle.l;
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!best) {
      best = candle;
      continue;
    }
    const bestValue = kind === 'high' ? best.h : best.l;
    if (kind === 'high' ? value > bestValue : value < bestValue) best = candle;
  }
  if (!best) return null;

  const price = kind === 'high' ? best.h : best.l;
  const reference = Number.isFinite(currentPrice) ? (currentPrice as number) : candles[candles.length - 1]?.c;
  const distancePct =
    Number.isFinite(reference) && price > 0 ? (((reference as number) - price) / price) * 100 : null;

  return { price, at: best.t, distancePct };
}

export interface SwingPoint {
  price: number;
  at: string;
  kind: 'high' | 'low';
}

/**
 * Titik balik lokal: bar yang high-nya tertinggi (atau low-nya terendah) di antara
 * `lookback` bar di kiri DAN kanannya.
 *
 * `lookback` bar terakhir sengaja tidak pernah dinyatakan sebagai swing. Sebuah titik
 * balik belum jadi titik balik sampai harga benar-benar bergerak menjauh darinya —
 * menandainya lebih awal berarti mengarang level yang bisa batal besok.
 */
export function swingPoints(candles: readonly Candle[], lookback = 3): SwingPoint[] {
  const out: SwingPoint[] = [];
  if (lookback < 1 || candles.length < lookback * 2 + 1) return out;

  for (let i = lookback; i < candles.length - lookback; i += 1) {
    const current = candles[i] as Candle;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j += 1) {
      if (j === i) continue;
      const other = candles[j] as Candle;
      if (other.h >= current.h) isHigh = false;
      if (other.l <= current.l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ price: current.h, at: current.t, kind: 'high' });
    if (isLow) out.push({ price: current.l, at: current.t, kind: 'low' });
  }
  return out;
}

export interface PriceLevel {
  price: number;
  /** Berapa kali harga berbalik di sekitar level ini. */
  touches: number;
  /** Periode sentuhan terakhir. */
  lastTouch: string;
}

/**
 * Kelompokkan titik balik yang berdekatan jadi satu level.
 *
 * Tanpa ini, sepuluh titik balik dalam rentang 1% akan tampil sebagai sepuluh garis
 * berbeda, padahal pasar memperlakukannya sebagai satu zona. Toleransi bersifat
 * relatif terhadap harga, karena selisih Rp100 berarti sangat berbeda pada saham
 * Rp1.000 dan pada saham Rp50.000.
 */
export function clusterLevels(points: readonly SwingPoint[], tolerancePct = 1.5): PriceLevel[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.price) && p.price > 0).sort((a, b) => a.price - b.price);
  if (sorted.length === 0) return [];

  const clusters: PriceLevel[] = [];
  let bucket: SwingPoint[] = [sorted[0] as SwingPoint];

  const flush = () => {
    const total = bucket.reduce((acc, p) => acc + p.price, 0);
    const lastTouch = bucket.reduce((acc, p) => (p.at > acc ? p.at : acc), bucket[0]?.at ?? '');
    clusters.push({ price: total / bucket.length, touches: bucket.length, lastTouch });
  };

  for (let i = 1; i < sorted.length; i += 1) {
    const point = sorted[i] as SwingPoint;
    const anchor = bucket[0] as SwingPoint;
    const withinTolerance = Math.abs(point.price - anchor.price) / anchor.price <= tolerancePct / 100;
    if (withinTolerance) {
      bucket.push(point);
    } else {
      flush();
      bucket = [point];
    }
  }
  flush();

  return clusters;
}

export interface SupportResistance {
  supports: PriceLevel[];
  resistances: PriceLevel[];
}

/**
 * Level support dan resistance di sekitar harga sekarang.
 *
 * Klasifikasinya murni posisional: level di bawah harga sekarang adalah support,
 * di atasnya resistance. Level yang sama bisa berpindah peran saat harga menembusnya
 * — itu memang perilaku pasar, bukan kekeliruan perhitungan.
 *
 * Diurutkan berdasarkan kedekatan dengan harga sekarang, karena level terdekatlah
 * yang paling relevan; jumlah sentuhan dibawa serta sebagai ukuran kekuatannya.
 */
export function supportResistance(
  candles: readonly Candle[],
  currentPrice: number,
  options: { lookback?: number; tolerancePct?: number; limit?: number } = {},
): SupportResistance {
  const { lookback = 3, tolerancePct = 1.5, limit = 4 } = options;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return { supports: [], resistances: [] };

  const levels = clusterLevels(swingPoints(candles, lookback), tolerancePct);

  const supports = levels
    .filter((l) => l.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, limit);

  const resistances = levels
    .filter((l) => l.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);

  return { supports, resistances };
}
