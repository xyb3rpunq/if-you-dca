import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dualMoney,
  formatExact,
  formatMoney,
  formatMonth,
  formatMultiple,
  formatPercent,
  formatPrice,
  formatRate,
  formatRatio,
  formatRelativeTime,
  toneFor,
} from './format.ts';

describe('formatMoney', () => {
  it('memampatkan rupiah ke satuan yang bisa dibaca sekilas', () => {
    expect(formatMoney(900_000, 'IDR', 'id')).toBe('Rp900 rb');
    expect(formatMoney(108_000_000, 'IDR', 'id')).toBe('Rp108 jt');
    expect(formatMoney(3_495_300_000, 'IDR', 'id')).toBe('Rp3,5 mrd');
    expect(formatMoney(1_500_000_000_000, 'IDR', 'id')).toBe('Rp1,5 T');
  });

  it('menampilkan rupiah di bawah 10 ribu secara utuh', () => {
    expect(formatMoney(5000, 'IDR', 'id')).toBe('Rp5.000');
  });

  it('memakai satuan Inggris saat bahasanya Inggris', () => {
    expect(formatMoney(900_000, 'IDR', 'en')).toBe('Rp900K');
    expect(formatMoney(108_000_000, 'IDR', 'en')).toBe('Rp108M');
    expect(formatMoney(3_495_300_000, 'IDR', 'en')).toBe('Rp3.5B');
  });

  it('memampatkan dolar dengan ambang yang sama', () => {
    expect(formatMoney(1_500_000_000, 'USD', 'en')).toBe('$1.5B');
    expect(formatMoney(2_500_000, 'USD', 'en')).toBe('$2.5M');
    expect(formatMoney(65_000, 'USD', 'en')).toBe('$65,000');
    expect(formatMoney(12.345, 'USD', 'en')).toBe('$12.35');
  });

  it('menangani nilai negatif tanpa merusak satuannya', () => {
    expect(formatMoney(-108_000_000, 'IDR', 'id')).toBe('Rp-108 jt');
  });

  it('dolar tetap memakai pemisah internasional walau antarmukanya bahasa Indonesia', () => {
    // "$10.000" akan terbaca sebagai sepuluh dolar koma nol oleh notasi dolar, dan
    // sebagai sepuluh ribu oleh pembaca Indonesia — selisih seribu kali lipat.
    expect(formatMoney(10_000, 'USD', 'id')).toBe('$10,000');
    expect(formatMoney(1_234_567, 'USD', 'id')).toBe('$1.23M');
    expect(formatExact(1_234_567.89, 'USD', 'id')).toBe('$1,234,568');
    expect(formatPrice(4391.5, 'USD', 'id')).toBe('$4,392');
    // Rupiah tetap mengikuti bahasa antarmuka.
    expect(formatPrice(17_858, 'IDR', 'id')).toBe('Rp17.858');
    expect(formatPrice(17_858, 'IDR', 'en')).toBe('Rp17,858');
  });

  it('mengembalikan em dash untuk nilai yang tidak ada', () => {
    expect(formatMoney(null, 'IDR', 'id')).toBe('—');
    expect(formatMoney(undefined, 'IDR', 'id')).toBe('—');
    expect(formatMoney(Number.NaN, 'IDR', 'id')).toBe('—');
    expect(formatMoney(Number.POSITIVE_INFINITY, 'IDR', 'id')).toBe('—');
  });
});

describe('dualMoney', () => {
  const RATE = 17_858;

  it('menaruh rupiah di depan saat toggle di IDR, dolar tetap ikut', () => {
    const pair = dualMoney(178_580_000, RATE, 'IDR', 'id');
    expect(pair?.primary).toBe('Rp178,6 jt');
    expect(pair?.secondary).toBe('$10,000');
  });

  it('membalik urutannya saat toggle di USD', () => {
    const pair = dualMoney(178_580_000, RATE, 'USD', 'id');
    expect(pair?.primary).toBe('$10,000');
    expect(pair?.secondary).toBe('Rp178,6 jt');
  });

  it('tidak pernah mengarang dolar saat kurs tidak tersedia', () => {
    // Termasuk ketika toggle sedang di USD — lebih baik rupiah saja daripada
    // angka dolar yang dihitung dari kurs yang tidak ada.
    expect(dualMoney(1_000_000, null, 'IDR', 'id')).toEqual({ primary: 'Rp1 jt', secondary: null });
    expect(dualMoney(1_000_000, null, 'USD', 'id')).toEqual({ primary: 'Rp1 jt', secondary: null });
    expect(dualMoney(1_000_000, 0, 'USD', 'id')).toEqual({ primary: 'Rp1 jt', secondary: null });
    expect(dualMoney(1_000_000, -5, 'USD', 'id')).toEqual({ primary: 'Rp1 jt', secondary: null });
  });

  it('mengembalikan null untuk jumlah yang tidak ada', () => {
    expect(dualMoney(null, RATE, 'IDR', 'id')).toBeNull();
    expect(dualMoney(Number.NaN, RATE, 'IDR', 'id')).toBeNull();
  });

  it('menampilkan nol sebagai angka, bukan sebagai ketiadaan', () => {
    expect(dualMoney(0, RATE, 'IDR', 'id')?.primary).toBe('Rp0');
  });
});

