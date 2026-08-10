// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useJson } from './data.ts';
import { useLiveFx, useLiveQuotes } from './live/hooks.ts';
import { useDeflators } from './useInflation.ts';
import { seriesFor, usePriceSeries } from './usePrices.ts';
import type { PriceFile } from './usePrices.ts';
import { useUsdRate } from './useRankings.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  // Wajib eksplisit: auto-cleanup Testing Library hanya aktif kalau `globals: true`,
  // dan tanpa ini hook dari tes sebelumnya terus melakukan polling ke fetch global
  // milik tes berikutnya — kebocoran yang membuat hasilnya tampak acak.
  cleanup();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Balas berbeda tergantung URL yang diminta. */
function routeFetch(routes: Record<string, unknown>, { ok = true, status = 200 } = {}) {
  const spy = vi.fn(async (input: unknown) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (key == null) return { ok: false, status: 404, json: async () => null } as unknown as Response;
    return { ok, status, json: async () => routes[key] } as unknown as Response;
  });
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe('useJson', () => {
  it('melewati keadaan memuat lalu menyerahkan datanya', async () => {
    routeFetch({ 'hook-a.json': { nilai: 42 } });
    const { result } = renderHook(() => useJson<{ nilai: number }>('hook-a.json'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ nilai: 42 });
    expect(result.current.error).toBeNull();
  });

  it('menyerahkan error tanpa membuang data jadi keadaan tergantung', async () => {
    routeFetch({ 'hook-b.json': null }, { ok: false, status: 500 });
    const { result } = renderHook(() => useJson('hook-b.json'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
  });

  it('reload benar-benar menyentuh jaringan lagi setelah gagal', async () => {
    routeFetch({ 'hook-c.json': null }, { ok: false, status: 500 });
    const { result } = renderHook(() => useJson<{ ok: boolean }>('hook-c.json'));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    routeFetch({ 'hook-c.json': { ok: true } });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }));
    expect(result.current.error).toBeNull();
  });

  it('path null berarti tidak ada yang dimuat, bukan memuat selamanya', () => {
    const spy = routeFetch({});
    const { result } = renderHook(() => useJson(null));
    expect(result.current.loading).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useLiveFx', () => {
  it('menurunkan kurs dari kutipan dua mata uang CoinGecko', async () => {
    routeFetch({ 'simple/price': { bitcoin: { usd: 64_947, idr: 1_157_281_283 } } });
    const { result } = renderHook(() => useLiveFx());
    await waitFor(() => expect(result.current.rate).not.toBeNull());
    expect(result.current.rate as number).toBeCloseTo(17_819, 0);
    expect(result.current.source).toBe('crypto-implied');
  });

  it('turun ke kurs referensi ECB kalau sumber utama gagal', async () => {
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('coingecko')) return { ok: false, status: 429, json: async () => null } as unknown as Response;
      return { ok: true, status: 200, json: async () => ({ rates: { IDR: 17_846 } }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLiveFx());
    await waitFor(() => expect(result.current.source).toBe('ecb-reference'));
    expect(result.current.rate).toBe(17_846);
  });

  it('menolak kurs di luar rentang wajar dari kedua sumber', async () => {
    // Kurs yang salah merusak setiap angka rupiah sekaligus, jadi lebih baik null.
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('coingecko')) {
        return { ok: true, status: 200, json: async () => ({ bitcoin: { usd: 1, idr: 1 } }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ rates: { IDR: 3 } }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useLiveFx());
    await new Promise((r) => setTimeout(r, 200));
    expect(result.current.rate).toBeNull();
  });

  it('berhenti melakukan polling setelah dilepas', async () => {
    const spy = routeFetch({ 'simple/price': { bitcoin: { usd: 64_947, idr: 1_157_281_283 } } });
    const { unmount } = renderHook(() => useLiveFx(40));
    await waitFor(() => expect(spy).toHaveBeenCalled());

    unmount();
    const afterUnmount = spy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 180));
    expect(spy.mock.calls.length).toBe(afterUnmount);
  });
});

