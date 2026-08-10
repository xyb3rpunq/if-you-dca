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
