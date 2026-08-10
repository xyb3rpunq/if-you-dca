import { describe, expect, it } from 'vitest';

import { grahamNumber, marginOfSafety, reconcileBookValue } from './value.ts';

const FX = 17_780;

describe('reconcileBookValue', () => {
  it('membiarkan nilai buku yang sudah sesatuan dengan harganya', () => {
    // BBCA: harga 6.375, nilai buku 2.201 ⇒ P/B 2,9. Wajar, tidak perlu disentuh.
    const out = reconcileBookValue({ price: 6375, bookValuePerShare: 2201.5, fxRate: FX });
    expect(out.bookValuePerShare).toBe(2201.5);
    expect(out.converted).toBe(false);
    expect(out.note).toBeNull();
  });

  it('mengoreksi nilai buku yang dilaporkan dalam mata uang lain', () => {
    // Kasus nyata: BUMI tercatat bernilai buku 0,004 sementara harganya 187,
    // sehingga P/B terbaca 46.750. Dikalikan kurs, P/B jadi sekitar 2,6.
    const out = reconcileBookValue({ price: 187, bookValuePerShare: 0.004, fxRate: FX });
    expect(out.converted).toBe(true);
    expect(out.bookValuePerShare as number).toBeCloseTo(0.004 * FX, 6);
    expect(187 / (out.bookValuePerShare as number)).toBeCloseTo(2.63, 1);
    expect(out.note).toContain('dikalikan kurs');
  });

  it('koreksi ADRO menghasilkan P/B yang konsisten dengan sesamanya', () => {
    // ADRO 0,17 → P/B 0,84, sejajar dengan UNTR 0,89 dan ASII 0,87. Kecocokan
    // dengan emiten sejenis inilah yang membuktikan koreksinya benar.
    const out = reconcileBookValue({ price: 2530, bookValuePerShare: 0.17, fxRate: FX });
    expect(out.converted).toBe(true);
    expect(2530 / (out.bookValuePerShare as number)).toBeCloseTo(0.84, 1);
  });

  it('membuang nilai yang tetap mustahil setelah dikonversi', () => {
    // Lebih baik tidak ada angka daripada angka yang salah diam-diam.
    const out = reconcileBookValue({ price: 1_000_000, bookValuePerShare: 0.0000001, fxRate: FX });
    expect(out.bookValuePerShare).toBeNull();
    expect(out.note).toContain('tidak masuk akal');
  });

  it('tidak mengarang konversi tanpa kurs', () => {
    const out = reconcileBookValue({ price: 187, bookValuePerShare: 0.004, fxRate: null });
    expect(out.bookValuePerShare).toBeNull();
    expect(out.converted).toBe(false);
  });

  it('meneruskan ketiadaan data apa adanya', () => {
    expect(reconcileBookValue({ price: 100, bookValuePerShare: null, fxRate: FX }).bookValuePerShare).toBeNull();
    expect(reconcileBookValue({ price: 100, bookValuePerShare: 0, fxRate: FX }).bookValuePerShare).toBeNull();
    expect(reconcileBookValue({ price: 100, bookValuePerShare: -5, fxRate: FX }).bookValuePerShare).toBeNull();
  });

  it('tanpa harga, nilai buku diteruskan tanpa penilaian', () => {
    // Tidak ada harga berarti tidak ada rasio untuk diperiksa; menebak justru
    // berisiko mengubah angka yang sebenarnya sudah benar.
    const out = reconcileBookValue({ price: null, bookValuePerShare: 2201.5, fxRate: FX });
    expect(out.bookValuePerShare).toBe(2201.5);
    expect(out.converted).toBe(false);
  });

  it('P/B ekstrem yang sah tetap dipertahankan', () => {
    // AAPL benar-benar berdagang di P/B 42 — itu penilaian pasar, bukan salah satuan.
    const out = reconcileBookValue({ price: 235, bookValuePerShare: 5.52, fxRate: FX });
    expect(out.converted).toBe(false);
    expect(out.bookValuePerShare).toBe(5.52);
  });
});

describe('dampak koreksi terhadap Graham Number', () => {
  it('nilai buku yang salah satuan menghasilkan nilai wajar yang menyesatkan', () => {
    // Inti kenapa koreksi ini penting: Graham Number memakai nilai buku secara
    // langsung, jadi kesalahan satuan merambat ke perkiraan nilai wajar tanpa
    // gejala apa pun — hanya angka yang terlihat wajar tapi salah.
    const eps = 20;
    const salah = grahamNumber(eps, 0.17);
    const benar = grahamNumber(eps, 0.17 * FX);

    expect(salah as number).toBeCloseTo(Math.sqrt(22.5 * eps * 0.17), 6);
    expect(benar as number).toBeCloseTo(Math.sqrt(22.5 * eps * 0.17 * FX), 6);
    // Selisihnya bukan beberapa persen, tapi puluhan kali lipat.
    expect((benar as number) / (salah as number)).toBeCloseTo(Math.sqrt(FX), 3);
  });

  it('margin of safety ikut terbalik tandanya kalau nilai bukunya salah', () => {
    const price = 2530;
    const eps = 400;
    const salah = marginOfSafety(grahamNumber(eps, 0.17), price);
    const benar = marginOfSafety(grahamNumber(eps, 0.17 * FX), price);

    // Dengan nilai buku salah, saham tampak jauh kemahalan; dengan yang benar,
    // justru tampak diskon besar. Kesimpulannya berbalik total.
    expect(salah as number).toBeLessThan(0);
    expect(benar as number).toBeGreaterThan(0);
  });
});
