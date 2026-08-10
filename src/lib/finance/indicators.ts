/**
 * Indikator teknikal dengan definisi baku.
 *
 * Setiap rumus di sini mengikuti definisi aslinya, bukan penyederhanaan yang
 * "kira-kira mirip". Itu penting karena indikator yang salah sedikit tetap
 * menghasilkan grafik yang terlihat masuk akal — kesalahannya tidak pernah
 * terlihat, hanya menyesatkan. Dua titik yang paling sering keliru:
 *
 *   1. RSI dan ATR memakai pemulusan Wilder (pembagi `period`, bukan `period-1`
 *      ala EMA biasa). Memakai EMA standar menghasilkan angka yang meleset
 *      beberapa poin dan tidak akan cocok dengan platform mana pun.
 *   2. Bollinger Band memakai simpangan baku POPULASI (pembagi n), bukan sampel
 *      (n−1), sesuai definisi John Bollinger.
 */

export interface Candle {
  /** Kunci periode, mis. "2026-08-10" untuk harian atau "2026-08" untuk bulanan. */
  t: string;
  o?: number;
  h: number;
  l: number;
  c: number;
}

/** Deret hasil indikator sejajar dengan masukan; periode awal yang belum cukup data diisi null. */
export type Series = (number | null)[];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Rata-rata bergerak sederhana. */
export function sma(values: readonly number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i] as number;
    if (i >= period) sum -= values[i - period] as number;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Rata-rata bergerak eksponensial, di-seed dengan SMA periode pertama.
 * Seeding dengan nilai pertama saja (bukan SMA) membuat puluhan titik awal meleset.
 */
export function ema(values: readonly number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += values[i] as number;
  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i += 1) {
    prev = (values[i] as number) * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * RSI dengan pemulusan Wilder.
 *
 * Nilai 0–100. Di atas 70 lazim disebut "jenuh beli", di bawah 30 "jenuh jual" —
 * tapi keduanya deskriptif, bukan sinyal. Aset yang sedang tren kuat bisa bertahan
 * di atas 70 selama berbulan-bulan.
 */
export function rsi(values: readonly number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = (values[i] as number) - (values[i - 1] as number);
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  const toRsi = (g: number, l: number) => (l === 0 ? 100 : g === 0 ? 0 : 100 - 100 / (1 + g / l));
  out[period] = toRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = (values[i] as number) - (values[i - 1] as number);
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    // Pemulusan Wilder: pembaginya `period`, bukan `period - 1`.
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

/** MACD klasik: EMA cepat − EMA lambat, dengan garis sinyal EMA dari MACD itu sendiri. */
export function macd(values: readonly number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const macdLine: Series = values.map((_, i) => {
    const f = fastLine[i];
    const s = slowLine[i];
    return isNum(f) && isNum(s) ? f - s : null;
  });

  // Garis sinyal dihitung HANYA dari bagian MACD yang sudah terdefinisi; memasukkan
  // null sebagai nol akan menarik sinyal ke bawah selama puluhan periode pertama.
  const defined = macdLine.filter(isNum);
  const signalDefined = ema(defined, signalPeriod);
  const firstDefined = macdLine.findIndex(isNum);

  const signal: Series = new Array(values.length).fill(null);
  if (firstDefined >= 0) {
    for (let i = 0; i < signalDefined.length; i += 1) signal[firstDefined + i] = signalDefined[i] ?? null;
  }

  const histogram: Series = macdLine.map((m, i) => {
    const s = signal[i];
    return isNum(m) && isNum(s) ? m - s : null;
  });

  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  middle: Series;
  upper: Series;
  lower: Series;
  /** Lebar pita relatif terhadap tengahnya — ukuran kompresi volatilitas. */
  bandwidth: Series;
}

/** Bollinger Bands. Simpangan bakunya POPULASI, sesuai definisi aslinya. */
export function bollinger(values: readonly number[], period = 20, multiplier = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  const bandwidth: Series = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i += 1) {
    const mean = middle[i];
    if (!isNum(mean)) continue;
    let acc = 0;
    for (let k = i - period + 1; k <= i; k += 1) acc += ((values[k] as number) - mean) ** 2;
    const sd = Math.sqrt(acc / period);
    upper[i] = mean + multiplier * sd;
    lower[i] = mean - multiplier * sd;
    bandwidth[i] = mean !== 0 ? ((upper[i] as number) - (lower[i] as number)) / mean : null;
  }

  return { middle, upper, lower, bandwidth };
}

/** True Range satu bar: rentang bar itu sendiri, atau lompatan dari penutupan sebelumnya. */
export function trueRange(candle: Candle, previousClose: number | null): number {
  const range = candle.h - candle.l;
  if (previousClose == null || !Number.isFinite(previousClose)) return range;
  return Math.max(range, Math.abs(candle.h - previousClose), Math.abs(candle.l - previousClose));
}

/** Average True Range dengan pemulusan Wilder — ukuran gejolak dalam satuan harga. */
export function atr(candles: readonly Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length <= period) return out;

  const ranges: number[] = candles.map((candle, i) =>
    trueRange(candle, i > 0 ? (candles[i - 1] as Candle).c : null),
  );

  let sum = 0;
  for (let i = 1; i <= period; i += 1) sum += ranges[i] as number;
  let prev = sum / period;
  out[period] = prev;

  for (let i = period + 1; i < candles.length; i += 1) {
    prev = (prev * (period - 1) + (ranges[i] as number)) / period;
    out[i] = prev;
  }
  return out;
}

