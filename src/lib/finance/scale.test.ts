import { describe, expect, it } from 'vitest';

import { simulateDca } from './dca.ts';
import { addMonths } from './months.ts';
import { scaleFactor, scaleMoneyFields } from './scale.ts';
import type { PricePoint } from './types.ts';

const growing = (months: number): PricePoint[] =>
  Array.from({ length: months }, (_, i) => ({ m: addMonths('2020-01', i), c: 100 * 1.01 ** i }));

describe('scaleFactor', () => {
  it('menghitung rasio setoran pengguna terhadap setoran dasar', () => {
    expect(scaleFactor(2_000_000, 1_000_000)).toBe(2);
    expect(scaleFactor(500_000, 1_000_000)).toBe(0.5);
    expect(scaleFactor(1_000_000, 1_000_000)).toBe(1);
  });

  it('jatuh ke 1 untuk masukan yang tidak masuk akal', () => {
    // Kolom input yang sedang dikosongkan tidak boleh membuat seluruh layar
    // menampilkan nol atau tak hingga.
    expect(scaleFactor(0, 1_000_000)).toBe(1);
    expect(scaleFactor(-5, 1_000_000)).toBe(1);
    expect(scaleFactor(null, 1_000_000)).toBe(1);
    expect(scaleFactor(Number.NaN, 1_000_000)).toBe(1);
    expect(scaleFactor(1_000_000, 0)).toBe(1);
  });
});

describe('scaleMoneyFields', () => {
  const sample = {
    contribution: 1_000_000,
    totalInvested: 120_000_000,
    currentValue: 300_000_000,
    units: 42,
    realTotalInvested: 135_000_000,
    totalReturnPct: 150,
    multiple: 2.5,
    xirr: 0.18,
    volatility: 0.33,
    maxDrawdown: -0.42,
    partial: false,
    from: '2016-09',
  };

  it('mengalikan hanya bidang yang berupa jumlah uang', () => {
    const scaled = scaleMoneyFields(sample, 2);
    expect(scaled.totalInvested).toBe(240_000_000);
    expect(scaled.currentValue).toBe(600_000_000);
    expect(scaled.contribution).toBe(2_000_000);
    expect(scaled.units).toBe(84);
    expect(scaled.realTotalInvested).toBe(270_000_000);
  });

  it('TIDAK menyentuh rasio dan persentase', () => {
    // Inti dari fungsi ini. Return 150% tetap 150% baik setoran Rp500 ribu maupun
    // Rp5 juta; mengalikannya menghasilkan angka yang terlihat wajar tapi salah.
    const scaled = scaleMoneyFields(sample, 5);
    expect(scaled.totalReturnPct).toBe(150);
    expect(scaled.multiple).toBe(2.5);
    expect(scaled.xirr).toBe(0.18);
    expect(scaled.volatility).toBe(0.33);
    expect(scaled.maxDrawdown).toBe(-0.42);
  });

  it('membiarkan bidang non-angka apa adanya', () => {
    const scaled = scaleMoneyFields(sample, 3);
    expect(scaled.partial).toBe(false);
    expect(scaled.from).toBe('2016-09');
  });

  it('mengembalikan objek asli saat faktornya 1 atau tidak sah', () => {
    expect(scaleMoneyFields(sample, 1)).toBe(sample);
    expect(scaleMoneyFields(sample, 0)).toBe(sample);
    expect(scaleMoneyFields(sample, Number.NaN)).toBe(sample);
  });

  it('tidak mengubah objek masukan', () => {
    const snapshot = structuredClone(sample);
    scaleMoneyFields(sample, 4);
    expect(sample).toEqual(snapshot);
  });

  it('aman untuk bidang uang yang bernilai null', () => {
    const withNulls = { ...sample, realTotalInvested: null, xirr: null };
    const scaled = scaleMoneyFields(withNulls, 2);
    expect(scaled.realTotalInvested).toBeNull();
    expect(scaled.xirr).toBeNull();
  });
});

describe('penskalaan cocok dengan simulasi sesungguhnya', () => {
  it('hasil skala identik dengan menghitung ulang pada setoran baru', () => {
    // Pembuktian bahwa jalan pintas ini eksak, bukan hampiran: menskalakan hasil
    // Rp1 juta harus sama persis dengan menjalankan simulasi pada Rp2,5 juta.
    const prices = growing(60);
    const base = simulateDca({ prices, contribution: 1_000_000 })!;
    const direct = simulateDca({ prices, contribution: 2_500_000 })!;
    const scaled = scaleMoneyFields(base, 2.5);

    expect(scaled.totalInvested).toBeCloseTo(direct.totalInvested, 6);
    expect(scaled.currentValue).toBeCloseTo(direct.currentValue, 4);
    expect(scaled.units).toBeCloseTo(direct.units, 8);
    // Dan metrik rasio memang benar-benar tidak bergeser.
    expect(base.totalReturnPct).toBeCloseTo(direct.totalReturnPct, 9);
    expect(base.xirr as number).toBeCloseTo(direct.xirr as number, 9);
    expect(base.multiple).toBeCloseTo(direct.multiple, 9);
  });
});
