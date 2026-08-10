import { describe, expect, it } from 'vitest';

import { buildDeflators, interpolateMonthlyCpi, realMetrics } from './inflation.ts';
import type { AnnualCpi } from './inflation.ts';
import { addMonths } from './months.ts';
import type { DcaSeriesPoint } from './types.ts';

/** CPI yang naik tepat 10% tiap tahun — gampang diperiksa dengan tangan. */
const steady: AnnualCpi[] = [
  { year: 2020, value: 100 },
  { year: 2021, value: 110 },
  { year: 2022, value: 121 },
  { year: 2023, value: 133.1 },
];

describe('interpolateMonthlyCpi', () => {
  it('mengangkurkan nilai tahunan ke pertengahan tahun, bukan Januari', () => {
    // CPI tahunan adalah rata-rata sepanjang tahun. Mengangkurkannya ke Januari
    // menggeser seluruh kurva setengah tahun.
    const monthly = interpolateMonthlyCpi(steady, '2020-07', '2023-07');
    expect(monthly.find((p) => p.m === '2020-07')?.cpi).toBeCloseTo(100, 9);
    expect(monthly.find((p) => p.m === '2021-07')?.cpi).toBeCloseTo(110, 9);
    expect(monthly.find((p) => p.m === '2023-07')?.cpi).toBeCloseTo(133.1, 9);
  });

  it('menginterpolasi secara geometrik, bukan linier', () => {
    // Setengah jalan antara 100 dan 110 adalah √(100×110) ≈ 104,881, bukan 105.
    const monthly = interpolateMonthlyCpi(steady, '2020-07', '2021-07');
    expect(monthly.find((p) => p.m === '2021-01')?.cpi).toBeCloseTo(Math.sqrt(100 * 110), 6);
  });

  it('menandai bulan hasil ekstrapolasi sebagai perkiraan', () => {
    const monthly = interpolateMonthlyCpi(steady, '2019-01', '2025-12');
    expect(monthly.find((p) => p.m === '2019-01')?.estimated).toBe(true);
    expect(monthly.find((p) => p.m === '2025-12')?.estimated).toBe(true);
    expect(monthly.find((p) => p.m === '2022-01')?.estimated).toBe(false);
  });

  it('meneruskan tren memakai laju terdekat yang diketahui', () => {
    const monthly = interpolateMonthlyCpi(steady, '2023-07', '2024-07');
    // Setahun setelah angkur terakhir, pada laju 10%/tahun yang sama.
    expect(monthly.find((p) => p.m === '2024-07')?.cpi).toBeCloseTo(133.1 * 1.1, 6);
  });

  it('menghasilkan deret menaik yang rapat tanpa lompatan', () => {
    const monthly = interpolateMonthlyCpi(steady, '2020-01', '2023-12');
    expect(monthly.length).toBe(48);
    for (let i = 1; i < monthly.length; i += 1) {
      const prev = monthly[i - 1]?.cpi as number;
      const cur = monthly[i]?.cpi as number;
      expect(cur).toBeGreaterThan(prev);
      expect(cur / prev).toBeLessThan(1.02);
    }
  });

  it('mengembalikan kosong kalau titik datanya kurang dari dua', () => {
    expect(interpolateMonthlyCpi([], '2020-01', '2021-01')).toEqual([]);
    expect(interpolateMonthlyCpi([{ year: 2020, value: 100 }], '2020-01', '2021-01')).toEqual([]);
  });

  it('mengabaikan nilai CPI yang tidak masuk akal', () => {
    const kotor: AnnualCpi[] = [...steady, { year: 2024, value: 0 }, { year: 2025, value: Number.NaN }];
    const monthly = interpolateMonthlyCpi(kotor, '2020-07', '2023-07');
    expect(monthly.every((p) => p.cpi > 0 && Number.isFinite(p.cpi))).toBe(true);
  });
});