export interface StochasticResult {
  k: Series;
  d: Series;
}

/** Stochastic Oscillator: posisi penutupan dalam rentang tertinggi–terendah periode. */
export function stochastic(candles: readonly Candle[], kPeriod = 14, dPeriod = 3): StochasticResult {
  const k: Series = new Array(candles.length).fill(null);

  for (let i = kPeriod - 1; i < candles.length; i += 1) {
    let highest = Number.NEGATIVE_INFINITY;
    let lowest = Number.POSITIVE_INFINITY;
    for (let j = i - kPeriod + 1; j <= i; j += 1) {
      const candle = candles[j] as Candle;
      if (candle.h > highest) highest = candle.h;
      if (candle.l < lowest) lowest = candle.l;
    }
    const span = highest - lowest;
    // Rentang nol berarti harga tidak bergerak sama sekali; 50 adalah titik netral
    // yang jujur, sedangkan pembagian nol akan menghasilkan NaN yang menular.
    k[i] = span === 0 ? 50 : (((candles[i] as Candle).c - lowest) / span) * 100;
  }

  const definedK = k.filter(isNum);
  const smoothed = sma(definedK, dPeriod);
  const firstDefined = k.findIndex(isNum);
  const d: Series = new Array(candles.length).fill(null);
  if (firstDefined >= 0) {
    for (let i = 0; i < smoothed.length; i += 1) d[firstDefined + i] = smoothed[i] ?? null;
  }

  return { k, d };
}

export interface PivotLevels {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

/**
 * Pivot point klasik dari satu periode sebelumnya.
 *
 * Sepenuhnya mekanis — tidak ada penilaian di dalamnya. Levelnya berguna sebagai
 * titik acuan yang banyak diperhatikan pelaku pasar, bukan sebagai ramalan.
 */
export function pivotPoints(previous: Pick<Candle, 'h' | 'l' | 'c'>): PivotLevels | null {
  const { h, l, c } = previous;
  if (![h, l, c].every(isNum) || h < l) return null;

  const pivot = (h + l + c) / 3;
  const range = h - l;
  return {
    pivot,
    r1: 2 * pivot - l,
    s1: 2 * pivot - h,
    r2: pivot + range,
    s2: pivot - range,
    r3: h + 2 * (pivot - l),
    s3: l - 2 * (h - pivot),
  };
}
