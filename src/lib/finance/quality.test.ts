import { describe, expect, it } from 'vitest';

import {
  dividendSustainability,
  earningsYield,
  freeCashflowYield,
  qualityChecks,
  scoreQuality,
} from './value.ts';
import type { FinancialHistory } from './value.ts';

/** Yahoo mengirim deret terbaru-dulu; helper ini meniru urutan itu. */
const series = (...values: number[]) => values.map((value, i) => ({ endDate: 1_700_000_000 - i * 31_536_000, value }));

const signalOf = (history: FinancialHistory, key: string) =>
  qualityChecks(history).find((c) => c.key === key)?.signal;

describe('qualityChecks', () => {
  it('menandai perusahaan yang laba dan tumbuh sebagai lulus', () => {
    // Terbaru-dulu: 300 tahun ini, 200 tahun lalu, 100 dua tahun lalu.
    const history: FinancialHistory = {
      netIncome: series(300, 200, 100),
      revenue: series(1500, 1200, 1000),
      equity: series(900, 800, 700),
      freeCashflow: series(400, 260, 150),
    };
    expect(signalOf(history, 'profitable')).toBe('pass');
    expect(signalOf(history, 'earningsGrowing')).toBe('pass');
    expect(signalOf(history, 'revenueGrowing')).toBe('pass');
    expect(signalOf(history, 'equityGrowing')).toBe('pass');
  });

  it('membaca arah tren dengan benar meski datanya terbaru-dulu', () => {
    // Kesalahan urutan akan membalik SETIAP penilaian tren tanpa gejala apa pun.
    const menurun: FinancialHistory = { netIncome: series(100, 200, 300) };
    expect(signalOf(menurun, 'earningsGrowing')).toBe('fail');

    const menanjak: FinancialHistory = { netIncome: series(300, 200, 100) };
    expect(signalOf(menanjak, 'earningsGrowing')).toBe('pass');
  });

  it('menangkap laba yang tidak didukung arus kas', () => {
    // Tanda peringatan klasik: laba diakui di pembukuan sebelum uangnya diterima.
    const history: FinancialHistory = {
      netIncome: series(500, 400),
      freeCashflow: series(120, 380),
    };
    expect(signalOf(history, 'cashBacked')).toBe('fail');
    const detail = qualityChecks(history).find((c) => c.key === 'cashBacked')?.detail;
    expect(detail).toContain('0.24');
  });

  it('arus kas melebihi laba dihitung lulus', () => {
    const history: FinancialHistory = {
      netIncome: series(400, 300),
      freeCashflow: series(700, 500),
    };
    expect(signalOf(history, 'cashBacked')).toBe('pass');
  });

  it('perusahaan merugi ditandai gagal, bukan tidak diketahui', () => {
    expect(signalOf({ netIncome: series(-50, -20) }, 'profitable')).toBe('fail');
  });

  it('data yang tidak ada menghasilkan unknown, bukan tebakan', () => {
    const kosong = qualityChecks({});
    expect(kosong).toHaveLength(5);
    expect(kosong.every((c) => c.signal === 'unknown')).toBe(true);
    expect(kosong.every((c) => c.detail === null)).toBe(true);
  });

  it('satu tahun data tidak cukup untuk menilai tren', () => {
    const history: FinancialHistory = { netIncome: series(300) };
    expect(signalOf(history, 'profitable')).toBe('pass');
    expect(signalOf(history, 'earningsGrowing')).toBe('unknown');
  });

  it('mengabaikan titik yang nilainya tidak sah', () => {
    const history: FinancialHistory = {
      netIncome: [{ endDate: 1, value: Number.NaN }, ...series(300, 100)],
    };
    expect(signalOf(history, 'earningsGrowing')).toBe('pass');
  });
});

describe('scoreQuality', () => {
  it('menghitung lulus terhadap yang benar-benar diketahui', () => {
    const history: FinancialHistory = {
      netIncome: series(300, 200),
      revenue: series(1500, 1000),
      freeCashflow: series(400, 250),
    };
    const score = scoreQuality(qualityChecks(history));
    expect(score.total).toBe(5);
    expect(score.known).toBe(4);
    expect(score.passed).toBe(4);
  });

  it('yang tidak diketahui TIDAK dihitung sebagai lulus', () => {
    // Kalau tidak, perusahaan tanpa data apa pun akan tampak sempurna.
    const score = scoreQuality(qualityChecks({}));
    expect(score.passed).toBe(0);
    expect(score.known).toBe(0);
  });
});

describe('earningsYield', () => {
  it('adalah kebalikan P/E', () => {
    expect(earningsYield(20) as number).toBeCloseTo(0.05, 9);
    expect(earningsYield(6.7) as number).toBeCloseTo(0.1493, 4);
  });

  it('perusahaan merugi tidak punya earnings yield', () => {
    expect(earningsYield(-10)).toBeNull();
    expect(earningsYield(0)).toBeNull();
    expect(earningsYield(null)).toBeNull();
  });
});

describe('freeCashflowYield', () => {
  it('membagi arus kas bebas dengan kapitalisasi pasar', () => {
    expect(freeCashflowYield(50, 1000) as number).toBeCloseTo(0.05, 9);
  });

  it('arus kas negatif menghasilkan yield negatif, bukan null', () => {
    // Perusahaan yang membakar uang adalah informasi, bukan ketiadaan data.
    expect(freeCashflowYield(-30, 1000) as number).toBeCloseTo(-0.03, 9);
  });

  it('menolak kapitalisasi yang tidak sah', () => {
    expect(freeCashflowYield(50, 0)).toBeNull();
    expect(freeCashflowYield(50, null)).toBeNull();
    expect(freeCashflowYield(null, 1000)).toBeNull();
  });
});

describe('dividendSustainability', () => {
  it('payout di bawah 80% dianggap kuat', () => {
    expect(dividendSustainability(0.4)).toBe('strong');
    expect(dividendSustainability(0.79)).toBe('strong');
  });

  it('payout mendekati seluruh laba dianggap rentan', () => {
    expect(dividendSustainability(0.9)).toBe('fair');
  });

  it('membagikan lebih dari yang dihasilkan dianggap lemah', () => {
    // Bisa berlanjut sebentar, tidak bisa berlanjut selamanya.
    expect(dividendSustainability(1.4)).toBe('weak');
  });

  it('tanpa data hasilnya unknown', () => {
    expect(dividendSustainability(null)).toBe('unknown');
    expect(dividendSustainability(-0.2)).toBe('unknown');
  });
});