describe('useLiveQuotes', () => {
  it('diam total tanpa endpoint yang dikonfigurasi', () => {
    const spy = routeFetch({});
    const { result } = renderHook(() => useLiveQuotes(null, ['AAPL']));
    expect(result.current.status).toBe('disabled');
    expect(spy).not.toHaveBeenCalled();
  });

  it('mengambil dan memetakan kuotasi per simbol', async () => {
    routeFetch({
      'proxy.test': { quotes: [{ symbol: 'AAPL', price: 313.33, changePct: 1.2, currency: 'USD', at: 1 }] },
    });
    const { result } = renderHook(() => useLiveQuotes('https://proxy.test/quote', ['AAPL']));
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(result.current.quotes.AAPL?.price).toBe(313.33);
  });

  it('menandai error tanpa melempar saat proxy gagal', async () => {
    routeFetch({ 'proxy.test': null }, { ok: false, status: 502 });
    const { result } = renderHook(() => useLiveQuotes('https://proxy.test/quote', ['AAPL']));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('balasan kosong dihitung error, bukan sukses tanpa harga', async () => {
    routeFetch({ 'proxy.test': { quotes: [] } });
    const { result } = renderHook(() => useLiveQuotes('https://proxy.test/quote', ['AAPL']));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('seriesFor', () => {
  const file = {
    monthly: [{ m: '2020-01', c: 100 }],
    monthlyTotal: [{ m: '2020-01', c: 70 }],
  } as unknown as PriceFile;

  it('memilih deret sesuai basis yang diminta', () => {
    expect(seriesFor(file, 'total')?.[0]?.c).toBe(70);
    expect(seriesFor(file, 'price')?.[0]?.c).toBe(100);
  });

  it('jatuh kembali ke deret harga kalau total return belum ada', () => {
    // Berkas hasil pipeline versi lama tidak punya monthlyTotal; halaman harus
    // tetap tampil dengan angka price return, bukan kosong.
    const lama = { monthly: [{ m: '2020-01', c: 100 }] } as unknown as PriceFile;
    expect(seriesFor(lama, 'total')?.[0]?.c).toBe(100);
    expect(seriesFor({ ...lama, monthlyTotal: [] } as unknown as PriceFile, 'total')?.[0]?.c).toBe(100);
  });

  it('mengembalikan null tanpa berkas', () => {
    expect(seriesFor(undefined, 'total')).toBeNull();
  });
});

describe('useDeflators', () => {
  it('membangun faktor inflasi dengan bulan acuan berfaktor satu', async () => {
    routeFetch({
      'inflation.json': {
        source: 'uji',
        latestActualYear: 2025,
        monthly: [
          { m: '2024-07', cpi: 100 },
          { m: '2025-07', cpi: 110 },
        ],
      },
    });
    const { result } = renderHook(() => useDeflators('2025-07'));
    await waitFor(() => expect(result.current.deflators.size).toBeGreaterThan(0));
    expect(result.current.deflators.get('2025-07')).toBeCloseTo(1, 9);
    expect(result.current.deflators.get('2024-07')).toBeCloseTo(1.1, 6);
  });

  it('mengembalikan peta kosong tanpa bulan acuan', () => {
    routeFetch({});
    const { result } = renderHook(() => useDeflators(null));
    expect(result.current.deflators.size).toBe(0);
  });
});

describe('useUsdRate', () => {
  it('mengambil kurs dari snapshot peringkat yang sama dengan halaman induknya', async () => {
    routeFetch({
      'computed/rankings.json': { assets: [{ id: 'usdidr', lastPriceNative: 17_858 }] },
    });
    const { result } = renderHook(() => useUsdRate());
    await waitFor(() => expect(result.current).toBe(17_858));
  });
});

describe('usePriceSeries', () => {
  it('memuat beberapa aset sekaligus dan mengumpulkannya per id', async () => {
    routeFetch({
      'prices/spx.json': { id: 'spx', monthly: [{ m: '2024-01', c: 100 }] },
      'prices/bbca.json': { id: 'bbca', monthly: [{ m: '2024-01', c: 200 }] },
    });
    const { result } = renderHook(() => usePriceSeries(['spx', 'bbca']));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(Object.keys(result.current.series).sort()).toEqual(['bbca', 'spx']);
    expect(result.current.series.spx?.monthly[0]?.c).toBe(100);
  });

  it('satu aset gagal menandai seluruh permintaan gagal, bukan diam-diam separuh', async () => {
    globalThis.fetch = vi.fn(async (input: unknown) =>
      String(input).includes('rusak')
        ? ({ ok: false, status: 404, json: async () => null } as unknown as Response)
        : ({ ok: true, status: 200, json: async () => ({ id: 'spx', monthly: [] }) } as unknown as Response),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => usePriceSeries(['spx', 'rusak']));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.loading).toBe(false);
  });

  it('daftar kosong tidak menggantung di keadaan memuat', () => {
    const spy = routeFetch({});
    const { result } = renderHook(() => usePriceSeries([]));
    expect(result.current.loading).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