describe('buildDeflators', () => {
  const monthly = interpolateMonthlyCpi(steady, '2020-07', '2023-07');

  it('bulan acuan selalu berfaktor satu', () => {
    const d = buildDeflators(monthly, '2023-07');
    expect(d.get('2023-07')).toBeCloseTo(1, 9);
  });

  it('rupiah lampau bernilai lebih dari satu rupiah hari ini', () => {
    const d = buildDeflators(monthly, '2023-07');
    // 133,1 / 100 = 1,331 — Rp1 di 2020 setara Rp1,331 di 2023.
    expect(d.get('2020-07')).toBeCloseTo(1.331, 6);
    expect(d.get('2021-07')).toBeCloseTo(1.21, 6);
  });

  it('memakai bulan terakhir kalau bulan acuannya tidak ada di deret', () => {
    const d = buildDeflators(monthly, '2099-01');
    expect(d.get('2023-07')).toBeCloseTo(1, 9);
  });

  it('mengembalikan peta kosong untuk masukan kosong', () => {
    expect(buildDeflators([], '2023-07').size).toBe(0);
  });
});

describe('realMetrics', () => {
  const series = (months: number, valuePerMonth: number): DcaSeriesPoint[] =>
    Array.from({ length: months }, (_, i) => ({
      m: addMonths('2020-07', i),
      invested: valuePerMonth * (i + 1),
      value: valuePerMonth * (i + 1),
    }));

  const deflators = buildDeflators(interpolateMonthlyCpi(steady, '2020-07', '2023-07'), '2023-07');

  it('menaikkan setoran lama ke daya beli hari ini', () => {
    // 2 setoran Rp1jt: satu di 2020-07 (faktor 1,331) dan satu di 2023-07 (faktor 1).
    const points: DcaSeriesPoint[] = [
      { m: '2020-07', invested: 1_000_000, value: 1_000_000 },
      { m: '2023-07', invested: 2_000_000, value: 2_000_000 },
    ];
    const result = realMetrics(points, 1_000_000, 2_000_000, deflators, 0);
    expect(result?.realTotalInvested).toBeCloseTo(1_331_000 + 1_000_000, 0);
    // Nominalnya balik modal, tapi secara daya beli justru rugi.
    expect(result?.realTotalReturnPct).toBeLessThan(0);
  });

  it('return riil selalu di bawah nominal ketika ada inflasi', () => {
    const points = series(36, 1_000_000);
    const nominal = 25;
    const result = realMetrics(points, 1_000_000, 45_000_000, deflators, nominal);
    expect(result?.realTotalReturnPct).toBeLessThan(nominal);
    expect(result?.inflationDragPct).toBeGreaterThan(0);
  });

  it('tanpa inflasi, riil sama dengan nominal', () => {
    const flat = buildDeflators(
      interpolateMonthlyCpi(
        [
          { year: 2020, value: 100 },
          { year: 2023, value: 100 },
        ],
        '2020-07',
        '2023-07',
      ),
      '2023-07',
    );
    const points = series(12, 1_000_000);
    const result = realMetrics(points, 1_000_000, 15_000_000, flat, 25);
    expect(result?.realTotalInvested).toBeCloseTo(12_000_000, 6);
    expect(result?.realTotalReturnPct).toBeCloseTo(25, 6);
    expect(result?.inflationDragPct).toBeCloseTo(0, 6);
  });

  it('menghasilkan XIRR riil yang lebih rendah dari XIRR nominal', () => {
    const points = series(36, 1_000_000);
    const result = realMetrics(points, 1_000_000, 50_000_000, deflators, 38.9);
    expect(result?.realXirr).not.toBeNull();
    expect(result?.realXirr as number).toBeLessThan(0.25);
  });

  it('bulan tanpa data deflator diperlakukan sebagai faktor satu, bukan nol', () => {
    // Faktor nol akan membuat setoran itu seolah tidak pernah terjadi.
    const points: DcaSeriesPoint[] = [{ m: '1990-01', invested: 1_000_000, value: 1_000_000 }];
    const result = realMetrics(points, 1_000_000, 1_000_000, deflators, 0);
    expect(result?.realTotalInvested).toBe(1_000_000);
  });

  it('menolak masukan yang tidak bisa dihitung', () => {
    expect(realMetrics([], 1_000_000, 1_000_000, deflators, 0)).toBeNull();
    expect(realMetrics(series(12, 1_000_000), 0, 1_000_000, deflators, 0)).toBeNull();
  });
});
