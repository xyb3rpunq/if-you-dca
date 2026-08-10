/**
 * Value Lens (Section 5C).
 *
 * Semua di sini berasal dari prinsip value investing klasik yang sudah lama
 * terdokumentasi publik — terutama saringan Benjamin Graham untuk "defensive
 * investor" di The Intelligent Investor. Tidak ada kutipan tokoh, tidak ada
 * penilaian generatif: keluarannya kode verdict yang deterministik, dan lapisan
 * UI yang menerjemahkannya jadi kalimat. Ini bukan rekomendasi beli/jual.
 */

export interface Fundamentals {
  price: number | null;
  /** Laba per saham 12 bulan terakhir. */
  eps: number | null;
  bookValuePerShare: number | null;
  pe: number | null;
  pb: number | null;
  ps: number | null;
  /** Desimal, bukan persen: 0.035 = 3,5%. */
  dividendYield: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currency?: string;
}

export interface BookValueReconciliation {
  bookValuePerShare: number | null;
  /** true kalau nilainya dikalikan kurs karena terdeteksi dilaporkan dalam mata uang lain. */
  converted: boolean;
  note: string | null;
}

/** Di luar rentang ini, P/B hampir pasti hasil salah satuan, bukan penilaian pasar. */
const PB_PLAUSIBLE = { min: 0.02, max: 60 };

export interface RatioReconciliation {
  value: number | null;
  converted: boolean;
  note: string | null;
}

/**
 * Koreksi rasio berbasis harga yang penyebutnya dilaporkan dalam mata uang lain.
 *
 * Masalah yang sama dengan nilai buku muncul juga di price-to-sales: penyedia data
 * melaporkan pendapatan per saham dalam dolar sementara harganya dalam rupiah,
 * sehingga P/S ADRO terbaca 37.123 alih-alih sekitar 2,1.
 *
 * Ambang kecurigaan sengaja dipasang sangat tinggi (`suspectAbove`), bukan sekadar
 * "di atas normal". Ada saham yang memang berdagang di P/S 77 — MSTR salah satunya —
 * dan mengoreksinya akan merusak angka yang sebenarnya benar. Yang dikoreksi hanya
 * yang mustahil, dan hanya kalau hasil koreksinya mendarat di rentang wajar.
 */
export function reconcilePriceRatio(
  ratio: number | null | undefined,
  fxRate: number | null | undefined,
  options: { suspectAbove?: number; min?: number; max?: number } = {},
): RatioReconciliation {
  const { suspectAbove = 500, min = 0.01, max = 200 } = options;

  if (ratio == null || !Number.isFinite(ratio)) return { value: null, converted: false, note: null };
  if (ratio <= suspectAbove) return { value: ratio, converted: false, note: null };

  if (fxRate != null && Number.isFinite(fxRate) && fxRate > 0) {
    const converted = ratio / fxRate;
    if (converted >= min && converted <= max) {
      return {
        value: converted,
        converted: true,
        note: `penyebut rasio dilaporkan dalam mata uang lain — dibagi kurs ${fxRate.toFixed(0)}`,
      };
    }
  }

  return { value: null, converted: false, note: `rasio ${ratio.toFixed(0)} tidak masuk akal — dibuang` };
}

/**
 * Samakan satuan nilai buku per saham dengan satuan harganya.
 *
 * Ini bukan pembersihan kosmetik. Penyedia data kadang melaporkan nilai buku
 * saham IDX dalam DOLAR sementara harganya dalam rupiah — BUMI tercatat bernilai
 * buku 0,004 sementara harganya 187. Dibiarkan, P/B-nya terbaca 46.750 dan saham
 * itu tampak termahal sedunia, sedangkan angka sebenarnya sekitar 2,6.
 *
 * Yang lebih berbahaya: Graham Number memakai nilai buku secara langsung, jadi
 * kesalahan ini merambat ke perkiraan nilai wajar tanpa gejala apa pun.
 *
 * Konversi hanya dilakukan kalau rasio aslinya mustahil DAN hasil konversinya
 * masuk akal. Kalau keduanya tidak terpenuhi, nilainya dibuang — lebih baik tidak
 * ada angka daripada angka yang salah diam-diam.
 */
