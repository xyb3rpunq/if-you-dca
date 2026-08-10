import { afterEach, describe, expect, it, vi } from 'vitest';

import { debtToEquityRatio, ensureSession, fetchQuoteSummary, fetchTimeseries, raw } from './yahoo.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** Balasan minimal yang meniru alur cookie + crumb Yahoo. */
function stubYahoo({ crumb = 'abc123', summary = null, timeseries = null, summaryStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('fc.yahoo.com')) {
      return {
        ok: true,
        status: 200,
        headers: { getSetCookie: () => ['A3=token; Path=/; Secure', 'B=other; Path=/'] },
      };
    }
    if (url.includes('getcrumb')) {
      return { ok: true, status: 200, text: async () => crumb };
    }
    if (url.includes('quoteSummary')) {
      return {
        ok: summaryStatus === 200,
        status: summaryStatus,
        json: async () => summary ?? { quoteSummary: { result: [{ defaultKeyStatistics: {} }] } },
      };
    }
    if (url.includes('fundamentals-timeseries')) {
      return { ok: true, status: 200, json: async () => timeseries };
    }
    return { ok: false, status: 404, json: async () => null, text: async () => '' };
  });
  return calls;
}

describe('raw', () => {
  it('membuka pembungkus { raw, fmt } milik Yahoo', () => {
    expect(raw({ raw: 13.51, fmt: '13.51' })).toBe(13.51);
    expect(raw(42)).toBe(42);
  });

  it('menolak nilai yang tidak bisa dipakai berhitung', () => {
    expect(raw(null)).toBeNull();
    expect(raw(undefined)).toBeNull();
    expect(raw({})).toBeNull();
    expect(raw({ raw: null })).toBeNull();
    expect(raw({ raw: 'abc' })).toBeNull();
    expect(raw(Number.NaN)).toBeNull();
    expect(raw(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('nol adalah angka sah, bukan ketiadaan data', () => {
    expect(raw({ raw: 0 })).toBe(0);
  });
});

describe('debtToEquityRatio', () => {
  it('mengubah persen Yahoo menjadi rasio', () => {
    // Yahoo melaporkan 27,59 yang berarti rasio 0,276. Tanpa konversi, perusahaan
    // berutang konservatif akan tampak berutang 27 kali modalnya.
    expect(debtToEquityRatio({ raw: 27.593 })).toBeCloseTo(0.27593, 9);
    expect(debtToEquityRatio({ raw: 6.555 })).toBeCloseTo(0.06555, 9);
  });

  it('utang nol tetap nol', () => {
    expect(debtToEquityRatio({ raw: 0 })).toBe(0);
  });

  it('meneruskan ketiadaan data', () => {
    expect(debtToEquityRatio(null)).toBeNull();
    expect(debtToEquityRatio({ raw: null })).toBeNull();
  });
});

describe('ensureSession', () => {
  it('mengambil cookie lalu crumb', async () => {
    const calls = stubYahoo({ crumb: 'Qr2uPGUvOw' });
    const session = await ensureSession(true);
    expect(session.crumb).toBe('Qr2uPGUvOw');
    expect(session.cookie).toContain('A3=token');
    // Hanya bagian sebelum titik koma yang dipakai, bukan seluruh atribut cookie.
    expect(session.cookie).not.toContain('Path=');
    expect(calls.some((u) => u.includes('getcrumb'))).toBe(true);
  });

  it('menolak crumb yang jelas bukan token', async () => {
    // Yahoo kadang membalas halaman HTML saat memblokir; menerimanya akan
    // membuat setiap permintaan berikutnya gagal dengan pesan membingungkan.
    stubYahoo({ crumb: '<!DOCTYPE html><html>Access denied</html>' });
    await expect(ensureSession(true)).rejects.toThrow(/crumb tidak sah/);
  });

  it('menolak crumb kosong', async () => {
    stubYahoo({ crumb: '   ' });
    await expect(ensureSession(true)).rejects.toThrow(/crumb tidak sah/);
  });
});

describe('fetchQuoteSummary', () => {
  it('mengembalikan hasil pertama', async () => {
    stubYahoo({ summary: { quoteSummary: { result: [{ summaryDetail: { trailingPE: { raw: 11.4 } } }] } } });
    const result = await fetchQuoteSummary('UNTR.JK');
    expect(raw(result.summaryDetail.trailingPE)).toBe(11.4);
  });

  it('mencoba sekali lagi dengan sesi baru saat crumb ditolak', async () => {
    // Crumb punya masa berlaku; sekali gagal bukan alasan menyerah.
    let attempt = 0;
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('fc.yahoo.com')) {
        return { ok: true, status: 200, headers: { getSetCookie: () => ['A3=token; Path=/'] } };
      }
      if (url.includes('getcrumb')) return { ok: true, status: 200, text: async () => 'crumb' };
      attempt += 1;
      if (attempt === 1) return { ok: false, status: 401, json: async () => null };
      return { ok: true, status: 200, json: async () => ({ quoteSummary: { result: [{ ok: true }] } }) };
    });

    const result = await fetchQuoteSummary('NVDA');
    expect(result).toEqual({ ok: true });
    expect(attempt).toBe(2);
  });

  it('menyerah setelah crumb ditolak dua kali', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('fc.yahoo.com')) {
        return { ok: true, status: 200, headers: { getSetCookie: () => ['A3=t; Path=/'] } };
      }
      if (url.includes('getcrumb')) return { ok: true, status: 200, text: async () => 'crumb' };
      return { ok: false, status: 403, json: async () => null };
    });
    await expect(fetchQuoteSummary('NVDA')).rejects.toThrow(/ditolak dua kali/);
  });

  it('melempar untuk hasil kosong alih-alih mengembalikan undefined', async () => {
    stubYahoo({ summary: { quoteSummary: { result: [], error: { description: 'simbol tidak dikenal' } } } });
    await expect(fetchQuoteSummary('TIDAKADA')).rejects.toThrow(/simbol tidak dikenal/);
  });
});

