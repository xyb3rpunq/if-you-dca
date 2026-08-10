import { describe, expect, it } from 'vitest';

import type { Candle } from './indicators.ts';
import { allTimeHigh, allTimeLow, clusterLevels, supportResistance, swingPoints } from './levels.ts';

const bar = (t: string, h: number, l: number, c: number): Candle => ({ t, h, l, c });

/** Zigzag: naik ke puncak, turun ke lembah, berulang. */
function zigzag(peaks: readonly number[], troughs: readonly number[]): Candle[] {
  const out: Candle[] = [];
  let day = 1;
  const push = (h: number, l: number) => {
    out.push(bar(`2024-01-${String(day).padStart(2, '0')}`, h, l, (h + l) / 2));
    day += 1;
  };
  for (let i = 0; i < Math.max(peaks.length, troughs.length); i += 1) {
    push(90, 80);
    push(92, 82);
    const peak = peaks[i];
    if (peak != null) push(peak, peak - 10);
    push(92, 82);
    push(90, 80);
    const trough = troughs[i];
    if (trough != null) push(trough + 10, trough);
  }
  return out;
}

describe('allTimeHigh & allTimeLow', () => {
  const candles = [bar('2024-01', 110, 90, 100), bar('2024-02', 150, 120, 140), bar('2024-03', 130, 70, 80)];

  it('memakai high tiap bar, bukan penutupan', () => {
    // Penutupan tertinggi adalah 140, tapi puncak sesungguhnya 150.
    const ath = allTimeHigh(candles);
    expect(ath?.price).toBe(150);
    expect(ath?.at).toBe('2024-02');
  });

  it('memakai low tiap bar untuk titik terendah', () => {
    const atl = allTimeLow(candles);
    expect(atl?.price).toBe(70);
    expect(atl?.at).toBe('2024-03');
  });

  it('menghitung jarak harga sekarang dari puncak', () => {
    // 120 dari puncak 150 ⇒ −20%.
    expect(allTimeHigh(candles, 120)?.distancePct as number).toBeCloseTo(-20, 9);
    expect(allTimeHigh(candles, 150)?.distancePct as number).toBeCloseTo(0, 9);
    expect(allTimeHigh(candles, 165)?.distancePct as number).toBeCloseTo(10, 9);
  });

  it('memakai penutupan terakhir kalau harga sekarang tidak diberikan', () => {
    // Penutupan terakhir 80, puncak 150 ⇒ −46,67%.
    expect(allTimeHigh(candles)?.distancePct as number).toBeCloseTo(-46.6667, 3);
  });

  it('mengabaikan bar yang nilainya tidak sah', () => {
    const kotor = [bar('a', Number.NaN, 90, 100), bar('b', 120, 100, 110), bar('c', 0, 0, 0)];
    expect(allTimeHigh(kotor)?.price).toBe(120);
  });

  it('mengembalikan null untuk data kosong', () => {
    expect(allTimeHigh([])).toBeNull();
    expect(allTimeLow([])).toBeNull();
  });
});

describe('swingPoints', () => {
  it('menemukan puncak dan lembah lokal', () => {
    const candles = [
      bar('1', 100, 90, 95),
      bar('2', 105, 95, 100),
      bar('3', 120, 110, 115),
      bar('4', 105, 95, 100),
      bar('5', 100, 90, 95),
    ];
    const swings = swingPoints(candles, 2);
    expect(swings).toHaveLength(1);
    expect(swings[0]).toEqual({ price: 120, at: '3', kind: 'high' });
  });

  it('TIDAK menandai bar terakhir sebagai titik balik', () => {
    // Titik balik belum terkonfirmasi sampai harga bergerak menjauh; menandainya
    // lebih awal berarti mengarang level yang bisa batal besok.
    const candles = [bar('1', 100, 90, 95), bar('2', 105, 95, 100), bar('3', 200, 190, 195)];
    expect(swingPoints(candles, 1).some((s) => s.at === '3')).toBe(false);
  });

  it('mengembalikan kosong kalau datanya terlalu pendek', () => {
    expect(swingPoints([bar('1', 100, 90, 95)], 3)).toEqual([]);
    expect(swingPoints([], 3)).toEqual([]);
    expect(swingPoints([bar('1', 1, 1, 1), bar('2', 2, 2, 2), bar('3', 3, 3, 3)], 0)).toEqual([]);
  });

  it('dataran datar tidak dihitung sebagai titik balik', () => {
    // Bar identik tidak lebih tinggi dari tetangganya, jadi tidak ada yang menonjol.
    const flat = Array.from({ length: 9 }, (_, i) => bar(String(i), 100, 90, 95));
    expect(swingPoints(flat, 2)).toEqual([]);
  });
});