export function reconcileBookValue(input: {
  price: number | null | undefined;
  bookValuePerShare: number | null | undefined;
  fxRate: number | null | undefined;
}): BookValueReconciliation {
  const { price, bookValuePerShare: bvps, fxRate } = input;

  if (bvps == null || !Number.isFinite(bvps) || bvps <= 0) {
    return { bookValuePerShare: null, converted: false, note: null };
  }
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return { bookValuePerShare: bvps, converted: false, note: null };
  }

  const ratio = price / bvps;
  if (ratio >= PB_PLAUSIBLE.min && ratio <= PB_PLAUSIBLE.max) {
    return { bookValuePerShare: bvps, converted: false, note: null };
  }

  if (fxRate != null && Number.isFinite(fxRate) && fxRate > 0) {
    const convertedBvps = bvps * fxRate;
    const convertedRatio = price / convertedBvps;
    if (convertedRatio >= PB_PLAUSIBLE.min && convertedRatio <= PB_PLAUSIBLE.max) {
      return {
        bookValuePerShare: convertedBvps,
        converted: true,
        note: `nilai buku dilaporkan dalam mata uang lain — dikalikan kurs ${fxRate.toFixed(0)}`,
      };
    }
  }

  return {
    bookValuePerShare: null,
    converted: false,
    note: `nilai buku menghasilkan P/B ${ratio.toFixed(0)} yang tidak masuk akal — dibuang`,
  };
}

/**
 * Graham Number = √(22.5 × EPS × nilai buku per saham).
 *
 * Angka 22.5 bukan sihir: itu hasil kali dua batas Graham untuk saham defensif,
 * P/E maksimum 15 dan P/B maksimum 1,5. Jadi rumus ini menjawab "berapa harga
 * tertinggi yang masih lolos kedua saringan itu sekaligus".
 *
 * Tidak berlaku untuk perusahaan yang merugi atau berekuitas negatif — di situ
 * hasilnya null, bukan angka yang terlihat meyakinkan tapi tak bermakna.
 */
export function grahamNumber(eps: number | null, bookValuePerShare: number | null): number | null {
  if (eps == null || bookValuePerShare == null) return null;
  if (eps <= 0 || bookValuePerShare <= 0) return null;
  return Math.sqrt(22.5 * eps * bookValuePerShare);
}

/**
 * Margin of safety: seberapa jauh harga pasar di bawah perkiraan nilai wajar.
 * Positif = harga di bawah estimasi nilai. Negatif = pasar menghargai lebih mahal
 * daripada yang dibenarkan angka-angkanya.
 */
export function marginOfSafety(intrinsicValue: number | null, marketPrice: number | null): number | null {
  if (intrinsicValue == null || marketPrice == null) return null;
  if (intrinsicValue <= 0) return null;
  return ((intrinsicValue - marketPrice) / intrinsicValue) * 100;
}

export interface DcfInput {
  freeCashFlowPerShare: number;
  /** Pertumbuhan tahunan selama masa proyeksi, desimal. */
  growthRate: number;
  /** Pertumbuhan abadi setelah masa proyeksi — harus di bawah discount rate. */
  terminalGrowth: number;
  discountRate: number;
  years: number;
}

/**
 * DCF sederhana. Sengaja disebut "sederhana": hasilnya sangat sensitif terhadap
 * asumsi pertumbuhan dan discount rate, jadi diperlakukan sebagai alat berpikir
 * ("kalau asumsinya begini, harganya masuk akal di sekitar sini"), bukan ramalan.
 */
