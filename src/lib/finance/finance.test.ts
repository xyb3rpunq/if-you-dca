import { describe, expect, it } from 'vitest';

import { annualize, cagr, compoundInterest, monthlyRate, multiple, ruleOf72, totalReturnPct } from './basic.ts';
import { combinePortfolio, convertSeries, simulateDca } from './dca.ts';
import { addMonths, currentMonth, fromMonthIndex, monthIndex, monthsBetween, monthToDate } from './months.ts';
import {
  annualizedVolatility,
  beta,
  correlation,
  covariance,
  jensensAlpha,
  maxDrawdown,
  mean,
  monthlyReturns,
  sharpeRatio,
  sortinoRatio,
  stdev,
} from './risk.ts';
import type { PricePoint } from './types.ts';
import { assessFundamentals, grahamNumber, marginOfSafety, simplifiedDcf, summarizeVerdict } from './value.ts';
import { xirr, xnpv } from './xirr.ts';

/** Deret harga konstan sepanjang n bulan mulai dari `start`. */
function flatSeries(start: string, months: number, price: number): PricePoint[] {
  return Array.from({ length: months }, (_, i) => ({ m: addMonths(start, i), c: price }));
}

/** Deret yang tumbuh dengan laju tetap tiap bulan. */
function growingSeries(start: string, months: number, first: number, monthlyGrowth: number): PricePoint[] {
  return Array.from({ length: months }, (_, i) => ({
    m: addMonths(start, i),
    c: first * (1 + monthlyGrowth) ** i,
  }));
}