describe('fetchTimeseries', () => {
  const payload = {
    timeseries: {
      result: [
        {
          meta: {},
          timestamp: [1, 2, 3],
          annualNetIncome: [
            { asOfDate: '2022-12-31', reportedValue: { raw: 100 } },
            { asOfDate: '2023-12-31', reportedValue: { raw: 200 } },
            { asOfDate: '2024-12-31', reportedValue: { raw: 300 } },
          ],
        },
      ],
    },
  };

  it('membalik urutan jadi terbaru-dulu', async () => {
    // Endpoint ini mengirim terlama-dulu, sedangkan seluruh modul analisis
    // mengasumsikan terbaru-dulu. Salah urutan akan membalik SETIAP penilaian tren.
    stubYahoo({ timeseries: payload });
    const out = await fetchTimeseries('UNTR.JK', ['annualNetIncome']);
    expect(out.annualNetIncome.map((p) => p.value)).toEqual([300, 200, 100]);
  });

  it('membuang titik tanpa nilai', async () => {
    stubYahoo({
      timeseries: {
        timeseries: {
          result: [
            {
              meta: {},
              annualNetIncome: [
                null,
                { asOfDate: '2023-12-31', reportedValue: { raw: 200 } },
                { asOfDate: '2024-12-31', reportedValue: {} },
              ],
            },
          ],
        },
      },
    });
    const out = await fetchTimeseries('X', ['annualNetIncome']);
    expect(out.annualNetIncome).toHaveLength(1);
    expect(out.annualNetIncome[0].value).toBe(200);
  });

  it('menghilangkan tipe yang tidak dikembalikan sumbernya', async () => {
    // Yahoo diam-diam mengabaikan tipe yang tidak dikenalnya; hasilnya harus
    // kosong untuk tipe itu, bukan array berisi sampah.
    stubYahoo({ timeseries: { timeseries: { result: [] } } });
    const out = await fetchTimeseries('X', ['annualOperatingCashFlow']);
    expect(out.annualOperatingCashFlow).toBeUndefined();
    expect(Object.keys(out)).toHaveLength(0);
  });

  it('menyertakan stempel tahun tiap titik', async () => {
    stubYahoo({ timeseries: payload });
    const out = await fetchTimeseries('X', ['annualNetIncome']);
    expect(out.annualNetIncome[0].endDate).toBeGreaterThan(0);
  });
});
