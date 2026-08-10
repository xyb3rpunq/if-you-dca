import { describe, expect, it } from 'vitest';

import { sanitizeMonthly } from './sanitize.ts';
import type { PricePoint } from './types.ts';

const series = (...values: number[]): PricePoint[] =>
  values.map((c, i) => ({ m: `2020-${String(i + 1).padStart(2, '0')}`, c }));

const IDR_RULES = { min: 8000, max: 25000 };

describe('sanitizeMonthly', () => {
  it('membiarkan deret sehat apa adanya', () => {
    const input = series(13400, 13500, 13600, 13700);
    const { monthly, anomalies } = sanitizeMonthly(input, IDR_RULES);
    expect(anomalies).toHaveLength(0);
    expect(monthly.map((p) => p.c)).toEqual([13400, 13500, 13600, 13700]);
    expect(monthly.every((p) => p.repaired === undefined)).toBe(true);
  });

  it('menangkap kerusakan USD/IDR yang nyata: nilai 1,34 di antara belasan ribu', () => {
    // Ini bukan kasus karangan. Titik seperti ini pernah ada di data kurs historis,
    // dan tanpa penyaringan ia melipatgandakan hasil DCA tanpa error apa pun.
    const { monthly, anomalies } = sanitizeMonthly(series(13400, 13500, 1.34, 13600, 13700), IDR_RULES);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.raw).toBe(1.34);
    expect(anomalies[0]?.reason).toContain('di bawah batas wajar');
    // Interpolasi linier antara 13.500 dan 13.600.
    expect(anomalies[0]?.repaired).toBeCloseTo(13_550, 6);
    expect(monthly).toHaveLength(5);
    expect(monthly[2]?.c).toBeCloseTo(13_550, 6);
    expect(monthly[2]?.repaired).toBe(true);
  });

  it('menandai nilai di atas batas wajar', () => {
    const { anomalies } = sanitizeMonthly(series(14000, 999_999, 14200), IDR_RULES);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.reason).toContain('di atas batas wajar');
  });

  it('menolak nol, negatif, dan NaN sebagai nilai tidak valid', () => {
    const { monthly, anomalies } = sanitizeMonthly(series(100, 0, 100, -5, 100, Number.NaN, 100));
    expect(anomalies).toHaveLength(3);
    expect(anomalies.every((a) => a.reason.startsWith('nilai tidak valid'))).toBe(true);
    expect(monthly.every((p) => p.c > 0 && Number.isFinite(p.c))).toBe(true);
  });

  it('menangkap lonjakan satu titik yang langsung berbalik, tanpa perlu batas rentang', () => {
    const { monthly, anomalies } = sanitizeMonthly(series(100, 100, 500, 100, 100));
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.reason).toBe('lonjakan satu titik lalu berbalik');
    expect(monthly[2]?.c).toBeCloseTo(100, 6);
  });

  it('menangkap anjlok satu titik yang langsung pulih', () => {
    const { anomalies } = sanitizeMonthly(series(100, 100, 10, 100, 100));
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.raw).toBe(10);
  });

  it('TIDAK menandai kenaikan tajam yang bertahan — itu tren, bukan kerusakan', () => {
    // Pembeda paling penting di fungsi ini. Aset yang benar-benar melonjak 5x lalu
    // bertahan di level baru harus lolos; kalau tidak, sanitizer justru menghapus
    // kejadian pasar yang nyata.
    const { monthly, anomalies } = sanitizeMonthly(series(100, 100, 500, 520, 540));
    expect(anomalies).toHaveLength(0);
    expect(monthly.map((p) => p.c)).toEqual([100, 100, 500, 520, 540]);
  });

  it('memperbaiki anomali di titik pertama dengan tetangga kanannya', () => {
    const { monthly, anomalies } = sanitizeMonthly(series(1.34, 13500, 13600), IDR_RULES);
    expect(anomalies[0]?.repaired).toBe(13_500);
    expect(monthly[0]?.c).toBe(13_500);
  });

  it('memperbaiki anomali di titik terakhir dengan tetangga kirinya', () => {
    const { monthly, anomalies } = sanitizeMonthly(series(13400, 13500, 1.34), IDR_RULES);
    expect(anomalies[0]?.repaired).toBe(13_500);
    expect(monthly[2]?.c).toBe(13_500);
  });

  it('menginterpolasi melintasi anomali beruntun', () => {
    const { monthly } = sanitizeMonthly(series(100, 0, 0, 400), {});
    expect(monthly[1]?.c).toBeCloseTo(200, 6);
    expect(monthly[2]?.c).toBeCloseTo(300, 6);
  });

  it('membuang titik yang tidak punya tetangga sehat sama sekali', () => {
    const { monthly, anomalies } = sanitizeMonthly(series(0, -1, Number.NaN));
    expect(monthly).toHaveLength(0);
    expect(anomalies).toHaveLength(3);
    expect(anomalies.every((a) => a.repaired === null)).toBe(true);
    expect(anomalies[0]?.reason).toContain('dibuang');
  });

  it('tidak mengubah array masukan', () => {
    const input = series(13400, 1.34, 13600);
    const snapshot = structuredClone(input);
    sanitizeMonthly(input, IDR_RULES);
    expect(input).toEqual(snapshot);
  });

  it('menangani deret kosong dan deret satu titik tanpa melempar', () => {
    expect(sanitizeMonthly([]).monthly).toEqual([]);
    expect(sanitizeMonthly(series(13500), IDR_RULES).monthly).toHaveLength(1);
    expect(sanitizeMonthly(series(1.34), IDR_RULES).monthly).toHaveLength(0);
  });

  it('menghormati maxJump yang disetel lebih ketat', () => {
    // Lonjakan 2,5x lolos pada ambang bawaan (4) tapi tertangkap pada ambang 2.
    expect(sanitizeMonthly(series(100, 100, 250, 100, 100)).anomalies).toHaveLength(0);
    expect(sanitizeMonthly(series(100, 100, 250, 100, 100), { maxJump: 2 }).anomalies).toHaveLength(1);
  });

  it('mempertahankan kunci bulan setiap titik', () => {
    const { monthly } = sanitizeMonthly(series(13400, 1.34, 13600), IDR_RULES);
    expect(monthly.map((p) => p.m)).toEqual(['2020-01', '2020-02', '2020-03']);
  });
});
