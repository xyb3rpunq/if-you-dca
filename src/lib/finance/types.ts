/** Satu titik harga bulanan. `m` = "YYYY-MM", `c` = harga penutupan. */
export interface PricePoint {
  m: string;
  c: number;
  /** true kalau nilainya hasil interpolasi karena data aslinya terdeteksi rusak. */
  repaired?: boolean;
}

/** Arus kas untuk XIRR. Negatif = uang keluar (setoran), positif = uang masuk. */
export interface CashFlow {
  when: Date;
  amount: number;
}

export interface DcaSeriesPoint {
  m: string;
  /** Akumulasi setoran sampai bulan ini. */
  invested: number;
  /** Nilai pasar portofolio di akhir bulan ini. */
  value: number;
}

export interface DcaResult {
  from: string;
  to: string;
  /** Jumlah setoran bulanan yang benar-benar terjadi. */
  months: number;
  contribution: number;
  totalInvested: number;
  units: number;
  lastPrice: number;
  currentValue: number;
  totalReturnPct: number;
  multiple: number;
  /** Return tahunan yang memperhitungkan waktu tiap setoran (money-weighted). */
  xirr: number | null;
  /** Pertumbuhan aset itu sendiri, lepas dari kapan user menyetor (time-weighted). */
  twr: number | null;
  volatility: number | null;
  /** Penurunan terdalam nilai portofolio dari puncaknya. */
  maxDrawdown: number | null;
  /** Penurunan terdalam harga asetnya sendiri — angka yang lebih jujur soal "seberapa sakit". */
  assetMaxDrawdown: number | null;
  sharpe: number | null;
  sortino: number | null;
  beta: number | null;
  alpha: number | null;
  /** true kalau data historis tidak mencakup seluruh periode yang diminta. */
  partial: boolean;
  series: DcaSeriesPoint[];
}
