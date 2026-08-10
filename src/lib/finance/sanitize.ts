import type { PricePoint } from './types.ts';

export interface Anomaly {
  m: string;
  raw: number;
  reason: string;
  /** Nilai pengganti hasil interpolasi, atau null kalau titiknya dibuang. */
  repaired: number | null;
}

export interface SanitizeRules {
  min?: number;
  max?: number;
  /** Kelipatan lonjakan yang dianggap mencurigakan kalau langsung berbalik. */
  maxJump?: number;
}

export interface SanitizeResult {
  monthly: PricePoint[];
  anomalies: Anomaly[];
}

/**
 * Buang titik data yang jelas rusak lalu isi kembali lewat interpolasi linier.
 *
 * Ini bukan paranoia teoretis. Seri USD/IDR historis pernah memuat nilai `1.34` di
 * tengah deret belasan ribu; satu titik seperti itu cukup untuk melipatgandakan hasil
 * DCA secara keliru — dan yang berbahaya, tanpa error apa pun. Deret karena itu
 * divalidasi sebelum dipakai menghitung apa pun.
 *
 * Dua jenis kerusakan yang ditangkap:
 *  1. Nilai di luar rentang wajar yang ditentukan per aset (mis. kurs USD/IDR di luar
 *     8.000–25.000), atau nilai non-positif.
 *  2. Lonjakan satu titik yang langsung berbalik — pola khas data rusak, dan sengaja
 *     dibedakan dari tren nyata yang naik lalu bertahan di level baru.
 */
export function sanitizeMonthly(
  monthly: readonly PricePoint[],
  rules: SanitizeRules = {},
): SanitizeResult {
  const { min, max, maxJump = 4 } = rules;
  const anomalies: Anomaly[] = [];
  const flagged = new Array<boolean>(monthly.length).fill(false);

  monthly.forEach((point, i) => {
    const value = point.c;
    let reason: string | null = null;
    if (!Number.isFinite(value) || value <= 0) reason = 'nilai tidak valid';
    else if (min != null && value < min) reason = `di bawah batas wajar (${min})`;
    else if (max != null && value > max) reason = `di atas batas wajar (${max})`;
    if (reason) {
      flagged[i] = true;
      anomalies.push({ m: point.m, raw: value, reason, repaired: null });
    }
  });

  for (let i = 1; i < monthly.length - 1; i += 1) {
    if (flagged[i]) continue;
    const prev = monthly[i - 1]?.c;
    const cur = monthly[i]?.c;
    const next = monthly[i + 1]?.c;
    if (prev == null || cur == null || next == null) continue;
    if (!(prev > 0 && cur > 0 && next > 0)) continue;

    const up = cur / prev;
    const down = next / cur;
    // Naik tajam lalu turun tajam kembali (atau sebaliknya). Tren yang naik lalu
    // bertahan tidak memenuhi syarat kedua, jadi tidak ikut tertangkap.
    const spikeUp = up > maxJump && down < 1 / (maxJump * 0.5);
    const spikeDown = up < 1 / maxJump && down > maxJump * 0.5;
    if (spikeUp || spikeDown) {
      flagged[i] = true;
      anomalies.push({
        m: monthly[i]?.m ?? '',
        raw: cur,
        reason: 'lonjakan satu titik lalu berbalik',
        repaired: null,
      });
    }
  }

  const cleaned: (PricePoint | null)[] = monthly.map((p) => ({ ...p }));
  for (let i = 0; i < cleaned.length; i += 1) {
    if (!flagged[i]) continue;

    let left = i - 1;
    while (left >= 0 && flagged[left]) left -= 1;
    let right = i + 1;
    while (right < cleaned.length && flagged[right]) right += 1;

    const leftPoint = left >= 0 ? cleaned[left] : null;
    const rightPoint = right < cleaned.length ? cleaned[right] : null;

    let repaired: number | null = null;
    if (leftPoint && rightPoint) {
      const t = (i - left) / (right - left);
      repaired = leftPoint.c + (rightPoint.c - leftPoint.c) * t;
    } else if (leftPoint) {
      repaired = leftPoint.c;
    } else if (rightPoint) {
      repaired = rightPoint.c;
    }

    const current = cleaned[i];
    const record = anomalies.find((a) => a.m === current?.m);
    if (repaired == null) {
      // Tidak ada tetangga sehat untuk bersandar — lebih baik hilang daripada salah.
      if (record) record.reason += ' — tidak bisa diperbaiki, titik dibuang';
      cleaned[i] = null;
    } else {
      if (record) record.repaired = repaired;
      if (current) cleaned[i] = { ...current, c: repaired, repaired: true };
    }
  }

  return { monthly: cleaned.filter((p): p is PricePoint => p != null), anomalies };
}