describe('formatExact', () => {
  it('membulatkan ke rupiah penuh dengan pemisah ribuan', () => {
    expect(formatExact(1_234_567.89, 'IDR', 'id')).toBe('Rp1.234.568');
    expect(formatExact(1_234_567.89, 'USD', 'en')).toBe('$1,234,568');
    expect(formatExact(null, 'IDR', 'id')).toBe('—');
  });
});

describe('formatPercent & formatRate', () => {
  it('memberi tanda plus hanya untuk nilai positif', () => {
    expect(formatPercent(12.345)).toBe('+12.3%');
    expect(formatPercent(-5)).toBe('-5.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('menghormati jumlah desimal dan penekanan tanda', () => {
    expect(formatPercent(12.345, 2)).toBe('+12.35%');
    expect(formatPercent(12.345, 0)).toBe('+12%');
    expect(formatPercent(12.345, 1, false)).toBe('12.3%');
  });

  it('formatRate mengubah desimal jadi persen', () => {
    expect(formatRate(0.184)).toBe('+18.4%');
    expect(formatRate(-0.035)).toBe('-3.5%');
    expect(formatRate(0.184, 1, false)).toBe('18.4%');
  });

  it('keduanya menolak nilai yang tidak ada', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatRate(null)).toBe('—');
    expect(formatRate(Number.NaN)).toBe('—');
  });
});

describe('formatMultiple & formatRatio', () => {
  it('multiple selalu dua desimal dengan tanda kali', () => {
    expect(formatMultiple(32.267)).toBe('32.27×');
    expect(formatMultiple(1)).toBe('1.00×');
    expect(formatMultiple(null)).toBe('—');
  });

  it('rasio bisa diatur presisinya', () => {
    expect(formatRatio(1.2345)).toBe('1.23');
    expect(formatRatio(1.2345, 0)).toBe('1');
    expect(formatRatio(null)).toBe('—');
  });
});

describe('formatPrice', () => {
  it('menyesuaikan presisi dengan besaran angkanya', () => {
    // Harga ribuan tidak perlu sen; harga pecahan justru butuh empat desimal
    // supaya aset seperti NVDA pasca-split tidak tampil sebagai 0,00.
    expect(formatPrice(17_858, 'IDR', 'id')).toBe('Rp17.858');
    expect(formatPrice(313.33, 'USD', 'en')).toBe('$313.33');
    expect(formatPrice(0.276964, 'USD', 'en')).toBe('$0.2770');
  });

  it('mengembalikan em dash untuk harga yang tidak ada', () => {
    expect(formatPrice(null, 'USD', 'en')).toBe('—');
  });
});

describe('formatMonth', () => {
  it('memakai nama bulan sesuai bahasa', () => {
    expect(formatMonth('2024-03', 'id')).toBe('Mar 2024');
    expect(formatMonth('2024-05', 'id')).toBe('Mei 2024');
    expect(formatMonth('2024-05', 'en')).toBe('May 2024');
    expect(formatMonth('2024-12', 'id')).toBe('Des 2024');
    expect(formatMonth('2024-01', 'en')).toBe('Jan 2024');
  });

  it('mengembalikan em dash tanpa masukan', () => {
    expect(formatMonth(null, 'id')).toBe('—');
    expect(formatMonth(undefined, 'id')).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers());

  const at = (iso: string, offsetMinutes: number, lang: 'id' | 'en') => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(new Date(iso).getTime() + offsetMinutes * 60_000));
    return formatRelativeTime(iso, lang);
  };

  const BASE = '2026-08-10T02:00:00.000Z';

  it('menyebut jarak waktu dalam bahasa Indonesia', () => {
    expect(at(BASE, 0, 'id')).toBe('baru saja');
    expect(at(BASE, 25, 'id')).toBe('25 menit lalu');
    expect(at(BASE, 4 * 60, 'id')).toBe('4 jam lalu');
    expect(at(BASE, 24 * 60, 'id')).toBe('kemarin');
    expect(at(BASE, 3 * 24 * 60, 'id')).toBe('3 hari lalu');
  });

  it('menyebut jarak waktu dalam bahasa Inggris', () => {
    expect(at(BASE, 0, 'en')).toBe('just now');
    expect(at(BASE, 25, 'en')).toBe('25 min ago');
    expect(at(BASE, 4 * 60, 'en')).toBe('4h ago');
    expect(at(BASE, 24 * 60, 'en')).toBe('yesterday');
    expect(at(BASE, 3 * 24 * 60, 'en')).toBe('3 days ago');
  });

  it('menolak masukan yang bukan tanggal', () => {
    expect(formatRelativeTime(null, 'id')).toBe('—');
    expect(formatRelativeTime('bukan tanggal', 'id')).toBe('—');
  });
});

describe('toneFor', () => {
  it('memetakan untung ke mint, rugi ke merah, nol ke netral', () => {
    expect(toneFor(5)).toBe('text-mint');
    expect(toneFor(-5)).toBe('text-down');
    expect(toneFor(0)).toBe('text-ink');
    expect(toneFor(null)).toBe('text-muted');
    expect(toneFor(Number.NaN)).toBe('text-muted');
  });
});
