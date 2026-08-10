/**
 * Akses endpoint fundamental Yahoo Finance.
 *
 * Sejak 2023 endpoint `quoteSummary` menolak permintaan tanpa cookie + crumb —
 * token sekali pakai yang harus diambil lebih dulu. Alur itu dibungkus di sini
 * supaya pemanggilnya tidak perlu tahu.
 *
 * Kenapa Yahoo dan bukan Financial Modeling Prep atau Finnhub: tier gratis
 * keduanya praktis tidak meliput ticker `.JK` sama sekali, sedangkan 18 dari 25
 * aset di proyek ini adalah saham IDX. Yahoo meliputnya, tanpa API key.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Sesi berumur pendek; crumb basi ditandai Yahoo dengan HTTP 401. */
let session = null;

async function openSession() {
  const seed = await fetch('https://fc.yahoo.com/', {
    headers: { 'user-agent': USER_AGENT },
    redirect: 'manual',
  });
  const cookie = (seed.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Yahoo tidak memberi cookie sesi');

  const res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'user-agent': USER_AGENT, cookie },
  });
  const crumb = (await res.text()).trim();
  if (!crumb || crumb.length > 32 || crumb.includes('<')) {
    throw new Error(`crumb tidak sah dari Yahoo: ${crumb.slice(0, 40)}`);
  }
  return { cookie, crumb };
}

export async function ensureSession(force = false) {
  if (force || !session) session = await openSession();
  return session;
}

const MODULES = [
  'defaultKeyStatistics',
  'financialData',
  'summaryDetail',
  'incomeStatementHistory',
  'balanceSheetHistory',
  'cashflowStatementHistory',
  'earningsTrend',
].join(',');

/**
 * Ambil ringkasan fundamental satu simbol.
 * Crumb yang kedaluwarsa dicoba sekali lagi dengan sesi baru sebelum menyerah.
 */
export async function fetchQuoteSummary(symbol, modules = MODULES) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { cookie, crumb } = await ensureSession(attempt > 0);
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
      `?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, cookie } });

    if (res.status === 401 || res.status === 403) continue;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) throw new Error(json?.quoteSummary?.error?.description ?? 'respons kosong');
    return result;
  }
  throw new Error('crumb ditolak dua kali');
}

/**
 * Deret laporan keuangan tahunan lewat endpoint fundamentals-timeseries.
 *
 * Modul `balanceSheetHistory` dan `cashflowStatementHistory` di quoteSummary sudah
 * dipangkas Yahoo — keduanya kini hanya mengembalikan `endDate` tanpa satu pun
 * angka. Endpoint ini penggantinya, dan satu-satunya jalan mendapatkan ekuitas,
 * aset, serta arus kas bebas per tahun tanpa berlangganan.
 *
 * Hasilnya terurut TERLAMA-DULU; dibalik di sini agar konsisten dengan konvensi
 * quoteSummary yang terbaru-dulu.
 */
export async function fetchTimeseries(symbol, types, years = 6) {
  const { cookie, crumb } = await ensureSession();
  const now = Math.floor(Date.now() / 1000);
  const url =
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?symbol=${encodeURIComponent(symbol)}&type=${types.join(',')}` +
    `&period1=${now - years * 31_536_000}&period2=${now}&crumb=${encodeURIComponent(crumb)}`;

  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, cookie } });
  if (!res.ok) throw new Error(`timeseries HTTP ${res.status}`);
  const json = await res.json();

  const out = {};
  for (const row of json?.timeseries?.result ?? []) {
    const key = Object.keys(row).find((k) => k !== 'meta' && k !== 'timestamp');
    if (!key) continue;
    const points = (row[key] ?? [])
      .filter(Boolean)
      .map((p) => ({ endDate: p.asOfDate ? Math.floor(new Date(p.asOfDate).getTime() / 1000) : null, value: raw(p.reportedValue) }))
      .filter((p) => p.value != null);
    if (points.length) out[key] = points.reverse();
  }
  return out;
}

/** Yahoo membungkus angka sebagai `{ raw, fmt }`; ambil `raw` dan tolak yang tidak sah. */
export function raw(node) {
  if (node == null) return null;
  const value = typeof node === 'object' ? node.raw : node;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Yahoo melaporkan debt-to-equity dalam PERSEN (27,59 berarti rasio 0,276),
 * berbeda dari konvensi rasio yang dipakai modul finance. Tanpa konversi ini,
 * perusahaan berutang konservatif akan tampak berutang 27 kali modalnya.
 */
export function debtToEquityRatio(node) {
  const value = raw(node);
  return value == null ? null : value / 100;
}
