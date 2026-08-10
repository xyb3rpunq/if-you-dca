import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connectToChart } from './cdp.mjs';
import { COMPUTED_DIR, DATA_DIR, PRICES_DIR, REPO_ROOT, loadAssets, readJson, writeJson } from './series.mjs';

let dir;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vt-series-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('path repo', () => {
  it('menunjuk ke folder data yang benar relatif terhadap root', () => {
    expect(DATA_DIR).toBe(resolve(REPO_ROOT, 'data'));
    expect(PRICES_DIR).toBe(resolve(DATA_DIR, 'prices'));
    expect(COMPUTED_DIR).toBe(resolve(DATA_DIR, 'computed'));
  });
});

describe('writeJson', () => {
  it('membuat folder induk yang belum ada', async () => {
    const path = join(dir, 'a', 'b', 'c.json');
    await writeJson(path, { halo: 'dunia' });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ halo: 'dunia' });
  });

  it('menulis JSON ber-indentasi dan diakhiri baris baru', async () => {
    // Kalau tidak, setiap penulisan ulang oleh cron menghasilkan diff satu baris
    // raksasa yang mustahil ditinjau di GitHub.
    const path = join(dir, 'format.json');
    await writeJson(path, { a: 1, b: [1, 2] });
    const raw = await readFile(path, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "a": 1');
  });

  it('menimpa isi lama sepenuhnya, tidak menyisakan ekor berkas sebelumnya', async () => {
    const path = join(dir, 'timpa.json');
    await writeJson(path, { panjang: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    await writeJson(path, { p: 1 });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ p: 1 });
  });
});

describe('readJson', () => {
  it('membaca kembali apa yang ditulis', async () => {
    const path = join(dir, 'bolak-balik.json');
    const value = { angka: 1, deret: [1, 2, 3], bersarang: { ya: true } };
    await writeJson(path, value);
    await expect(readJson(path)).resolves.toEqual(value);
  });

  it('mengembalikan nilai cadangan kalau berkasnya tidak ada', async () => {
    await expect(readJson(join(dir, 'hilang.json'), null)).resolves.toBeNull();
    await expect(readJson(join(dir, 'hilang.json'), { kosong: true })).resolves.toEqual({ kosong: true });
  });

  it('melempar kalau berkasnya tidak ada dan tidak ada cadangan', async () => {
    await expect(readJson(join(dir, 'hilang.json'))).rejects.toThrow();
  });

  it('melempar untuk JSON rusak meski ada cadangan', async () => {
    // Cadangan hanya untuk "belum ada", bukan untuk "ada tapi korup". Berkas korup
    // harus berisik — diam-diam memakai cadangan berarti menghitung dari data kosong.
    const path = join(dir, 'rusak.json');
    await writeJson(path, { ok: 1 });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, '{ bukan json', 'utf8');
    await expect(readJson(path, null)).rejects.toThrow();
  });
});

describe('loadAssets', () => {
  it('memuat daftar aset asli dan bentuknya utuh', async () => {
    const config = await loadAssets();
    expect(Array.isArray(config.assets)).toBe(true);
    expect(config.assets.length).toBeGreaterThan(0);
    expect(config.baseCurrency).toBe('IDR');
    expect(config.defaults.monthlyContributionIDR).toBeGreaterThan(0);
  });

  it('setiap aset punya id unik dan field wajib', async () => {
    const { assets } = await loadAssets();
    const ids = assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const asset of assets) {
      expect(asset.symbol, `${asset.id} tanpa symbol`).toBeTruthy();
      expect(asset.category, `${asset.id} tanpa category`).toBeTruthy();
      expect(['IDR', 'USD'], `${asset.id} mata uang aneh`).toContain(asset.quoteCurrency);
    }
  });

  it('aset kurs dan benchmark yang dirujuk defaults benar-benar ada', async () => {
    // compute-dca.mjs melempar tanpa keduanya, dan itu baru ketahuan saat cron jalan.
    const config = await loadAssets();
    const ids = new Set(config.assets.map((a) => a.id));
    expect(ids.has(config.defaults.fxAsset)).toBe(true);
    expect(ids.has(config.defaults.benchmark)).toBe(true);
  });
});

describe('connectToChart', () => {
  it('memberi pesan yang bisa ditindaklanjuti saat TradingView tidak berjalan', async () => {
    // Port yang hampir pasti kosong. Yang diuji bukan CDP-nya, tapi bahwa
    // kegagalan paling umum menjelaskan cara memperbaikinya, bukan melempar ECONNREFUSED.
    await expect(connectToChart({ port: 59_999 })).rejects.toThrow(/TradingView Desktop di port 59999/);
  });
});
