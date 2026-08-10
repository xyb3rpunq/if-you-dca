import type { PricePoint } from './types.ts';

export interface SeamInfo {
  mode: 'merged' | 'historical-only' | 'recent-only';
  ratio: number;
  anchorMonth?: string;
  tailMonths?: number;
  note: string;
}

export interface MergeResult {
  monthly: PricePoint[];
  seam: SeamInfo;
}

/** Di luar rentang ini, kedua deret hampir pasti bukan instrumen yang sama. */
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;

/**
 * Sambung snapshot historis dengan ekor data terbaru, setelah menyamakan levelnya.
 *
 * Dua sumber tidak boleh disambung mentah-mentah. Harga spot emas dan futures emas
 * berbeda beberapa dolar, dan sambungan langsung akan tampak seperti lompatan harga
 * yang tidak pernah terjadi — lalu ikut terhitung sebagai return. Karena itu ekor
 * data diskalakan ke level deret historis memakai bulan terakhir yang beririsan.
 *
 * `currentMonth` diminta eksplisit, bukan dibaca dari jam sistem, supaya hasilnya
 * deterministik dan bisa diuji.
 */
export function mergeSeries(
  historical: readonly PricePoint[] | null | undefined,
  recent: readonly PricePoint[] | null | undefined,
  currentMonth: string,
): MergeResult {
  if (!historical?.length) {
    return {
      monthly: (recent ?? []).map((p) => ({ ...p })),
      seam: { mode: 'recent-only', ratio: 1, note: 'tidak ada snapshot historis' },
    };
  }
  if (!recent?.length) {
    return {
      monthly: historical.map((p) => ({ ...p })),
      seam: { mode: 'historical-only', ratio: 1, note: 'sumber terbaru tidak mengembalikan data' },
    };
  }

  const recentByMonth = new Map(recent.map((p) => [p.m, p.c]));
  // Bulan berjalan belum tutup di kedua sumber, jadi tidak dipakai sebagai jangkar.
  const overlap = historical.filter((p) => recentByMonth.has(p.m) && p.m !== currentMonth);
  if (overlap.length === 0) {
    return {
      monthly: historical.map((p) => ({ ...p })),
      seam: { mode: 'historical-only', ratio: 1, note: 'tidak ada bulan beririsan' },
    };
  }

  const anchor = overlap[overlap.length - 1] as PricePoint;
  const recentAtAnchor = recentByMonth.get(anchor.m) as number;
  const ratio = recentAtAnchor > 0 ? anchor.c / recentAtAnchor : Number.NaN;

  if (!Number.isFinite(ratio) || ratio < MIN_RATIO || ratio > MAX_RATIO) {
    return {
      monthly: historical.map((p) => ({ ...p })),
      seam: {
        mode: 'historical-only',
        ratio: Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : 0,
        note: `rasio sambungan di luar batas wajar pada ${anchor.m} — ekor data ditolak`,
      },
    };
  }

  const head = historical.filter((p) => p.m <= anchor.m).map((p) => ({ ...p }));
  const tail = recent.filter((p) => p.m > anchor.m).map((p) => ({ m: p.m, c: p.c * ratio }));

  return {
    monthly: [...head, ...tail],
    seam: {
      mode: 'merged',
      anchorMonth: anchor.m,
      ratio: Number(ratio.toFixed(6)),
      tailMonths: tail.length,
      note: `${tail.length} bulan terbaru diskalakan ×${ratio.toFixed(4)} agar sejajar dengan deret historis`,
    },
  };
}

export interface DividendResult {
  monthly: PricePoint[];
  /** Faktor pada bulan pertama deret; makin kecil, makin besar kontribusi dividen. */
  factorAtStart: number;
}

/**
 * Terapkan faktor reinvestasi dividen ke deret harga.
 *
 * Penyedia data menormalkan harga tersesuaikan supaya sama dengan harga mentah pada
 * bar terakhir, jadi faktornya bernilai 1 hari ini dan mengecil ke masa lalu.
 * Mengalikannya ke deret harga menurunkan harga historis secara efektif — yang
 * persis menggambarkan bahwa dividen membuat biaya perolehan riil investor lebih
 * rendah daripada harga yang tertera di grafik.
 *
 * Bulan tanpa data faktor memakai faktor terakhir yang diketahui, bukan 1: memakai 1
 * di tengah deret akan menciptakan lompatan palsu pada seri total return.
 */
export function applyDividendFactors(
  monthly: readonly PricePoint[],
  factors: ReadonlyMap<string, number> | null | undefined,
): DividendResult {
  if (!factors || factors.size === 0) {
    return { monthly: monthly.map((p) => ({ ...p })), factorAtStart: 1 };
  }

  const known = [...factors.keys()].sort();
  const firstKnown = known[0];
  const earliest = (firstKnown != null ? factors.get(firstKnown) : undefined) ?? 1;
  let carried = earliest;

  const out = monthly.map((point) => {
    const direct = factors.get(point.m);
    if (direct != null && Number.isFinite(direct) && direct > 0) carried = direct;
    return { m: point.m, c: point.c * carried };
  });

  const firstMonth = monthly[0]?.m;
  const direct = firstMonth != null ? factors.get(firstMonth) : undefined;
  const factorAtStart = direct != null && Number.isFinite(direct) && direct > 0 ? direct : earliest;

  return { monthly: out, factorAtStart };
}
