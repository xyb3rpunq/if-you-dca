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

/**
 * Buang titik data yang jelas rusak lalu isi kembali lewat interpolasi linier.
 *
 * Ini bukan paranoia teoretis: seri USD/IDR historis pernah memuat nilai `1.34`
 * di tengah deret belasan ribu. Satu titik seperti itu cukup untuk melipatgandakan
 * hasil DCA secara keliru, jadi seri divalidasi sebelum dipakai menghitung apa pun.
 *
 * @param {{m: string, c: number}[]} monthly
 * @param {{min?: number, max?: number, maxJump?: number}} [rules]
 * @returns {{ monthly: {m: string, c: number}[], anomalies: {m: string, raw: number, reason: string, repaired: number|null}[] }}
 */
export function sanitizeMonthly(monthly, rules = {}) {
  const { min, max, maxJump = 4 } = rules;
  const anomalies = [];
  const flagged = new Array(monthly.length).fill(false);

  monthly.forEach((point, i) => {
    const value = point.c;
    let reason = null;
    if (!Number.isFinite(value) || value <= 0) reason = 'nilai tidak valid';
    else if (min != null && value < min) reason = `di bawah batas wajar (${min})`;
    else if (max != null && value > max) reason = `di atas batas wajar (${max})`;
    if (reason) {
      flagged[i] = true;
      anomalies.push({ m: point.m, raw: value, reason, repaired: null });
    }
  });

  // Lonjakan ekstrem yang langsung berbalik (spike satu titik) — pola khas data rusak,
  // dibedakan dari tren nyata yang naik lalu bertahan.
  for (let i = 1; i < monthly.length - 1; i += 1) {
    if (flagged[i]) continue;
    const prev = monthly[i - 1].c;
    const cur = monthly[i].c;
    const next = monthly[i + 1].c;
    if (!(prev > 0 && cur > 0 && next > 0)) continue;
    const up = cur / prev;
    const down = next / cur;
    const isSpike = (up > maxJump && down < 1 / (maxJump * 0.5)) || (up < 1 / maxJump && down > maxJump * 0.5);
    if (isSpike) {
      flagged[i] = true;
      anomalies.push({ m: monthly[i].m, raw: cur, reason: 'lonjakan satu titik lalu berbalik', repaired: null });
    }
  }

  const cleaned = monthly.map((p) => ({ ...p }));
  for (let i = 0; i < cleaned.length; i += 1) {
    if (!flagged[i]) continue;
    let left = i - 1;
    while (left >= 0 && flagged[left]) left -= 1;
    let right = i + 1;
    while (right < cleaned.length && flagged[right]) right += 1;

    let repaired = null;
    if (left >= 0 && right < cleaned.length) {
      const span = right - left;
      const t = (i - left) / span;
      repaired = cleaned[left].c + (cleaned[right].c - cleaned[left].c) * t;
    } else if (left >= 0) {
      repaired = cleaned[left].c;
    } else if (right < cleaned.length) {
      repaired = cleaned[right].c;
    }

    const record = anomalies.find((a) => a.m === cleaned[i].m);
    if (repaired == null) {
      if (record) record.reason += ' — tidak bisa diperbaiki, titik dibuang';
      cleaned[i] = null;
    } else {
      if (record) record.repaired = repaired;
      cleaned[i] = { ...cleaned[i], c: repaired, repaired: true };
    }
  }

  return { monthly: cleaned.filter(Boolean), anomalies };
}
