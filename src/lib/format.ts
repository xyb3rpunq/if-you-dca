import type { Lang } from '../i18n/strings.ts';

export type Currency = 'IDR' | 'USD';

/**
 * Rupiah mengikuti bahasa antarmuka, dolar SELALU memakai konvensi internasional.
 *
 * Kalau tidak, halaman berbahasa Indonesia menampilkan "$10.000" — dan titik di
 * situ berarti ribuan bagi pembaca Indonesia tapi desimal bagi notasi dolar.
 * Sepuluh ribu dolar dan sepuluh dolar adalah selisih seribu kali lipat, jadi
 * ambiguitas ini tidak bisa dibiarkan demi konsistensi lokal semata.
 */
function localeFor(currency: Currency, lang: Lang): string {
  if (currency === 'USD') return 'en-US';
  return lang === 'id' ? 'id-ID' : 'en-US';
}

/**
 * Rupiah dalam jutaan/miliar, bukan deret 9 digit.
 * "Rp3,5 mrd" bisa dibaca dalam sekejap; "Rp3.495.312.007" tidak — dan dashboard ini
 * memang dirancang untuk dilihat sambil lalu dari HP.
 */
export function formatMoney(value: number | null | undefined, currency: Currency, lang: Lang): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const locale = localeFor(currency, lang);

  if (currency === 'USD') {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}B`;
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}M`;
    if (Math.abs(value) >= 1000) return `$${value.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
    return `$${value.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
  }

  const suffixes =
    lang === 'id'
      ? { t: ' T', b: ' mrd', m: ' jt', k: ' rb' }
      : { t: 'T', b: 'B', m: 'M', k: 'K' };

  const abs = Math.abs(value);
  if (abs >= 1e12) return `Rp${(value / 1e12).toLocaleString(locale, { maximumFractionDigits: 2 })}${suffixes.t}`;
  if (abs >= 1e9) return `Rp${(value / 1e9).toLocaleString(locale, { maximumFractionDigits: 2 })}${suffixes.b}`;
  if (abs >= 1e6) return `Rp${(value / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })}${suffixes.m}`;
  if (abs >= 1e4) return `Rp${(value / 1e3).toLocaleString(locale, { maximumFractionDigits: 0 })}${suffixes.k}`;
  return `Rp${value.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
}

export interface DualMoney {
  primary: string;
  /** null kalau kurs tidak tersedia, sehingga dolar tidak bisa dihitung. */
  secondary: string | null;
}

/**
 * Pilih pasangan rupiah/dolar untuk satu jumlah uang.
 *
 * Dipisahkan dari komponennya supaya bisa diuji sebagai fungsi murni: aturan
 * "tampilkan keduanya, yang mana di atas tergantung toggle, dan jangan pernah
 * mengarang dolar tanpa kurs" adalah logika yang bisa salah diam-diam.
 */
export function dualMoney(
  idr: number | null | undefined,
  usdRate: number | null,
  currency: Currency,
  lang: Lang,
): DualMoney | null {
  if (idr == null || !Number.isFinite(idr)) return null;

  const usd = usdRate != null && usdRate > 0 ? idr / usdRate : null;
  // Tanpa kurs yang sah, dolar tidak pernah ditampilkan — termasuk saat toggle
  // sedang di posisi USD. Lebih baik menampilkan rupiah saja daripada menebak.
  if (currency === 'USD' && usd != null) {
    return { primary: formatMoney(usd, 'USD', lang), secondary: formatMoney(idr, 'IDR', lang) };
  }
  return {
    primary: formatMoney(idr, 'IDR', lang),
    secondary: usd != null ? formatMoney(usd, 'USD', lang) : null,
  };
}

/** Angka utuh dengan pemisah ribuan — untuk tooltip dan tabel yang butuh presisi. */
export function formatExact(value: number | null | undefined, currency: Currency, lang: Lang): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const locale = localeFor(currency, lang);
  const prefix = currency === 'USD' ? '$' : 'Rp';
  return `${prefix}${Math.round(value).toLocaleString(locale)}`;
}

export function formatPercent(value: number | null | undefined, digits = 1, withSign = true): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = withSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** Untuk nilai desimal (0.184 → "+18,4%"). */
export function formatRate(value: number | null | undefined, digits = 1, withSign = true): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatPercent(value * 100, digits, withSign);
}

export function formatMultiple(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}×`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

/** Harga dalam mata uang aslinya — presisi menyesuaikan besaran angkanya. */
export function formatPrice(value: number | null | undefined, currency: string, lang: Lang): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const locale = localeFor(currency === 'IDR' ? 'IDR' : 'USD', lang);
  const digits = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 1 ? 2 : 4;
  const formatted = value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency === 'IDR' ? `Rp${formatted}` : `$${formatted}`;
}

const MONTH_NAMES: Record<Lang, string[]> = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "2024-03" → "Mar 2024" */
export function formatMonth(key: string | null | undefined, lang: Lang): string {
  if (!key) return '—';
  const monthIdx = Number(key.slice(5, 7)) - 1;
  const name = MONTH_NAMES[lang][monthIdx] ?? key.slice(5, 7);
  return `${name} ${key.slice(0, 4)}`;
}

/** "3 jam lalu" — jujur soal seberapa basi data yang sedang dilihat. */
export function formatRelativeTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const minutes = Math.round((Date.now() - then) / 60_000);

  if (lang === 'id') {
    if (minutes < 1) return 'baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'kemarin' : `${days} hari lalu`;
  }

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Kelas warna untuk angka untung/rugi. */
export function toneFor(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'text-muted';
  if (value > 0) return 'text-mint';
  if (value < 0) return 'text-down';
  return 'text-ink';
}
