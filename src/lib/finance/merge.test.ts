import { describe, expect, it } from 'vitest';

import { applyDividendFactors, mergeSeries } from './merge.ts';
import { addMonths } from './months.ts';
import type { PricePoint } from './types.ts';

const at = (start: string, ...values: number[]): PricePoint[] =>
  values.map((c, i) => ({ m: addMonths(start, i), c }));

describe('mergeSeries', () => {
  const NOW = '2026-08';

  it('menyambung ekor terbaru setelah menyamakan levelnya', () => {
    // Historis 100/102/104 sampai Juli; sumber terbaru mengukur instrumen yang sama
    // 2% lebih rendah. Ekornya harus dinaikkan, bukan disambung apa adanya.
    const historical = at('2026-05', 100, 102, 104);
    const recent = at('2026-05', 98, 100, 102, 105);
    const { monthly, seam } = mergeSeries(historical, recent, NOW);

    expect(seam.mode).toBe('merged');
    expect(seam.anchorMonth).toBe('2026-07');
    expect(seam.ratio).toBeCloseTo(104 / 102, 6);
    expect(seam.tailMonths).toBe(1);
    expect(monthly).toHaveLength(4);
    expect(monthly[3]?.c).toBeCloseTo(105 * (104 / 102), 6);
  });

  it('tidak memakai bulan berjalan sebagai jangkar', () => {
    // Bulan berjalan belum tutup di kedua sumber, jadi rasionya belum tepercaya.
    const historical = at('2026-06', 100, 102, 104);
    const recent = at('2026-06', 100, 102, 90);
    const { seam } = mergeSeries(historical, recent, NOW);
    expect(seam.anchorMonth).toBe('2026-07');
    expect(seam.ratio).toBeCloseTo(1, 6);
  });

  it('menolak ekor data ketika rasionya di luar batas wajar', () => {
    // Rasio 100x berarti salah ticker atau beda satuan. Menyambungnya merusak data.
    const historical = at('2026-06', 10_000, 10_100);
    const recent = at('2026-06', 100, 101, 102);
    const { monthly, seam } = mergeSeries(historical, recent, NOW);
    expect(seam.mode).toBe('historical-only');
    expect(seam.note).toContain('di luar batas wajar');
    expect(monthly).toHaveLength(2);
  });

  it('memakai satu sumber saja ketika yang lain kosong', () => {
    expect(mergeSeries(null, at('2026-06', 1, 2), NOW).seam.mode).toBe('recent-only');
    expect(mergeSeries(at('2026-06', 1, 2), null, NOW).seam.mode).toBe('historical-only');
    expect(mergeSeries(at('2026-06', 1, 2), [], NOW).seam.mode).toBe('historical-only');
  });

  it('mempertahankan deret historis kalau tidak ada bulan yang beririsan', () => {
    const { monthly, seam } = mergeSeries(at('2020-01', 100, 101), at('2026-06', 200, 201), NOW);
    expect(seam.mode).toBe('historical-only');
    expect(seam.note).toContain('tidak ada bulan beririsan');
    expect(monthly).toHaveLength(2);
  });

  it('tidak menghasilkan bulan ganda di titik sambungan', () => {
    const { monthly } = mergeSeries(at('2026-04', 100, 101, 102, 103), at('2026-05', 100, 101, 102, 104), NOW);
    const months = monthly.map((p) => p.m);
    expect(new Set(months).size).toBe(months.length);
    expect(months).toEqual([...months].sort());
  });

  it('tidak mengubah array masukan', () => {
    const historical = at('2026-06', 100, 102);
    const recent = at('2026-06', 100, 102, 104);
    const snapshot = structuredClone(historical);
    mergeSeries(historical, recent, NOW);
    expect(historical).toEqual(snapshot);
  });
});

describe('applyDividendFactors', () => {
  it('menurunkan harga historis sebesar dividen yang pernah dibayar', () => {
    // Faktor 0,5 di awal berarti dividen selama periode ini setara dengan harga
    // sahamnya sendiri: biaya perolehan efektif investor separuh dari yang tertera.
    const monthly = at('2020-01', 100, 100, 100);
    const factors = new Map([
      ['2020-01', 0.5],
      ['2020-02', 0.75],
      ['2020-03', 1],
    ]);
    const { monthly: out, factorAtStart } = applyDividendFactors(monthly, factors);
    expect(factorAtStart).toBe(0.5);
    expect(out.map((p) => p.c)).toEqual([50, 75, 100]);
  });

  it('membiarkan deret apa adanya kalau tidak ada data dividen', () => {
    const monthly = at('2020-01', 100, 110);
    expect(applyDividendFactors(monthly, null).monthly.map((p) => p.c)).toEqual([100, 110]);
    expect(applyDividendFactors(monthly, new Map()).factorAtStart).toBe(1);
  });

  it('bulan tanpa faktor memakai faktor terakhir, bukan melompat ke 1', () => {
    // Memakai 1 di tengah deret akan menciptakan lonjakan palsu yang terbaca
    // sebagai keuntungan yang tidak pernah ada.
    const monthly = at('2020-01', 100, 100, 100, 100);
    const factors = new Map([
      ['2020-01', 0.8],
      ['2020-04', 1],
    ]);
    const { monthly: out } = applyDividendFactors(monthly, factors);
    expect(out.map((p) => p.c)).toEqual([80, 80, 80, 100]);
  });

  it('bulan sebelum data faktor memakai faktor paling awal yang diketahui', () => {
    const monthly = at('2019-11', 100, 100, 100);
    const factors = new Map([['2020-01', 0.9]]);
    const { monthly: out, factorAtStart } = applyDividendFactors(monthly, factors);
    expect(factorAtStart).toBeCloseTo(0.9, 9);
    expect(out.map((p) => p.c)).toEqual([90, 90, 90]);
  });

  it('mengabaikan faktor nol atau negatif alih-alih menghapus harganya', () => {
    const monthly = at('2020-01', 100, 100);
    const factors = new Map([
      ['2020-01', 0.9],
      ['2020-02', 0],
    ]);
    const { monthly: out } = applyDividendFactors(monthly, factors);
    expect(out[1]?.c).toBe(90);
  });

  it('deret total return tidak pernah melampaui harga aslinya', () => {
    // Faktor selalu ≤ 1 karena dinormalkan ke bar terakhir; kalau hasilnya melebihi
    // harga asli, arah penyesuaiannya terbalik.
    const monthly = at('2020-01', 100, 120, 140);
    const factors = new Map([
      ['2020-01', 0.7],
      ['2020-02', 0.85],
      ['2020-03', 1],
    ]);
    const { monthly: out } = applyDividendFactors(monthly, factors);
    out.forEach((p, i) => expect(p.c).toBeLessThanOrEqual((monthly[i] as PricePoint).c + 1e-9));
  });

  it('tidak mengubah array masukan', () => {
    const monthly = at('2020-01', 100, 100);
    const snapshot = structuredClone(monthly);
    applyDividendFactors(monthly, new Map([['2020-01', 0.5]]));
    expect(monthly).toEqual(snapshot);
  });
});
