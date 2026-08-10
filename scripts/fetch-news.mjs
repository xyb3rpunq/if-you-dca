/**
 * Kumpulkan berita terbaru per aset.
 *
 * Dua sumber, karena tidak ada satu pun yang meliput keduanya dengan baik:
 *   - Yahoo Finance search — terstruktur dan rapi, tapi liputan saham IDX tipis.
 *   - Google News RSS — meliput media Indonesia, tapi hasilnya perlu disaring
 *     karena pencarian berbasis kata kunci ikut menarik berita yang tidak relevan.
 *
 * Dijalankan di CI, bukan di browser: keduanya tidak mengizinkan CORS. Berita
 * karena itu se-segar jadwal cron, dan UI menyebut umurnya apa adanya.
 *
 * Pakai: node scripts/fetch-news.mjs [--only=aapl,bbca]
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { COMPUTED_DIR, loadAssets, writeJson } from './lib/series.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const ONLY = args.only ? new Set(args.only.split(',').map((s) => s.trim().toLowerCase())) : null;
const DELAY_MS = Number(args.delay ?? 800);
const MAX_ITEMS = 8;
/** Berita lebih tua dari ini bukan lagi "terbaru". */
const MAX_AGE_DAYS = 45;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Buang entitas XML dan tag HTML dari judul RSS. */
function decodeXml(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchYahooNews(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}` +
    `&newsCount=${MAX_ITEMS}&quotesCount=0&enableFuzzyQuery=false`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();

  return (json?.news ?? [])
    .filter((n) => n?.title && n?.link)
    .map((n) => ({
      title: String(n.title).trim(),
      url: String(n.link),
      publisher: n.publisher ? String(n.publisher) : null,
      publishedAt: Number.isFinite(n.providerPublishTime)
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : null,
      relatedTickers: Array.isArray(n.relatedTickers) ? n.relatedTickers.map(String) : [],
      source: 'yahoo',
    }));
}

/**
 * Kata umum yang muncul di banyak nama perusahaan sekaligus, jadi tidak bisa
 * dipakai membuktikan sebuah berita membahas emiten tertentu.
 */
const GENERIC_WORDS = new Set([
  'bank',
  'group',
  'indonesia',
  'tbk',
  'persero',
  'international',
  'resources',
  'technology',
  'technologies',
  'holdings',
  'energy',
  'nasional',
  'negara',
  'central',
  'asia',
  'abadi',
  'makmur',
  'sukses',
  'tambang',
  'aneka',
  'united',
  'strategy',
]);

/**
 * Apakah berita ini benar-benar membahas asetnya?
 *
 * Perlu ada karena pencarian Yahoo untuk ticker `.JK` mengembalikan berita
 * keuangan AS yang sama sekali tidak berhubungan. Menampilkannya apa adanya lebih
 * buruk daripada tidak menampilkan berita sama sekali — pembaca akan mengira
 * berita itu tentang saham yang sedang dilihatnya.
 */
export function isRelevant(item, asset) {
  const title = (item.title ?? '').toLowerCase();
  if (!title) return false;

  // `relatedTickers` Yahoo SENGAJA tidak dipakai: artikel pasar umum ditandai
  // dengan belasan ticker sekaligus, sehingga "Fed chair menolak memberi panduan"
  // ikut muncul sebagai berita NVDA. Judul yang menyebut namanya jauh lebih jujur.
  const symbol = asset.symbol.toLowerCase();
  if (new RegExp(`(^|[^a-z0-9])${escapeRegex(symbol)}([^a-z0-9]|$)`).test(title)) return true;

  for (const alias of asset.newsAliases ?? []) {
    const needle = String(alias).toLowerCase();
    if (needle.length > 2 && title.includes(needle)) return true;
  }

  const words = asset.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const distinctive = words.filter((w) => !GENERIC_WORDS.has(w));
  if (distinctive.length > 0 && distinctive.some((w) => title.includes(w))) return true;

  // Nama yang seluruhnya tersusun dari kata umum (mis. "Bank Central Asia") hanya
  // lolos kalau seluruh katanya muncul bersamaan.
  return words.length > 1 && words.every((w) => title.includes(w));
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Susun kueri pencarian berita untuk satu aset.
 *
 * Nama resmi emiten sering memuat tanda kurung ("Alamtri Resources (Adaro)"), dan
 * memasukkannya ke dalam frasa persis membuat mesin pencari tidak menemukan apa pun.
 * Bagian dalam kurung dibuang, dan alias dipakai lebih dulu kalau ada karena ia
 * biasanya nama yang benar-benar dipakai media.
 */
export function newsQuery(asset) {
  const base = (asset.newsAliases?.[0] ?? asset.name).replace(/\s*\([^)]*\)/g, '').trim();
  // Frasa persis hanya berguna untuk nama bersuku banyak; pada satu kata ia justru
  // mempersempit hasil tanpa menambah ketepatan.
  const phrase = base.includes(' ') ? `"${base}"` : base;
  return asset.category === 'id-stock' ? `${phrase} saham ${asset.symbol}` : `${phrase} ${asset.symbol}`;
}

async function fetchGoogleNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
  const xml = await res.text();

  const items = [];
  // Parser regex sengaja dipakai daripada menambah dependensi XML: bentuk RSS
  // Google News sangat seragam, dan seluruh keluarannya dibersihkan sebelum dipakai.
  const blocks = xml.split('<item>').slice(1, MAX_ITEMS * 3);
  for (const block of blocks) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const date = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1];
    if (!title || !link) continue;
    const published = date ? new Date(decodeXml(date)) : null;
    items.push({
      title: decodeXml(title),
      url: decodeXml(link),
      publisher: source ? decodeXml(source) : null,
      publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : null,
      source: 'google-news',
    });
  }
  return items;
}

/** Buang yang tidak relevan, duplikat judul, dan berita basi; urutkan dari terbaru. */
function tidy(items, asset) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const seen = new Set();
  return items
    .filter((item) => {
      if (!item.title || item.title.length < 12) return false;
      if (!isRelevant(item, asset)) return false;
      const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      if (!item.publishedAt) return true;
      return new Date(item.publishedAt).getTime() >= cutoff;
    })
    .sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return b.publishedAt < a.publishedAt ? -1 : 1;
    })
    .slice(0, MAX_ITEMS);
}

async function main() {
  const config = await loadAssets();
  const targets = config.assets.filter((a) => a.yahoo && (!ONLY || ONLY.has(a.id)));

  console.log(`Mengumpulkan berita untuk ${targets.length} aset…\n`);
  const index = { generatedAt: new Date().toISOString(), assets: {} };

  for (const asset of targets) {
    process.stdout.write(`  ${asset.id.padEnd(8)} `);
    const collected = [];
    const errors = [];

    try {
      collected.push(...(await fetchYahooNews(asset.yahoo)));
    } catch (err) {
      errors.push(err.message);
    }
    await sleep(DELAY_MS);

    // Kecukupan diukur SETELAH penyaringan relevansi. Menghitung hasil mentah
    // membuat delapan artikel yang tidak relevan mencegah pencarian cadangan
    // berjalan, dan asetnya berakhir tanpa berita sama sekali.
    if (collected.filter((item) => isRelevant(item, asset)).length < MAX_ITEMS) {
      const query = newsQuery(asset);
      try {
        collected.push(...(await fetchGoogleNews(query)));
      } catch (err) {
        errors.push(err.message);
      }
      await sleep(DELAY_MS);
    }

    const items = tidy(collected, asset);
    const dropped = collected.length - items.length;
    await writeJson(resolve(COMPUTED_DIR, 'news', `${asset.id}.json`), {
      id: asset.id,
      symbol: asset.symbol,
      generatedAt: index.generatedAt,
      count: items.length,
      errors: errors.length ? errors : undefined,
      items: items.map(({ relatedTickers: _ignored, ...rest }) => rest),
    });

    index.assets[asset.id] = { count: items.length, newest: items[0]?.publishedAt ?? null };
    console.log(
      `${items.length} berita` +
        (dropped > 0 ? `  (${dropped} disaring karena tidak relevan/duplikat)` : '') +
        (errors.length ? `  (${errors.length} sumber gagal)` : ''),
    );
  }

  await writeJson(resolve(COMPUTED_DIR, 'news', '_index.json'), index);
  const total = Object.values(index.assets).reduce((acc, a) => acc + a.count, 0);
  console.log(`\nSelesai: ${total} berita dari ${targets.length} aset.`);
}

// Hanya jalan saat dipanggil langsung. Tanpa penjaga ini, sekadar mengimpor
// `isRelevant` untuk diuji akan menembakkan puluhan permintaan jaringan.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`\nGagal: ${err.stack ?? err.message}`);
    process.exitCode = 1;
  });
}
