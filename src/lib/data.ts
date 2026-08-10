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

export interface PriceLevelInfo {
  price: number;
  touches: number;
  lastTouch: string;
}

export interface TechnicalsFile {
  id: string;
  symbol: string;
  currency: string;
  generatedAt: string;
  price: number;
  dataFrom: string | null;
  dailyBars: number;
  allTimeHigh: { price: number; at: string; distancePct: number | null } | null;
  allTimeLow: { price: number; at: string; distancePct: number | null } | null;
  supports: PriceLevelInfo[];
  resistances: PriceLevelInfo[];
  pivots: Record<'pivot' | 'r1' | 'r2' | 'r3' | 's1' | 's2' | 's3', number | null> | null;
  pivotBasis: string | null;
  indicators: {
    rsi14: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    ema12: number | null;
    ema26: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bollingerUpper: number | null;
    bollingerMiddle: number | null;
    bollingerLower: number | null;
    bollingerBandwidth: number | null;
    atr14: number | null;
    stochK: number | null;
    stochD: number | null;
  };
}

export interface NewsItem {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
  source: string;
}

export interface NewsFile {
  id: string;
  symbol: string;
  generatedAt: string;
  count: number;
  items: NewsItem[];
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

export interface YearlyValue {
  endDate: number | null;
  value: number;
}

export interface FundamentalRecord {
  provider?: string;
  ticker: string;
  error?: string;

  // Valuasi
  price?: number | null;
  marketCap?: number | null;
  pe?: number | null;
  forwardPe?: number | null;
  pb?: number | null;
  ps?: number | null;
  peg?: number | null;
  eps?: number | null;
  forwardEps?: number | null;
  bookValuePerShare?: number | null;
  enterpriseValue?: number | null;
  earningsYield?: number | null;
  freeCashflowYield?: number | null;
  /** true kalau nilai buku dikoreksi satuannya oleh pipeline. */
  bookValueConverted?: boolean;
  bookValueNote?: string | null;

  // Kualitas
  roe?: number | null;
  roa?: number | null;
  grossMargin?: number | null;
  operatingMargin?: number | null;
  profitMargin?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;

  // Kesehatan keuangan
  debtToEquity?: number | null;
  currentRatio?: number | null;
  quickRatio?: number | null;
  totalCash?: number | null;
  totalDebt?: number | null;
  freeCashflow?: number | null;
  operatingCashflow?: number | null;

  // Dividen
  dividendYield?: number | null;
  payoutRatio?: number | null;

  history?: {
    netIncome?: YearlyValue[];
    revenue?: YearlyValue[];
    equity?: YearlyValue[];
    totalAssets?: YearlyValue[];
    operatingCashflow?: YearlyValue[];
  };
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

