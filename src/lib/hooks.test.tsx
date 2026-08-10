// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCryptoLive, useJson } from './data.ts';
import { usePriceSeries } from './usePrices.ts';
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

describe('useCryptoLive', () => {
  it('mengambil harga dan menandai waktu pembaruan', async () => {
    routeFetch({ 'simple/price': { bitcoin: { usd: 65_058 }, ethereum: { usd: 2140 } } });
    const { result } = renderHook(() => useCryptoLive(['bitcoin', 'ethereum']));

    await waitFor(() => expect(result.current.prices.bitcoin).toBe(65_058));
    expect(result.current.prices.ethereum).toBe(2140);
    expect(result.current.updatedAt).not.toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it('mengabaikan entri tanpa harga dolar alih-alih menulis undefined', async () => {
    routeFetch({ 'simple/price': { bitcoin: { usd: 65_058 }, ethereum: {} } });
    const { result } = renderHook(() => useCryptoLive(['bitcoin', 'ethereum']));

    await waitFor(() => expect(result.current.prices.bitcoin).toBe(65_058));
    expect('ethereum' in result.current.prices).toBe(false);
  });

  it('menandai gagal tanpa menghapus harga terakhir yang diketahui', async () => {
    // CoinGecko gratis sesekali menolak permintaan. Yang benar adalah tetap
    // menampilkan harga terakhir dengan penanda tidak-live, bukan mengosongkan layar.
    routeFetch({ 'simple/price': { bitcoin: { usd: 65_058 } } });
    const { result } = renderHook(() => useCryptoLive(['bitcoin'], 50));
    await waitFor(() => expect(result.current.prices.bitcoin).toBe(65_058));

    globalThis.fetch = vi.fn(async () => {
      throw new Error('rate limited');
    }) as unknown as typeof fetch;

    await waitFor(() => expect(result.current.failed).toBe(true), { timeout: 2000 });
    expect(result.current.prices.bitcoin).toBe(65_058);
  });

  it('tidak memanggil apa pun saat daftar idnya kosong', () => {
    const spy = routeFetch({});
    renderHook(() => useCryptoLive([]));
    expect(spy).not.toHaveBeenCalled();
  });

  it('berhenti melakukan polling setelah dilepas', async () => {
    const spy = routeFetch({ 'simple/price': { bitcoin: { usd: 1 } } });
    const { unmount } = renderHook(() => useCryptoLive(['bitcoin'], 30));
    await waitFor(() => expect(spy).toHaveBeenCalled());

    unmount();
    const afterUnmount = spy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 150));
    expect(spy.mock.calls.length).toBe(afterUnmount);
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