describe('aritmetika bulan', () => {
  it('menambah dan mengurangi bulan melintasi pergantian tahun', () => {
    expect(addMonths('2024-11', 3)).toBe('2025-02');
    expect(addMonths('2024-02', -3)).toBe('2023-11');
    expect(addMonths('2024-01', 0)).toBe('2024-01');
  });

  it('menangani lompatan bertahun-tahun di kedua arah', () => {
    expect(addMonths('2020-06', 120)).toBe('2030-06');
    expect(addMonths('2020-06', -120)).toBe('2010-06');
    expect(addMonths('2024-12', 1)).toBe('2025-01');
    expect(addMonths('2024-01', -1)).toBe('2023-12');
  });

  it('menghitung jarak bulan', () => {
    expect(monthsBetween('2020-01', '2020-04')).toBe(3);
    expect(monthsBetween('2020-01', '2030-01')).toBe(120);
    expect(monthsBetween('2020-04', '2020-01')).toBe(-3);
    expect(monthsBetween('2020-01', '2020-01')).toBe(0);
  });

  it('monthIndex dan fromMonthIndex saling membalik', () => {
    for (const key of ['1999-01', '2020-06', '2026-08', '2030-12']) {
      expect(fromMonthIndex(monthIndex(key))).toBe(key);
    }
    // Januari adalah indeks 0 dalam tahunnya, jadi selisih 12 tepat satu tahun.
    expect(monthIndex('2021-01') - monthIndex('2020-01')).toBe(12);
  });

  it('fromMonthIndex memberi nol di depan untuk bulan satu digit', () => {
    expect(fromMonthIndex(monthIndex('2024-03'))).toBe('2024-03');
    expect(fromMonthIndex(monthIndex('2024-09'))).toBe('2024-09');
  });

  it('memetakan bulan ke tanggal 1 UTC', () => {
    expect(monthToDate('2024-03').toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(monthToDate('2024-12').toISOString()).toBe('2024-12-01T00:00:00.000Z');
  });

  it('currentMonth memakai UTC, bukan zona waktu lokal', () => {
    // Tengah malam WIB tanggal 1 masih tanggal 30 di UTC. Kunci bulan harus
    // konsisten dengan deret harga yang seluruhnya berbasis UTC.
    expect(currentMonth(new Date('2026-08-10T02:00:00Z'))).toBe('2026-08');
    expect(currentMonth(new Date('2026-08-31T23:59:59Z'))).toBe('2026-08');
    expect(currentMonth(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09');
  });
});

describe('rumus dasar', () => {
  it('total return dan multiple', () => {
    expect(totalReturnPct(1000, 1500)).toBeCloseTo(50, 10);
    expect(totalReturnPct(1000, 500)).toBeCloseTo(-50, 10);
    expect(multiple(1000, 2500)).toBeCloseTo(2.5, 10);
  });

  it('CAGR uang berlipat dua dalam 10 tahun ≈ 7,18%', () => {
    expect(cagr(100, 200, 10)).toBeCloseTo(0.0717735, 6);
  });

  it('CAGR menolak input yang tidak masuk akal', () => {
    expect(cagr(0, 200, 10)).toBeNull();
    expect(cagr(100, 200, 0)).toBeNull();
  });

  it('bunga majemuk cocok dengan hitungan manual', () => {
    // 1.000.000 pada 12%/tahun, majemuk bulanan, 5 tahun.
    expect(compoundInterest(1_000_000, 0.12, 12, 5)).toBeCloseTo(1_816_696.699, 2);
  });

  it('rule of 72', () => {
    expect(ruleOf72(8)).toBeCloseTo(9, 10);
    expect(ruleOf72(0)).toBeNull();
  });

  it('annualize membalik pertumbuhan total jadi laju tahunan', () => {
    expect(annualize(2, 10)).toBeCloseTo(0.0717735, 6);
    expect(annualize(0, 10)).toBeNull();
    expect(annualize(2, 0)).toBeNull();
  });

  it('monthlyRate memajemukkan ke laju tahunan yang sama persis', () => {
    // 12 bulan pada laju bulanan hasil konversi harus kembali ke 12% setahun,
    // bukan sekadar 12/12 = 1% yang mengabaikan efek majemuk.
    const monthly = monthlyRate(0.12);
    expect((1 + monthly) ** 12 - 1).toBeCloseTo(0.12, 12);
    expect(monthly).toBeLessThan(0.01);
    expect(monthlyRate(0)).toBeCloseTo(0, 12);
  });

  it('compoundInterest tanpa pemajemukan mengembalikan pokoknya', () => {
    expect(compoundInterest(1000, 0.1, 0, 5)).toBe(1000);
  });
});

describe('XIRR', () => {
  it('satu setoran, satu penarikan setahun kemudian = 10%', () => {
    const rate = xirr([
      { when: new Date('2021-01-01T00:00:00Z'), amount: -1000 },
      { when: new Date('2022-01-01T00:00:00Z'), amount: 1100 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeCloseTo(0.1, 6);
  });

  it('NPV pada laju hasil XIRR mendekati nol', () => {
    const flows = [
      { when: new Date('2020-01-01T00:00:00Z'), amount: -5000 },
      { when: new Date('2021-06-15T00:00:00Z'), amount: -2500 },
      { when: new Date('2024-03-01T00:00:00Z'), amount: 11000 },
    ];
    const rate = xirr(flows) as number;
    expect(rate).not.toBeNull();
    expect(Math.abs(xnpv(rate, flows))).toBeLessThan(1e-4);
  });

  it('DCA yang berakhir persis di modal memberi return ~0%', () => {
    const flows = Array.from({ length: 12 }, (_, i) => ({
      when: monthToDate(addMonths('2023-01', i)),
      amount: -100,
    }));
    flows.push({ when: monthToDate('2023-12'), amount: 1200 });
    expect(xirr(flows) as number).toBeCloseTo(0, 6);
  });

  it('membedakan XIRR dari total return saat durasinya berbeda', () => {
    // Dua skenario dengan total return persis sama (+20%), tapi satu butuh 1 tahun
    // dan satunya 4 tahun. Total return tidak bisa membedakan; XIRR bisa.
    const cepat = xirr([
      { when: new Date('2021-01-01T00:00:00Z'), amount: -1000 },
      { when: new Date('2022-01-01T00:00:00Z'), amount: 1200 },
    ]) as number;
    const lambat = xirr([
      { when: new Date('2018-01-01T00:00:00Z'), amount: -1000 },
      { when: new Date('2022-01-01T00:00:00Z'), amount: 1200 },
    ]) as number;
    expect(cepat).toBeCloseTo(0.2, 4);
    expect(lambat).toBeLessThan(0.05);
    expect(cepat).toBeGreaterThan(lambat);
  });

  it('mengembalikan null kalau semua arus kas searah', () => {
    expect(
      xirr([
        { when: new Date('2021-01-01T00:00:00Z'), amount: -100 },
        { when: new Date('2022-01-01T00:00:00Z'), amount: -100 },
      ]),
    ).toBeNull();
  });

  it('menangani kerugian besar tanpa meledak', () => {
    const rate = xirr([
      { when: new Date('2021-01-01T00:00:00Z'), amount: -1000 },
      { when: new Date('2022-01-01T00:00:00Z'), amount: 10 },
    ]) as number;
    expect(rate).toBeLessThan(-0.98);
    expect(Number.isFinite(rate)).toBe(true);
  });
});

describe('ukuran risiko', () => {
  it('mean menghitung rata-rata dan aman untuk array kosong', () => {
    expect(mean([2, 4, 6])).toBeCloseTo(4, 12);
    expect(mean([-1, 1])).toBeCloseTo(0, 12);
    expect(mean([])).toBe(0);
  });

  it('covariance nol untuk deret yang tidak berhubungan sama sekali', () => {
    const flat = [0.01, 0.01, 0.01, 0.01];
    expect(covariance(flat, [0.02, -0.01, 0.03, 0.005]) as number).toBeCloseTo(0, 12);
    expect(covariance([1], [1])).toBeNull();
  });

  it('covariance menyelaraskan panjang deret dari ujung terbaru', () => {
    // Aset yang baru listing punya deret lebih pendek; yang dibandingkan harus
    // bulan-bulan yang sama, jadi kelebihan data lama dipotong dari depan.
    const short = [0.01, -0.02, 0.03];
    const long = [0.99, 0.99, 0.01, -0.02, 0.03];
    expect(covariance(short, long) as number).toBeCloseTo(covariance(short, short) as number, 12);
  });

  it('stdev sampel cocok dengan hitungan tangan', () => {
    // Rata-rata 4, deviasi kuadrat 4+1+0+1+4 = 10, dibagi n−1 = 4, akar = 1,5811
    expect(stdev([2, 3, 4, 5, 6]) as number).toBeCloseTo(1.5811388, 6);
    expect(stdev([1])).toBeNull();
  });

  it('volatilitas tahunan = stdev bulanan × √12', () => {
    const returns = [0.02, -0.01, 0.03, -0.02, 0.01, 0.0];
    const sd = stdev(returns) as number;
    expect(annualizedVolatility(returns) as number).toBeCloseTo(sd * Math.sqrt(12), 10);
  });

  it('deret yang naik terus tidak punya drawdown', () => {
    expect(maxDrawdown([100, 110, 120, 130]) as number).toBeCloseTo(0, 10);
  });

  it('max drawdown mengambil jurang terdalam, bukan yang terakhir', () => {
    // Puncak 100 → dasar 50 (−50%), lalu pulih ke 120 → turun ke 90 (−25%).
    expect(maxDrawdown([100, 50, 120, 90]) as number).toBeCloseTo(-0.5, 10);
  });

  it('return bulanan dihitung dari deret harga', () => {
    const r = monthlyReturns([
      { m: '2024-01', c: 100 },
      { m: '2024-02', c: 110 },
      { m: '2024-03', c: 99 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0] as number).toBeCloseTo(0.1, 10);
    expect(r[1] as number).toBeCloseTo(-0.1, 10);
  });

  it('beta terhadap dirinya sendiri = 1, terhadap dua kali lipatnya = 2', () => {
    const market = [0.01, -0.02, 0.03, 0.005, -0.01, 0.02];
    const leveraged = market.map((r) => r * 2);
    expect(beta(market, market) as number).toBeCloseTo(1, 10);
    expect(beta(leveraged, market) as number).toBeCloseTo(2, 10);
  });

  it('korelasi = 1 untuk deret identik dan −1 untuk kebalikannya', () => {
    const a = [0.01, -0.02, 0.03, 0.005, -0.01];
    expect(correlation(a, a) as number).toBeCloseTo(1, 10);
    expect(correlation(a, a.map((x) => -x)) as number).toBeCloseTo(-1, 10);
  });

  it('alpha nol saat aset persis mengikuti pasar', () => {
    const market = [0.01, -0.02, 0.03, 0.005, -0.01, 0.02];
    expect(jensensAlpha(market, market, 0.04) as number).toBeCloseTo(0, 10);
  });

  it('Sortino lebih tinggi dari Sharpe saat gejolaknya condong ke atas', () => {
    // Satu bulan melonjak +30%, sisanya bergerak wajar. Sharpe menghukum lonjakan
    // itu sebagai "risiko"; Sortino tidak, karena hanya menghitung sisi turun.
    const returns = [0.01, -0.02, 0.3, 0.005, -0.01, 0.012, 0.008, 0.011];
    const sharpe = sharpeRatio(returns, 0.04) as number;
    const sortino = sortinoRatio(returns, 0.04) as number;
    expect(sortino).toBeGreaterThan(sharpe);
  });

  it('Sortino null kalau tidak pernah turun di bawah target — bukan angka palsu', () => {
    const selaluNaik = [0.01, 0.012, 0.008, 0.011, 0.009, 0.01];
    expect(sortinoRatio(selaluNaik, 0.04)).toBeNull();
  });
});

describe('xnpv secara langsung', () => {
  const flows = [
    { when: new Date('2021-01-01T00:00:00Z'), amount: -1000 },
    { when: new Date('2022-01-01T00:00:00Z'), amount: 1100 },
  ];

  it('nol tepat pada laju yang benar', () => {
    expect(xnpv(0.1, flows)).toBeCloseTo(0, 9);
  });

  it('menurun secara monoton terhadap laju diskonto', () => {
    // Sifat inilah yang membuat pencarian akar dengan bisection dijamin bertemu.
    expect(xnpv(0, flows)).toBeCloseTo(100, 9);
    expect(xnpv(0.2, flows)).toBeCloseTo(-83.3333, 4);
    expect(xnpv(0, flows)).toBeGreaterThan(xnpv(0.1, flows));
    expect(xnpv(0.1, flows)).toBeGreaterThan(xnpv(0.2, flows));
  });

  it('arus kas tunggal tidak terdiskonto sama sekali', () => {
    expect(xnpv(0.5, [{ when: new Date('2021-01-01T00:00:00Z'), amount: -1000 }])).toBe(-1000);
  });

  it('deret kosong bernilai nol, laju ≤ −100% bernilai NaN', () => {
    expect(xnpv(0.1, [])).toBe(0);
    expect(Number.isNaN(xnpv(-1, flows))).toBe(true);
    expect(Number.isNaN(xnpv(-2, flows))).toBe(true);
  });
});

describe('Sharpe & Alpha dengan angka yang bisa dihitung tangan', () => {
  const returns = [0.02, -0.01, 0.03, -0.02, 0.01, 0.0];

  it('Sharpe cocok dengan hitungan manual', () => {
    // rata-rata 0,005; stdev sampel 0,0187083; bebas risiko bulanan 0,00327374
    // ⇒ (0,005 − 0,00327374) / 0,0187083 × √12 = 0,31963
    expect(sharpeRatio(returns, 0.04) as number).toBeCloseTo(0.3196, 3);
  });

  it('Sharpe null saat tidak ada gejolak sama sekali', () => {
    // Pembaginya nol. Mengembalikan angka tak hingga akan tampak seperti aset
    // sempurna, padahal artinya rasio itu tidak terdefinisi.
    expect(sharpeRatio([0.01, 0.01, 0.01, 0.01], 0.04)).toBeNull();
    expect(sharpeRatio([0.01], 0.04)).toBeNull();
  });

  it('Alpha menangkap kelebihan tetap di atas pasar', () => {
    // Aset persis mengikuti pasar plus 0,5% tiap bulan ⇒ beta 1, alpha bulanan
    // 0,5%, disetahunkan 1,005^12 − 1 = 6,168%.
    const market = [0.01, 0.02, -0.01, 0.03];
    const asset = market.map((r) => r + 0.005);
    expect(beta(asset, market) as number).toBeCloseTo(1, 9);
    expect(jensensAlpha(asset, market, 0.04) as number).toBeCloseTo(0.061678, 5);
  });

  it('Alpha negatif untuk aset yang tertinggal dari pasar', () => {
    const market = [0.01, 0.02, -0.01, 0.03];
    const asset = market.map((r) => r - 0.004);
    expect(jensensAlpha(asset, market, 0.04) as number).toBeLessThan(0);
  });
});

describe('volatilitas, return bulanan, dan korelasi — kasus batas', () => {
  it('volatilitas tahunan bernilai tepat 20% untuk gejolak ±5% bergantian', () => {
    // stdev sampel = 0,0577350; ×√12 = 0,2 persis.
    expect(annualizedVolatility([0.05, -0.05, 0.05, -0.05]) as number).toBeCloseTo(0.2, 9);
  });

  it('volatilitas null kalau titiknya kurang dari dua', () => {
    expect(annualizedVolatility([])).toBeNull();
    expect(annualizedVolatility([0.05])).toBeNull();
  });

  it('monthlyReturns melewati pasangan yang harga sebelumnya tidak sah', () => {
    // Harga nol seharusnya sudah dibersihkan sanitizeMonthly sebelum sampai sini;
    // ini memastikan lapisan ini pun tidak menghasilkan pembagian dengan nol.
    const r = monthlyReturns([
      { m: '2024-01', c: 100 },
      { m: '2024-02', c: 0 },
      { m: '2024-03', c: 50 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0] as number).toBeCloseTo(-1, 9);
    expect(r.every((x) => Number.isFinite(x))).toBe(true);
  });

  it('monthlyReturns pada deret kosong atau satu titik menghasilkan kosong', () => {
    expect(monthlyReturns([])).toEqual([]);
    expect(monthlyReturns([{ m: '2024-01', c: 100 }])).toEqual([]);
  });

  it('korelasi menyelaraskan panjang deret dari ujung terbaru', () => {
    // Aset yang baru listing punya deret lebih pendek; bulan yang dibandingkan
    // harus sama, jadi kelebihan data lama dipotong dari depan.
    const pendek = [0.01, 0.02, 0.03];
    const panjang = [0.9, 0.01, 0.02, 0.03];
    expect(correlation(pendek, panjang) as number).toBeCloseTo(1, 9);
  });

  it('korelasi null saat salah satu deret datar', () => {
    expect(correlation([0.01, 0.01, 0.01], [0.01, 0.02, 0.03])).toBeNull();
  });

  it('max drawdown mengabaikan nilai tidak hingga alih-alih rusak', () => {
    expect(maxDrawdown([100, Number.NaN, 50]) as number).toBeCloseTo(-0.5, 9);
    expect(maxDrawdown([100])).toBeNull();
  });
});

describe('convertSeries — kasus batas kurs', () => {
  const usd = [
    { m: '2024-01', c: 100 },
    { m: '2024-02', c: 100 },
  ];

  it('tanpa kurs, deret dikembalikan apa adanya', () => {
    expect(convertSeries(usd, null).map((p) => p.c)).toEqual([100, 100]);
    expect(convertSeries(usd, []).map((p) => p.c)).toEqual([100, 100]);
  });

  it('kurs yang seluruhnya setelah rentang harga memakai kurs paling awal', () => {
    // Tanpa aturan ini, aset yang riwayatnya lebih panjang dari data kurs akan
    // kehilangan seluruh bulan awalnya secara diam-diam.
    const fx = [{ m: '2025-01', c: 16_000 }];
    expect(convertSeries(usd, fx).map((p) => p.c)).toEqual([1_600_000, 1_600_000]);
  });

  it('kurs nol atau negatif diabaikan, bukan dipakai', () => {
    const fx = [
      { m: '2024-01', c: 15_000 },
      { m: '2024-02', c: 0 },
    ];
    expect(convertSeries(usd, fx).map((p) => p.c)).toEqual([1_500_000, 1_500_000]);
  });

  it('tidak mengubah array masukan', () => {
    const snapshot = structuredClone(usd);
    convertSeries(usd, [{ m: '2024-01', c: 15_000 }]);
    expect(usd).toEqual(snapshot);
  });
});

describe('simulasi DCA', () => {
  it('harga datar: nilai akhir = total setoran, return 0%', () => {
    const result = simulateDca({ prices: flatSeries('2020-01', 24, 100), contribution: 900_000 });
    expect(result).not.toBeNull();
    const r = result!;
    expect(r.months).toBe(24);
    expect(r.totalInvested).toBe(24 * 900_000);
    expect(r.currentValue).toBeCloseTo(24 * 900_000, 6);
    expect(r.multiple).toBeCloseTo(1, 10);
    expect(r.totalReturnPct).toBeCloseTo(0, 10);
    expect(r.xirr as number).toBeCloseTo(0, 6);
  });

  it('unit terkumpul cocok dengan penjumlahan manual', () => {
    const prices: PricePoint[] = [
      { m: '2024-01', c: 100 },
      { m: '2024-02', c: 50 },
      { m: '2024-03', c: 200 },
    ];
    const r = simulateDca({ prices, contribution: 1000 })!;
    // 1000/100 + 1000/50 + 1000/200 = 10 + 20 + 5 = 35 unit
    expect(r.units).toBeCloseTo(35, 10);
    expect(r.currentValue).toBeCloseTo(35 * 200, 10);
    expect(r.totalInvested).toBe(3000);
  });

  it('DCA menghasilkan harga rata-rata di bawah rata-rata aritmetik harga', () => {
    // Inti matematis DCA: setoran tetap membeli lebih banyak unit saat murah,
    // jadi harga rata-rata yang didapat selalu ≤ rata-rata harganya (rata-rata harmonik).
    const prices: PricePoint[] = [
      { m: '2024-01', c: 100 },
      { m: '2024-02', c: 50 },
      { m: '2024-03', c: 150 },
      { m: '2024-04', c: 80 },
    ];
    const r = simulateDca({ prices, contribution: 1000 })!;
    const hargaRataDidapat = r.totalInvested / r.units;
    const rataAritmetik = (100 + 50 + 150 + 80) / 4;
    expect(hargaRataDidapat).toBeLessThan(rataAritmetik);
  });

  it('XIRR DCA lebih tinggi dari total return saat aset naik konsisten', () => {
    // Uang yang disetor bulan lalu belum sempat tumbuh setahun, jadi return
    // tahunan yang sebenarnya lebih tinggi daripada yang disiratkan total return.
    const r = simulateDca({ prices: growingSeries('2019-01', 60, 100, 0.01), contribution: 900_000 })!;
    const totalReturnTahunanNaif = r.totalReturnPct / 100 / (r.months / 12);
    expect(r.xirr as number).toBeGreaterThan(totalReturnTahunanNaif);
    // Aset tumbuh 1%/bulan ⇒ TWR ≈ 12,68%/tahun
    expect(r.twr as number).toBeCloseTo(1.01 ** 12 - 1, 6);
  });

  it('menghormati rentang from/to dan menandai data parsial', () => {
    const prices = flatSeries('2022-01', 36, 100);
    const r = simulateDca({ prices, contribution: 1000, from: '2022-06', to: '2022-12' })!;
    expect(r.from).toBe('2022-06');
    expect(r.to).toBe('2022-12');
    expect(r.months).toBe(7);
    expect(r.partial).toBe(false);

    const parsial = simulateDca({ prices, contribution: 1000, from: '2015-01' })!;
    expect(parsial.partial).toBe(true);
    expect(parsial.from).toBe('2022-01');
  });

  it('menolak input yang tidak bisa disimulasikan', () => {
    expect(simulateDca({ prices: flatSeries('2020-01', 12, 100), contribution: 0 })).toBeNull();
    expect(simulateDca({ prices: [{ m: '2020-01', c: 100 }], contribution: 1000 })).toBeNull();
    expect(simulateDca({ prices: [], contribution: 1000 })).toBeNull();
  });

  it('mengabaikan harga nol atau negatif alih-alih menghasilkan unit tak hingga', () => {
    const prices: PricePoint[] = [
      { m: '2024-01', c: 100 },
      { m: '2024-02', c: 0 },
      { m: '2024-03', c: 100 },
    ];
    const r = simulateDca({ prices, contribution: 1000 })!;
    expect(r.months).toBe(2);
    expect(Number.isFinite(r.units)).toBe(true);
    expect(r.units).toBeCloseTo(20, 10);
  });

  it('konversi kurs ikut menghitung untung/rugi nilai tukar', () => {
    const usd = flatSeries('2024-01', 3, 100);
    const fx: PricePoint[] = [
      { m: '2024-01', c: 15_000 },
      { m: '2024-02', c: 15_000 },
      { m: '2024-03', c: 16_500 },
    ];
    const converted = convertSeries(usd, fx);
    expect(converted[0]?.c).toBe(1_500_000);
    expect(converted[2]?.c).toBe(1_650_000);

    // Harga aset tidak bergerak sama sekali, tapi rupiah melemah 10% di bulan
    // terakhir — investor rupiah tetap untung, dan simulasi harus menunjukkannya.
    const r = simulateDca({ prices: usd, fx, contribution: 900_000 })!;
    expect(r.totalReturnPct).toBeGreaterThan(0);
  });

  it('kurs yang bolong memakai kurs terakhir yang diketahui', () => {
    const usd = flatSeries('2024-01', 3, 100);
    const fx: PricePoint[] = [
      { m: '2024-01', c: 15_000 },
      { m: '2024-03', c: 16_000 },
    ];
    const converted = convertSeries(usd, fx);
    expect(converted[1]?.c).toBe(1_500_000);
    expect(converted[2]?.c).toBe(1_600_000);
  });

  it('beta terhadap benchmark dirinya sendiri = 1', () => {
    const prices = growingSeries('2020-01', 36, 100, 0.008);
    const r = simulateDca({ prices, contribution: 1000, benchmark: prices })!;
    expect(r.beta as number).toBeCloseTo(1, 6);
    expect(r.alpha as number).toBeCloseTo(0, 6);
  });
});

describe('portofolio gabungan', () => {
  it('menjumlahkan setoran dan nilai antar aset', () => {
    const a = simulateDca({ prices: flatSeries('2024-01', 12, 100), contribution: 900_000 })!;
    const b = simulateDca({ prices: growingSeries('2024-01', 12, 50, 0.02), contribution: 900_000 })!;
    const combined = combinePortfolio([
      { id: 'a', result: a },
      { id: 'b', result: b },
    ])!;
    expect(combined.totalInvested).toBe(a.totalInvested + b.totalInvested);
    expect(combined.currentValue).toBeCloseTo(a.currentValue + b.currentValue, 6);
    expect(combined.series).toHaveLength(12);
  });

  it('menolak masukan yang tidak bisa digabung', () => {
    expect(combinePortfolio([])).toBeNull();
    // Bagian dengan deret kosong tidak punya bulan untuk digabung sama sekali.
    const kosong = { id: 'x', result: { series: [] } } as unknown as Parameters<typeof combinePortfolio>[0][number];
    expect(combinePortfolio([kosong])).toBeNull();
  });

  it('satu aset saja menghasilkan angka yang identik dengan aset itu sendiri', () => {
    const solo = simulateDca({ prices: growingSeries('2020-01', 24, 100, 0.01), contribution: 900_000 })!;
    const combined = combinePortfolio([{ id: 'solo', result: solo }])!;
    expect(combined.totalInvested).toBeCloseTo(solo.totalInvested, 6);
    expect(combined.currentValue).toBeCloseTo(solo.currentValue, 6);
    expect(combined.multiple).toBeCloseTo(solo.multiple, 9);
    // XIRR gabungan direkonstruksi dari selisih setoran antar bulan, bukan
    // disalin — jadi kecocokannya membuktikan rekonstruksinya benar.
    expect(combined.xirr as number).toBeCloseTo(solo.xirr as number, 6);
  });

  it('dua aset identik memberi XIRR yang sama dengan satu aset', () => {
    const prices = growingSeries('2020-01', 36, 100, 0.008);
    const a = simulateDca({ prices, contribution: 500_000 })!;
    const b = simulateDca({ prices, contribution: 500_000 })!;
    const combined = combinePortfolio([
      { id: 'a', result: a },
      { id: 'b', result: b },
    ])!;
    expect(combined.xirr as number).toBeCloseTo(a.xirr as number, 6);
    expect(combined.totalInvested).toBeCloseTo(a.totalInvested * 2, 6);
  });

  it('aset yang listing belakangan tidak menyeret grafik ke bawah', () => {
    const lama = simulateDca({ prices: flatSeries('2020-01', 24, 100), contribution: 1000 })!;
    const baru = simulateDca({ prices: flatSeries('2021-01', 12, 100), contribution: 1000 })!;
    const combined = combinePortfolio([
      { id: 'lama', result: lama },
      { id: 'baru', result: baru },
    ])!;
    // 2020-06 hanya berisi aset lama: 6 setoran, bukan 6 setoran + nol.
    const juni2020 = combined.series.find((s) => s.m === '2020-06');
    expect(juni2020?.invested).toBe(6000);
    expect(juni2020?.value).toBeCloseTo(6000, 6);
    // Setelah aset kedua masuk, keduanya terhitung.
    const jan2021 = combined.series.find((s) => s.m === '2021-01');
    expect(jan2021?.invested).toBe(13_000 + 1000);
  });
});

describe('Value Lens', () => {
  it('Graham Number sesuai rumus √(22,5 × EPS × BVPS)', () => {
    expect(grahamNumber(5, 20) as number).toBeCloseTo(Math.sqrt(2250), 10);
    expect(grahamNumber(5, 20) as number).toBeCloseTo(47.4341649, 6);
  });

  it('Graham Number tidak berlaku untuk perusahaan merugi', () => {
    expect(grahamNumber(-2, 20)).toBeNull();
    expect(grahamNumber(5, -1)).toBeNull();
    expect(grahamNumber(null, 20)).toBeNull();
  });

  it('margin of safety positif saat harga di bawah nilai wajar', () => {
    expect(marginOfSafety(100, 60) as number).toBeCloseTo(40, 10);
    expect(marginOfSafety(100, 130) as number).toBeCloseTo(-30, 10);
    expect(marginOfSafety(null, 60)).toBeNull();
  });

  it('DCF menolak discount rate di bawah pertumbuhan abadi', () => {
    expect(
      simplifiedDcf({ freeCashFlowPerShare: 10, growthRate: 0.05, terminalGrowth: 0.1, discountRate: 0.08, years: 5 }),
    ).toBeNull();
  });

  it('DCF naik saat asumsi pertumbuhan dinaikkan', () => {
    const dasar = { freeCashFlowPerShare: 10, terminalGrowth: 0.02, discountRate: 0.1, years: 10 };
    const pelan = simplifiedDcf({ ...dasar, growthRate: 0.03 }) as number;
    const kencang = simplifiedDcf({ ...dasar, growthRate: 0.08 }) as number;
    expect(kencang).toBeGreaterThan(pelan);
  });

  it('saham murah berkualitas menghasilkan verdict cheap', () => {
    // Angka dibuat konsisten satu sama lain: harga 30, EPS 5 ⇒ P/E 6; BVPS 25 ⇒ P/B 1,2.
    // Graham Number = √(22,5 × 5 × 25) ≈ 53,03 ⇒ margin of safety ≈ 43%.
    const checks = assessFundamentals({
      price: 30,
      eps: 5,
      bookValuePerShare: 25,
      pe: 6,
      pb: 1.2,
      ps: 1,
      dividendYield: 0.045,
      roe: 0.22,
      roa: 0.11,
      debtToEquity: 0.4,
    });
    expect(summarizeVerdict(checks)).toBe('cheap');
    expect(checks.find((c) => c.key === 'marginOfSafety')?.verdict).toBe('cheap');
  });

  it('saham mahal berutang tinggi menghasilkan verdict expensive', () => {
    const checks = assessFundamentals({
      price: 500,
      eps: 2,
      bookValuePerShare: 5,
      pe: 90,
      pb: 30,
      ps: 20,
      dividendYield: 0,
      roe: 0.03,
      roa: 0.01,
      debtToEquity: 4,
    });
    expect(summarizeVerdict(checks)).toBe('expensive');
  });

  it('data fundamental kosong tidak dipaksa jadi kesimpulan', () => {
    const checks = assessFundamentals({
      price: null,
      eps: null,
      bookValuePerShare: null,
      pe: null,
      pb: null,
      ps: null,
      dividendYield: null,
      roe: null,
      roa: null,
      debtToEquity: null,
    });
    expect(summarizeVerdict(checks)).toBe('unknown');
  });
});
