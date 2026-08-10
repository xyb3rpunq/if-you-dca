import { describe, expect, it } from 'vitest';

import { isRelevant, newsQuery } from './fetch-news.mjs';

const nvda = { symbol: 'NVDA', name: 'NVIDIA', yahoo: 'NVDA', category: 'us-stock' };
const bbca = { symbol: 'BBCA', name: 'Bank Central Asia', yahoo: 'BBCA.JK', category: 'id-stock' };
const untr = { symbol: 'UNTR', name: 'United Tractors', yahoo: 'UNTR.JK', category: 'id-stock' };
const gold = { symbol: 'XAUUSD', name: 'Emas', yahoo: 'GC=F', newsAliases: ['gold', 'emas', 'xau'] };

const item = (title, extra = {}) => ({ title, source: 'yahoo', ...extra });

describe('newsQuery', () => {
  it('membuang bagian dalam tanda kurung dari nama resmi', () => {
    // "Alamtri Resources (Adaro)" sebagai frasa persis tidak menemukan apa pun.
    const adro = { symbol: 'ADRO', name: 'Alamtri Resources (Adaro)', category: 'id-stock' };
    expect(newsQuery(adro)).toBe('"Alamtri Resources" saham ADRO');
  });

  it('memakai alias lebih dulu karena itu nama yang dipakai media', () => {
    const adro = {
      symbol: 'ADRO',
      name: 'Alamtri Resources (Adaro)',
      category: 'id-stock',
      newsAliases: ['alamtri', 'adaro'],
    };
    expect(newsQuery(adro)).toBe('alamtri saham ADRO');
  });

  it('tidak memakai frasa persis untuk nama satu kata', () => {
    // Tanda kutip pada satu kata hanya mempersempit hasil tanpa menambah ketepatan.
    expect(newsQuery({ symbol: 'NVDA', name: 'NVIDIA', category: 'us-stock' })).toBe('NVIDIA NVDA');
  });

  it('menambahkan kata "saham" hanya untuk emiten Indonesia', () => {
    expect(newsQuery({ symbol: 'UNTR', name: 'United Tractors', category: 'id-stock' })).toContain('saham');
    expect(newsQuery({ symbol: 'AAPL', name: 'Apple', category: 'us-stock' })).not.toContain('saham');
  });
});

describe('isRelevant', () => {
  it('menerima judul yang menyebut tickernya', () => {
    expect(isRelevant(item('36 Analis Kompak Rekomendasikan Saham NVDA'), nvda)).toBe(true);
    expect(isRelevant(item('Muncul Kabar soal Investor Bank Central Asia (BBCA)'), bbca)).toBe(true);
  });

  it('menerima judul yang menyebut nama perusahaannya', () => {
    expect(isRelevant(item('Nvidia, Eli Lilly, and Disney Show Its Time to Back the Top Dogs'), nvda)).toBe(true);
    expect(isRelevant(item('United Tractors Siapkan Bisnis Masa Depan'), untr)).toBe(true);
  });

  it('MENOLAK artikel pasar umum yang ditandai banyak ticker', () => {
    // Inti penyaring ini. Yahoo menandai artikel semacam ini dengan belasan ticker
    // sekaligus, sehingga tanpa penyaringan ia muncul sebagai "berita NVDA".
    const broad = item('New Fed Chair Kevin Warsh Has Refused to Give Forward Guidance', {
      relatedTickers: ['NVDA', 'AAPL', 'MSFT'],
    });
    expect(isRelevant(broad, nvda)).toBe(false);

    const power = item('Forget Chips: AI Is Now a Power Trade', { relatedTickers: ['NVDA'] });
    expect(isRelevant(power, nvda)).toBe(false);
  });

  it('tidak tertipu ticker yang menempel di kata lain', () => {
    // "UNTRAINED" mengandung "UNTR" tapi jelas bukan berita United Tractors.
    expect(isRelevant(item('Untrained models fail basic reasoning tests'), untr)).toBe(false);
    expect(isRelevant(item('Bbcast launches new podcast platform'), bbca)).toBe(false);
  });

  it('memakai alias untuk aset yang namanya berbahasa Indonesia', () => {
    // Judul berbahasa Inggris tidak akan pernah memuat kata "Emas".
    expect(isRelevant(item('Weak US Jobs Data Drives Gold Futures Surge'), gold)).toBe(true);
    expect(isRelevant(item('Harga Emas Hari Ini Berpotensi Menguat'), gold)).toBe(true);
    expect(isRelevant(item('Silver rallies to a new high'), gold)).toBe(false);
  });

  it('nama yang seluruhnya kata umum butuh seluruh katanya muncul', () => {
    // "Bank" saja tidak boleh meloloskan berita bank mana pun.
    expect(isRelevant(item('Bank Mandiri catat laba naik'), bbca)).toBe(false);
    expect(isRelevant(item('Kinerja Bank Central Asia sepanjang kuartal'), bbca)).toBe(true);
  });

  it('menolak judul kosong atau tidak ada', () => {
    expect(isRelevant(item(''), nvda)).toBe(false);
    expect(isRelevant({ source: 'yahoo' }, nvda)).toBe(false);
  });

  it('pencocokan tidak peduli besar-kecil huruf', () => {
    expect(isRelevant(item('nvda naik tajam pagi ini'), nvda)).toBe(true);
    expect(isRelevant(item('NVIDIA melaporkan pendapatan'), nvda)).toBe(true);
  });

  it('ticker yang mengandung karakter khusus tidak merusak pola pencarian', () => {
    // Simbol seperti "XAUUSD" atau tanda "^" tidak boleh diperlakukan sebagai regex.
    const spx = { symbol: '^GSPC', name: 'S&P 500', yahoo: '^GSPC', newsAliases: ['s&p 500'] };
    expect(() => isRelevant(item('S&P 500 ditutup menguat'), spx)).not.toThrow();
    expect(isRelevant(item('S&P 500 ditutup menguat'), spx)).toBe(true);
  });
});
