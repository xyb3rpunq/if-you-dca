import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const DATA_DIR = resolve(REPO_ROOT, 'data');
export const PRICES_DIR = resolve(DATA_DIR, 'prices');
export const COMPUTED_DIR = resolve(DATA_DIR, 'computed');

export async function readJson(path, fallback = undefined) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function loadAssets() {
  return readJson(resolve(DATA_DIR, 'assets.json'));
}

/** Unix detik -> "YYYY-MM" (UTC). Bar bulanan TradingView jatuh di tengah hari
 *  bursa, jadi konversi UTC aman dari geser bulan. */
export const monthKey = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 7);

export const currentMonthKey = () => new Date().toISOString().slice(0, 7);

/** "2026-08" -> 2026 * 12 + 7, untuk aritmetika jarak bulan. */
export function monthIndex(key) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return year * 12 + (month - 1);
}

export function addMonths(key, delta) {
  const total = monthIndex(key) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

// Validator data hidup di modul TypeScript bersama supaya tercakup Vitest — ini
// fungsi yang gagal secara diam-diam kalau salah, jadi justru paling butuh tes.
export { sanitizeMonthly } from '../../src/lib/finance/sanitize.ts';