export function simplifiedDcf(input: DcfInput): number | null {
  const { freeCashFlowPerShare, growthRate, terminalGrowth, discountRate, years } = input;
  if (freeCashFlowPerShare <= 0 || years <= 0) return null;
  if (discountRate <= 0 || discountRate <= terminalGrowth) return null;

  let presentValue = 0;
  let cashFlow = freeCashFlowPerShare;
  for (let year = 1; year <= years; year += 1) {
    cashFlow *= 1 + growthRate;
    presentValue += cashFlow / (1 + discountRate) ** year;
  }
  const terminalValue = (cashFlow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  presentValue += terminalValue / (1 + discountRate) ** years;
  return presentValue;
}

export interface YearlyPoint {
  endDate: number | null;
  value: number;
}

export interface FinancialHistory {
  netIncome?: YearlyPoint[];
  revenue?: YearlyPoint[];
  equity?: YearlyPoint[];
  totalAssets?: YearlyPoint[];
  /** Arus kas bebas, yaitu sesudah belanja modal. */
  freeCashflow?: YearlyPoint[];
}

export type QualitySignal = 'pass' | 'fail' | 'unknown';

export interface QualityCheck {
  key: 'profitable' | 'earningsGrowing' | 'revenueGrowing' | 'cashBacked' | 'equityGrowing';
  signal: QualitySignal;
  /** Angka pendukung, supaya penilaian bisa diperiksa ulang, bukan dipercaya begitu saja. */
  detail: string | null;
}

/** Deret Yahoo datang terbaru-dulu; sebagian besar analisis lebih mudah dibaca terlama-dulu. */
const oldestFirst = (points?: YearlyPoint[]) =>
  [...(points ?? [])].filter((p) => Number.isFinite(p?.value)).reverse();

/**
 * Pemeriksaan kualitas berbasis TREN, bukan potret satu tahun.
 *
 * ROE 20% sekali dan ROE 20% tiga tahun berturut-turut adalah dua hal yang sangat
 * berbeda, dan rasio tunggal tidak bisa membedakannya. Rangkaian ini terinspirasi
 * saringan kualitas klasik: perusahaan yang laba, tumbuh, dan — yang paling sering
 * terlewat — labanya benar-benar didukung uang tunai masuk.
 */
export function qualityChecks(history: FinancialHistory): QualityCheck[] {
  const netIncome = oldestFirst(history.netIncome);
  const revenue = oldestFirst(history.revenue);
  const equity = oldestFirst(history.equity);
  const cashflow = oldestFirst(history.freeCashflow);

  const latest = <T,>(arr: T[]) => (arr.length ? arr[arr.length - 1] : undefined);
  const grew = (arr: YearlyPoint[]): QualitySignal => {
    if (arr.length < 2) return 'unknown';
    const first = arr[0] as YearlyPoint;
    const last = arr[arr.length - 1] as YearlyPoint;
    return last.value > first.value ? 'pass' : 'fail';
  };

  const pct = (arr: YearlyPoint[]) => {
    if (arr.length < 2) return null;
    const first = (arr[0] as YearlyPoint).value;
    const last = (arr[arr.length - 1] as YearlyPoint).value;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  };

  const lastIncome = latest(netIncome);
  const lastCash = latest(cashflow);

  const checks: QualityCheck[] = [
    {
      key: 'profitable',
      signal: lastIncome == null ? 'unknown' : lastIncome.value > 0 ? 'pass' : 'fail',
      detail: lastIncome ? `laba bersih terakhir ${lastIncome.value > 0 ? 'positif' : 'negatif'}` : null,
    },
    {
      key: 'earningsGrowing',
      signal: grew(netIncome),
      detail: pct(netIncome) == null ? null : `${(pct(netIncome) as number).toFixed(0)}% selama ${netIncome.length} tahun`,
    },
    {
      key: 'revenueGrowing',
      signal: grew(revenue),
      detail: pct(revenue) == null ? null : `${(pct(revenue) as number).toFixed(0)}% selama ${revenue.length} tahun`,
    },
    {
      // Laba yang tidak disertai uang tunai masuk adalah tanda peringatan klasik,
      // karena laba bisa diakui di pembukuan sebelum uangnya diterima.
      //
      // Yang dipakai di sini arus kas BEBAS, yaitu sesudah belanja modal, karena
      // itulah satu-satunya deret tahunan yang masih disediakan sumber datanya.
      // Konsekuensinya harus disebut: perusahaan padat modal yang sedang gencar
      // berinvestasi bisa gagal uji ini secara sah — gagal di sini adalah undangan
      // untuk menelusuri, bukan vonis.
      key: 'cashBacked',
      signal:
        lastIncome == null || lastCash == null
          ? 'unknown'
          : lastCash.value >= lastIncome.value
            ? 'pass'
            : 'fail',
      detail:
        lastIncome == null || lastCash == null || lastIncome.value === 0
          ? null
          : `arus kas bebas ${(lastCash.value / lastIncome.value).toFixed(2)}× laba bersih`,
    },
    {
      key: 'equityGrowing',
      signal: grew(equity),
      detail: pct(equity) == null ? null : `${(pct(equity) as number).toFixed(0)}% selama ${equity.length} tahun`,
    },
  ];

  return checks;
}

export interface QualityScore {
  passed: number;
  total: number;
  known: number;
}

/** Ringkas hasil pemeriksaan kualitas; yang tidak diketahui tidak dihitung sebagai lulus. */
export function scoreQuality(checks: readonly QualityCheck[]): QualityScore {
  const known = checks.filter((c) => c.signal !== 'unknown');
  return {
    passed: known.filter((c) => c.signal === 'pass').length,
    total: checks.length,
    known: known.length,
  };
}

/** Kebalikan P/E, jauh lebih mudah dibandingkan langsung dengan bunga deposito. */
export function earningsYield(pe: number | null | undefined): number | null {
  if (pe == null || !Number.isFinite(pe) || pe <= 0) return null;
  return 1 / pe;
}

/**
 * Seberapa besar arus kas bebas yang dihasilkan dibanding harga seluruh perusahaan.
 * Berguna justru ketika laba akuntansi sedang terdistorsi biaya non-tunai.
 */
export function freeCashflowYield(
  freeCashflow: number | null | undefined,
  marketCap: number | null | undefined,
): number | null {
  if (freeCashflow == null || marketCap == null) return null;
  if (!Number.isFinite(freeCashflow) || !Number.isFinite(marketCap) || marketCap <= 0) return null;
  return freeCashflow / marketCap;
}

/**
 * Apakah dividennya ditopang laba?
 * Payout di atas 100% berarti perusahaan membagikan lebih banyak daripada yang
 * dihasilkannya — bisa berlanjut sebentar, tidak bisa berlanjut selamanya.
 */
export function dividendSustainability(payoutRatio: number | null | undefined): Verdict {
  if (payoutRatio == null || !Number.isFinite(payoutRatio) || payoutRatio < 0) return 'unknown';
  if (payoutRatio > 1) return 'weak';
  if (payoutRatio > 0.8) return 'fair';
  return 'strong';
}

export type Verdict = 'cheap' | 'fair' | 'expensive' | 'strong' | 'weak' | 'unknown';

export interface RatioCheck {
  key: 'pe' | 'pb' | 'grahamCombined' | 'roe' | 'debtToEquity' | 'dividendYield' | 'marginOfSafety';
  value: number | null;
  verdict: Verdict;
  /** Ambang yang dipakai, supaya UI bisa menampilkan dasar penilaiannya. */
  threshold: string;
}

/** Ambang saringan Graham untuk investor defensif, plus dua rasio kualitas umum. */
export function assessFundamentals(f: Fundamentals): RatioCheck[] {
  const checks: RatioCheck[] = [];

  const band = (
    key: RatioCheck['key'],
    value: number | null,
    cheapBelow: number,
    expensiveAbove: number,
    threshold: string,
  ): RatioCheck => ({
    key,
    value,
    threshold,
    verdict:
      value == null || !Number.isFinite(value) || value <= 0
        ? 'unknown'
        : value <= cheapBelow
          ? 'cheap'
          : value >= expensiveAbove
            ? 'expensive'
            : 'fair',
  });

  checks.push(band('pe', f.pe, 15, 25, 'Graham: P/E ≤ 15'));
  checks.push(band('pb', f.pb, 1.5, 3, 'Graham: P/B ≤ 1,5'));

  const combined = f.pe != null && f.pb != null && f.pe > 0 && f.pb > 0 ? f.pe * f.pb : null;
  checks.push(band('grahamCombined', combined, 22.5, 45, 'Graham: P/E × P/B ≤ 22,5'));

  checks.push({
    key: 'roe',
    value: f.roe,
    threshold: 'ROE ≥ 15% dianggap kuat',
    verdict:
      f.roe == null || !Number.isFinite(f.roe) ? 'unknown' : f.roe >= 0.15 ? 'strong' : f.roe >= 0.08 ? 'fair' : 'weak',
  });

  checks.push({
    key: 'debtToEquity',
    value: f.debtToEquity,
    threshold: 'D/E ≤ 1 dianggap konservatif',
    verdict:
      f.debtToEquity == null || !Number.isFinite(f.debtToEquity) || f.debtToEquity < 0
        ? 'unknown'
        : f.debtToEquity <= 1
          ? 'strong'
          : f.debtToEquity <= 2
            ? 'fair'
            : 'weak',
  });

  checks.push({
    key: 'dividendYield',
    value: f.dividendYield,
    threshold: 'Yield ≥ 3% tergolong tinggi',
    verdict:
      f.dividendYield == null || !Number.isFinite(f.dividendYield) || f.dividendYield <= 0
        ? 'unknown'
        : f.dividendYield >= 0.03
          ? 'strong'
          : 'fair',
  });

  const graham = grahamNumber(f.eps, f.bookValuePerShare);
  const mos = marginOfSafety(graham, f.price);
  checks.push({
    key: 'marginOfSafety',
    value: mos,
    threshold: 'Graham menyarankan margin ≥ 33%',
    verdict: mos == null ? 'unknown' : mos >= 33 ? 'cheap' : mos >= 0 ? 'fair' : 'expensive',
  });

  return checks;
}

/**
 * Ringkasan satu kata dari seluruh pemeriksaan. Sengaja konservatif: kalau lebih
 * dari separuh rasio tidak punya data, hasilnya 'unknown' — bukan menebak.
 */
export function summarizeVerdict(checks: readonly RatioCheck[]): Verdict {
  const known = checks.filter((c) => c.verdict !== 'unknown');
  if (known.length < checks.length / 2) return 'unknown';
  const score = known.reduce((acc, c) => {
    if (c.verdict === 'cheap' || c.verdict === 'strong') return acc + 1;
    if (c.verdict === 'expensive' || c.verdict === 'weak') return acc - 1;
    return acc;
  }, 0);
  if (score >= 2) return 'cheap';
  if (score <= -2) return 'expensive';
  return 'fair';
}
