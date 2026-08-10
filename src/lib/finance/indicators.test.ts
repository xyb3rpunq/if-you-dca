import { describe, expect, it } from 'vitest';

import { atr, bollinger, ema, macd, pivotPoints, rsi, sma, stochastic, trueRange } from './indicators.ts';
import type { Candle } from './indicators.ts';

/** Deret contoh Wilder yang dipakai hampir semua referensi RSI. */
const WILDER_CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0,
  46.03, 46.41, 46.22, 45.64,
];

const candle = (h: number, l: number, c: number, t = 'x'): Candle => ({ t, h, l, c });

describe('sma', () => {
  it('menghasilkan rata-rata jendela yang benar', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('periode awal yang belum cukup data bernilai null, bukan nol', () => {
    // Nol akan tergambar sebagai garis jatuh ke dasar grafik.
    const out = sma([10, 20, 30], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe(20);
  });

  it('deret lebih pendek dari periodenya menghasilkan seluruhnya null', () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
    expect(sma([], 5)).toEqual([]);
    expect(sma([1, 2, 3], 0)).toEqual([null, null, null]);
  });

  it('jendela bergeser tanpa akumulasi galat', () => {
    const values = Array.from({ length: 200 }, (_, i) => i + 1);
    const out = sma(values, 10);
    // Rata-rata 191..200 = 195,5
    expect(out[199] as number).toBeCloseTo(195.5, 10);
  });
});

describe('ema', () => {
  it('di-seed dengan SMA, bukan dengan nilai pertama', () => {
    // Seeding yang salah menggeser puluhan titik awal.
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[2]).toBeCloseTo(2, 10);
    // k = 2/4 = 0,5 ⇒ berikutnya 4×0,5 + 2×0,5 = 3
    expect(out[3]).toBeCloseTo(3, 10);
    expect(out[4]).toBeCloseTo(4, 10);
  });

  it('deret konstan menghasilkan EMA konstan', () => {
    const out = ema([5, 5, 5, 5, 5, 5], 3);
    expect(out.slice(2).every((v) => Math.abs((v as number) - 5) < 1e-12)).toBe(true);
  });

  it('null sebelum periode terpenuhi', () => {
    expect(ema([1, 2], 5)).toEqual([null, null]);
  });
});

describe('rsi', () => {
  it('cocok dengan contoh baku Wilder', () => {
    // Titik RSI pertama untuk deret ini berada di sekitar 70,5 pada seluruh
    // platform yang memakai pemulusan Wilder.
    const out = rsi(WILDER_CLOSES, 14);
    expect(out[14] as number).toBeCloseTo(70.46, 1);
    expect(out[15] as number).toBeCloseTo(66.25, 1);
  });

  it('naik terus tanpa penurunan menghasilkan 100', () => {
    const out = rsi(Array.from({ length: 30 }, (_, i) => 100 + i), 14);
    expect(out[29] as number).toBeCloseTo(100, 9);
  });

  it('turun terus tanpa kenaikan menghasilkan 0', () => {
    const out = rsi(Array.from({ length: 30 }, (_, i) => 100 - i), 14);
    expect(out[29] as number).toBeCloseTo(0, 9);
  });

  it('selalu berada di rentang 0–100', () => {
    const noisy = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 3) * 20 + (i % 7));
    for (const v of rsi(noisy, 14)) {
      if (v == null) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('data lebih pendek dari periodenya menghasilkan seluruhnya null', () => {
    expect(rsi([1, 2, 3], 14).every((v) => v === null)).toBe(true);
  });
});

describe('macd', () => {
  it('garis MACD adalah selisih dua EMA', () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5);
    const { macd: line } = macd(values);
    const fast = ema(values, 12);
    const slow = ema(values, 26);
    expect(line[79] as number).toBeCloseTo((fast[79] as number) - (slow[79] as number), 10);
  });

  it('garis sinyal tidak dimulai sebelum MACD terdefinisi', () => {
    // Memperlakukan null sebagai nol akan menarik sinyal ke bawah selama
    // puluhan periode pertama dan memalsukan persilangan.
    const values = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5);
    const { macd: line, signal, histogram } = macd(values);
    const firstMacd = line.findIndex((v) => v != null);
    const firstSignal = signal.findIndex((v) => v != null);
    expect(firstMacd).toBe(25);
    expect(firstSignal).toBe(firstMacd + 8);
    expect(histogram[firstSignal] as number).toBeCloseTo(
      (line[firstSignal] as number) - (signal[firstSignal] as number),
      10,
    );
  });

  it('tren naik yang mulus menghasilkan MACD positif', () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 * 1.01 ** i);
    const { macd: line } = macd(values);
    expect(line[99] as number).toBeGreaterThan(0);
  });

  it('deret terlalu pendek menghasilkan seluruhnya null', () => {
    const { macd: line, signal } = macd([1, 2, 3]);
    expect(line.every((v) => v === null)).toBe(true);
    expect(signal.every((v) => v === null)).toBe(true);
  });
});

