import { useEffect, useRef, useState } from 'react';

/** Bentuk JSON yang ditulis `scripts/compute-dca.mjs`. */
export interface PeriodResult {
  from: string;
  to: string;
  months: number;
  contribution: number;
  totalInvested: number;
  currentValue: number;
  units: number;
  lastPrice: number;
  totalReturnPct: number;
  multiple: number;
  xirr: number | null;
  twr: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  assetMaxDrawdown: number | null;
  sharpe: number | null;
  sortino: number | null;
  beta: number | null;
  alpha: number | null;
  partial: boolean;
  /** Total setoran dinyatakan dalam daya beli bulan terakhir. */
  realTotalInvested: number | null;
  realTotalReturnPct: number | null;
  realXirr: number | null;
  /** Selisih return nominal dan riil — bagian yang dimakan inflasi. */
  inflationDragPct: number | null;
}

export type PeriodKey = '1y' | '3y' | '5y' | '10y' | 'max';

/**
 * `total` memperlakukan dividen sebagai diinvestasikan ulang; `price` hanya
 * pergerakan harga. Untuk saham dividen tinggi selisihnya bisa membalik
 * kesimpulan, jadi pilihannya diserahkan ke pengguna dan tidak pernah disamarkan.
 */
export type ReturnBasis = 'total' | 'price';

export type PeriodsByBasis = Record<ReturnBasis, Record<PeriodKey, PeriodResult | null>>;

export interface AssetRecord {
  id: string;
  symbol: string;
  name: string;
  category: string;
  quoteCurrency: 'USD' | 'IDR';
  tags: string[];
  role: string | null;
  source: string;
  resolvedSymbol: string | null;
  coingecko: string | null;
  /** Simbol stream Binance untuk harga tick-level; null kalau bukan kripto. */
  binance: string | null;
  /** Simbol Yahoo untuk kuotasi lewat proxy. */
  yahoo: string | null;
  dataFrom: string;
  dataTo: string;
  lastMonthIsPartial: boolean;
  lastPriceNative: number | null;
  lastPriceIDR: number;
  changeMoMPct: number | null;
  hasDividendData: boolean;
  /** Kontribusi dividen sepanjang riwayat, dalam persen dari harga awal. */
  dividendContributionPct: number;
  note_id: string | null;
  note_en: string | null;
  periods: PeriodsByBasis;
}

export interface PeriodMeta {
  key: PeriodKey;
  months: number | null;
  label_id: string;
  label_en: string;
}

export interface SummaryStat {
  count: number;
  fullHistoryCount: number;
  mean: number | null;
  median: number | null;
  positive: number;
  negative: number;
  best: number | null;
  worst: number | null;
}

export interface RankingsFile {
  generatedAt: string;
  baseCurrency: string;
  contribution: number;
  latestMonth: string;
  bases: ReturnBasis[];
  defaultBasis: ReturnBasis;
  periods: PeriodMeta[];
  summaryStats: Record<ReturnBasis, Record<PeriodKey, SummaryStat>>;
  assets: AssetRecord[];
}

export interface ChartPoint {
  m: string;
  i: number;
  v: number;
}

export interface AssetDetail extends AssetRecord {
  chartSeries: Record<ReturnBasis, Partial<Record<'10y' | 'max', ChartPoint[]>>>;
}

export interface InflationFile {
  source: string;
  fetchedAt: string;
  latestActualYear: number;
  estimatedFrom: string | null;
  monthly: { m: string; cpi: number; est?: boolean }[];
}

export interface CorrelationsFile {
  generatedAt: string;
  window: string;
  ids: string[];
  matrix: Record<string, Record<string, number | null>>;
}

export interface FundamentalRecord {
  provider?: string;
  ticker: string;
  price?: number | null;
  eps?: number | null;
  bookValuePerShare?: number | null;
  pe?: number | null;
  pb?: number | null;
  ps?: number | null;
  dividendYield?: number | null;
  roe?: number | null;
  roa?: number | null;
  debtToEquity?: number | null;
  error?: string;
}

export interface FundamentalsFile {
  generatedAt: string;
  available: boolean;
  reason?: string;
  message?: string;
  provider?: string;
  coverage?: string;
  assets: Record<string, FundamentalRecord>;
}

/** Vite menyuntikkan BASE_URL sesuai konfigurasi Pages ("/if-you-dca/"). */
export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/**
 * Pemuat JSON sekali jalan dengan cache modul.
 *
 * Cache-nya penting: Dashboard, Peringkat, dan Simulator sama-sama membaca
 * rankings.json, dan berpindah halaman tidak boleh berarti mengunduh ulang
 * berkas yang sama — apalagi di koneksi seluler.
 */
const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  const url = dataUrl(path);
  let pending = cache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json() as Promise<T>;
    });
    // Permintaan yang gagal tidak boleh mengunci cache selamanya — kalau tidak,
    // tombol "coba lagi" hanya akan menyajikan kegagalan yang sama.
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

/**
 * Kosongkan cache pemuat JSON.
 *
 * Dipakai tes supaya berkas yang sama bisa dibalas berbeda antar-kasus, dan tersedia
 * untuk aksi "muat ulang semua" kalau nanti dibutuhkan. Tanpa ini, cache modul
 * membuat kasus tes kedua diam-diam memakai jawaban kasus pertama.
 */
export function clearJsonCache(path?: string): void {
  if (path) cache.delete(dataUrl(path));
  else cache.clear();
}

export function useJson<T>(path: string | null): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: path != null });
  const [nonce, setNonce] = useState(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    if (path == null) {
      setState({ data: null, error: null, loading: false });
      return () => {
        active.current = false;
      };
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    loadJson<T>(path)
      .then((data) => {
        if (active.current) setState({ data, error: null, loading: false });
      })
      .catch((error: Error) => {
        if (active.current) setState({ data: null, error, loading: false });
      });
    return () => {
      active.current = false;
    };
  }, [path, nonce]);

  return {
    ...state,
    reload: () => {
      if (path) cache.delete(dataUrl(path));
      setNonce((n) => n + 1);
    },
  };
}