describe('clusterLevels', () => {
  it('menggabungkan titik balik yang berdekatan jadi satu level', () => {
    // Tanpa penggabungan, tiga titik dalam rentang 1% akan tampil sebagai tiga
    // garis berbeda padahal pasar memperlakukannya sebagai satu zona.
    const points = [
      { price: 100, at: '2024-01', kind: 'high' as const },
      { price: 100.5, at: '2024-03', kind: 'high' as const },
      { price: 100.8, at: '2024-02', kind: 'high' as const },
      { price: 150, at: '2024-04', kind: 'high' as const },
    ];
    const levels = clusterLevels(points, 1.5);
    expect(levels).toHaveLength(2);
    expect(levels[0]?.touches).toBe(3);
    expect(levels[0]?.price).toBeCloseTo((100 + 100.5 + 100.8) / 3, 9);
    // Sentuhan terakhir diambil dari periode terbaru di dalam kelompoknya.
    expect(levels[0]?.lastTouch).toBe('2024-03');
    expect(levels[1]?.touches).toBe(1);
  });

  it('toleransi bersifat relatif terhadap harga', () => {
    // Selisih 1 poin itu 1% pada harga 100, tapi hanya 0,02% pada harga 5.000.
    const murah = [
      { price: 100, at: 'a', kind: 'low' as const },
      { price: 101, at: 'b', kind: 'low' as const },
    ];
    const mahal = [
      { price: 5000, at: 'a', kind: 'low' as const },
      { price: 5001, at: 'b', kind: 'low' as const },
    ];
    expect(clusterLevels(murah, 0.5)).toHaveLength(2);
    expect(clusterLevels(mahal, 0.5)).toHaveLength(1);
  });

  it('mengembalikan kosong untuk masukan kosong atau tidak sah', () => {
    expect(clusterLevels([])).toEqual([]);
    expect(clusterLevels([{ price: 0, at: 'a', kind: 'low' }])).toEqual([]);
    expect(clusterLevels([{ price: Number.NaN, at: 'a', kind: 'low' }])).toEqual([]);
  });

  it('hasilnya terurut menaik berdasarkan harga', () => {
    const points = [150, 100, 200, 120].map((price, i) => ({ price, at: String(i), kind: 'high' as const }));
    const levels = clusterLevels(points, 1);
    const prices = levels.map((l) => l.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('supportResistance', () => {
  const candles = zigzag([130, 132, 160], [70, 71, 50]);

  it('memisahkan level di bawah dan di atas harga sekarang', () => {
    const { supports, resistances } = supportResistance(candles, 100);
    expect(supports.every((l) => l.price < 100)).toBe(true);
    expect(resistances.every((l) => l.price > 100)).toBe(true);
    expect(supports.length + resistances.length).toBeGreaterThan(0);
  });

  it('support diurutkan dari yang terdekat di bawah', () => {
    const { supports } = supportResistance(candles, 100);
    for (let i = 1; i < supports.length; i += 1) {
      expect(supports[i]?.price as number).toBeLessThan(supports[i - 1]?.price as number);
    }
  });

  it('resistance diurutkan dari yang terdekat di atas', () => {
    const { resistances } = supportResistance(candles, 100);
    for (let i = 1; i < resistances.length; i += 1) {
      expect(resistances[i]?.price as number).toBeGreaterThan(resistances[i - 1]?.price as number);
    }
  });

  it('level berpindah peran saat harga menembusnya', () => {
    // Perilaku pasar yang nyata, bukan kekeliruan: resistance yang ditembus
    // menjadi support bagi harga yang kini berada di atasnya.
    const rendah = supportResistance(candles, 100);
    const tinggi = supportResistance(candles, 200);
    const adaDiResistance = rendah.resistances.some((r) => r.price > 100);
    const kiniSupport = tinggi.supports.some((s) => s.price > 100);
    expect(adaDiResistance).toBe(true);
    expect(kiniSupport).toBe(true);
  });

  it('menghormati batas jumlah level', () => {
    const { supports, resistances } = supportResistance(candles, 100, { limit: 1 });
    expect(supports.length).toBeLessThanOrEqual(1);
    expect(resistances.length).toBeLessThanOrEqual(1);
  });

  it('harga sekarang yang tidak sah menghasilkan level kosong', () => {
    expect(supportResistance(candles, 0)).toEqual({ supports: [], resistances: [] });
    expect(supportResistance(candles, Number.NaN)).toEqual({ supports: [], resistances: [] });
  });
});