describe('bollinger', () => {
  it('memakai simpangan baku populasi, bukan sampel', () => {
    // Untuk 1..5: rata-rata 3, stdev populasi √2 = 1,41421 (sampel akan 1,58114).
    const { middle, upper, lower } = bollinger([1, 2, 3, 4, 5], 5, 2);
    expect(middle[4] as number).toBeCloseTo(3, 10);
    expect(upper[4] as number).toBeCloseTo(3 + 2 * Math.SQRT2, 9);
    expect(lower[4] as number).toBeCloseTo(3 - 2 * Math.SQRT2, 9);
  });

  it('pita menyempit jadi nol saat harga tidak bergerak', () => {
    const { upper, lower, bandwidth } = bollinger([5, 5, 5, 5, 5], 5, 2);
    expect(upper[4] as number).toBeCloseTo(5, 10);
    expect(lower[4] as number).toBeCloseTo(5, 10);
    expect(bandwidth[4] as number).toBeCloseTo(0, 10);
  });

  it('pita atas selalu di atas pita bawah', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10);
    const { upper, lower } = bollinger(values, 20, 2);
    for (let i = 19; i < values.length; i += 1) {
      expect(upper[i] as number).toBeGreaterThanOrEqual(lower[i] as number);
    }
  });
});

describe('trueRange & atr', () => {
  it('true range memakai rentang bar saat tidak ada penutupan sebelumnya', () => {
    expect(trueRange(candle(110, 100, 105), null)).toBe(10);
  });

  it('true range menangkap lompatan dari penutupan sebelumnya', () => {
    // Gap naik: bar 110–105 setelah tutup 90 ⇒ rentang sebenarnya 20, bukan 5.
    expect(trueRange(candle(110, 105, 108), 90)).toBe(20);
    expect(trueRange(candle(95, 90, 92), 110)).toBe(20);
  });

  it('ATR konstan untuk bar yang rentangnya seragam', () => {
    const candles = Array.from({ length: 40 }, () => candle(110, 100, 105));
    const out = atr(candles, 14);
    expect(out[39] as number).toBeCloseTo(10, 6);
  });

  it('ATR null sebelum periodenya terpenuhi', () => {
    const candles = Array.from({ length: 20 }, () => candle(110, 100, 105));
    expect(atr(candles, 14)[13]).toBeNull();
    expect(atr(candles, 14)[14]).not.toBeNull();
  });

  it('ATR tidak pernah negatif', () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(100 + i, 90 + i, 95 + i));
    for (const v of atr(candles, 14)) if (v != null) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('stochastic', () => {
  it('penutupan di puncak rentang memberi %K = 100', () => {
    const candles = Array.from({ length: 20 }, () => candle(110, 90, 110));
    expect(stochastic(candles, 14).k[19] as number).toBeCloseTo(100, 9);
  });

  it('penutupan di dasar rentang memberi %K = 0', () => {
    const candles = Array.from({ length: 20 }, () => candle(110, 90, 90));
    expect(stochastic(candles, 14).k[19] as number).toBeCloseTo(0, 9);
  });

  it('rentang nol memberi 50, bukan NaN', () => {
    // Harga yang benar-benar diam membuat pembaginya nol; NaN akan menular ke
    // seluruh perhitungan berikutnya.
    const candles = Array.from({ length: 20 }, () => candle(100, 100, 100));
    expect(stochastic(candles, 14).k[19]).toBe(50);
  });

  it('%D adalah rata-rata bergerak dari %K', () => {
    const candles = Array.from({ length: 30 }, (_, i) => candle(100 + i, 80 + i, 90 + i));
    const { k, d } = stochastic(candles, 14, 3);
    const window = [k[27], k[28], k[29]].map((v) => v as number);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    expect(d[29] as number).toBeCloseTo(mean, 9);
  });
});

describe('pivotPoints', () => {
  it('cocok dengan rumus klasik', () => {
    // H=110, L=90, C=100 ⇒ P=100, R1=110, S1=90, R2=120, S2=80, R3=130, S3=70
    const p = pivotPoints({ h: 110, l: 90, c: 100 });
    expect(p).toEqual({ pivot: 100, r1: 110, s1: 90, r2: 120, s2: 80, r3: 130, s3: 70 });
  });

  it('level tersusun menaik dari S3 ke R3', () => {
    const p = pivotPoints({ h: 128, l: 112, c: 120 })!;
    const ordered = [p.s3, p.s2, p.s1, p.pivot, p.r1, p.r2, p.r3];
    for (let i = 1; i < ordered.length; i += 1) expect(ordered[i]).toBeGreaterThan(ordered[i - 1] as number);
  });

  it('menolak bar yang tidak masuk akal', () => {
    expect(pivotPoints({ h: 90, l: 110, c: 100 })).toBeNull();
    expect(pivotPoints({ h: Number.NaN, l: 90, c: 100 })).toBeNull();
  });
});
