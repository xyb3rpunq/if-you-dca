import { afterEach, describe, expect, it, vi } from 'vitest';

import { dataUrl, loadJson } from './data.ts';
import type { AssetRecord, RankingsFile } from './data.ts';
import { fxRateOf } from './useRankings.ts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** Ganti fetch global dengan mata-mata yang membalas payload tetap. */
function stubFetch(payload: unknown, ok = true, status = 200) {
  const spy = vi.fn(async () => ({ ok, status, json: async () => payload }) as unknown as Response);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe('dataUrl', () => {
  it('menempelkan base path Vite supaya jalan di sub-path GitHub Pages', () => {
    // Situs terbit di /if-you-dca/, jadi path absolut "/data/..." akan 404.
    expect(dataUrl('computed/rankings.json')).toBe(`${import.meta.env.BASE_URL}data/computed/rankings.json`);
  });
});

describe('loadJson', () => {
  it('mengambil dan mengurai JSON', async () => {
    stubFetch({ hello: 'dunia' });
    await expect(loadJson('uji/dasar.json')).resolves.toEqual({ hello: 'dunia' });
  });

  it('hanya mengambil sekali untuk path yang sama', async () => {
    // Dashboard, Peringkat, dan Simulator membaca rankings.json yang sama;
    // berpindah halaman tidak boleh berarti mengunduh ulang di koneksi seluler.
    const spy = stubFetch({ nilai: 1 });
    await loadJson('uji/cache.json');
    await loadJson('uji/cache.json');
    await loadJson('uji/cache.json');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('melempar dengan menyebut path dan status saat responsnya gagal', async () => {
    stubFetch(null, false, 503);
    await expect(loadJson('uji/gagal.json')).rejects.toThrow('uji/gagal.json: HTTP 503');
  });

  it('tidak mengunci cache dengan kegagalan, sehingga percobaan ulang benar-benar mengulang', async () => {
    // Kalau permintaan gagal tetap tersimpan di cache, tombol "coba lagi" hanya
    // akan menyajikan kegagalan yang sama selamanya tanpa pernah menyentuh jaringan.
    stubFetch(null, false, 500);
    await expect(loadJson('uji/pulih.json')).rejects.toThrow();

    const second = stubFetch({ pulih: true });
    await expect(loadJson('uji/pulih.json')).resolves.toEqual({ pulih: true });
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('fxRateOf', () => {
  const withRate = (lastPriceNative: number | null): RankingsFile =>
    ({ assets: [{ id: 'usdidr', lastPriceNative } as AssetRecord] }) as RankingsFile;

  it('mengambil kurs dari aset usdidr', () => {
    expect(fxRateOf(withRate(17_858))).toBe(17_858);
  });

  it('memperlakukan kurs nol atau negatif sebagai tidak ada', () => {
    // Membagi dengan nol menghasilkan Infinity, dan kurs negatif membalik tanda
    // seluruh nilai portofolio. Keduanya lebih buruk daripada tidak menampilkan dolar.
    expect(fxRateOf(withRate(0))).toBeNull();
    expect(fxRateOf(withRate(-1))).toBeNull();
    expect(fxRateOf(withRate(null))).toBeNull();
  });

  it('mengembalikan null saat data belum ada atau aset kurs tidak terdaftar', () => {
    expect(fxRateOf(null)).toBeNull();
    expect(fxRateOf({ assets: [] } as unknown as RankingsFile)).toBeNull();
  });
});
