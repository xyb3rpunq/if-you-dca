# CLAUDE.md — Value Terminal

Memori proyek untuk sesi Claude Code berikutnya. Bagian 1–5 adalah brief asli; bagian 6
mencatat keputusan yang sudah diambil saat implementasi **beserta alasannya**, supaya tidak
dibongkar ulang tanpa sadar.

---

## 1. Visi

Dashboard web open-source yang:

1. Menghitung simulasi **DCA historis nyata** untuk saham, kripto, komoditas, dan forex.
2. Menampilkan data harga **live/near-live**, bukan statis.
3. Punya **Value Lens** — analisis bergaya value investing klasik (Graham).
4. **100% gratis dijalankan** (hosting + data), deploy dari GitHub, tanpa server berbayar.
5. Bertema **terminal trading web3 tapi tetap human-friendly** — orang awam harus paham angkanya.

**Pengguna sasaran:** individu Indonesia yang baru mulai investasi rutin bulanan kecil–menengah
(default di seluruh UI: **Rp900.000/bulan**), berbasis IDR, lintas pasar. Diasumsikan mengecek
dashboard secara sporadis dari HP di sela kerja — **mobile-first dan terbaca dalam <10 detik
adalah prioritas desain, bukan afterthought.**

## 2. Arsitektur

JAMstack + scheduled data pipeline. GitHub Actions (cron) mengambil data, menghitung, dan
mem-commit JSON ke repo. GitHub Pages menyajikan situs statis yang membaca JSON itu. Browser
memanggil CoinGecko langsung untuk harga kripto live. API key hanya hidup di GitHub Secrets.

Fase 2 kalau butuh saham real-time: **Cloudflare Pages Functions** (tetap dari GitHub, tetap
gratis, dapat serverless proxy untuk Yahoo tanpa CORS).

## 3. Sumber data

| Kelas | Sumber | Key | CORS browser |
|---|---|---|---|
| Kripto live | CoinGecko `/simple/price` | tidak | ✅ |
| Riwayat bulanan | TradingView Desktop via CDP | tidak | lokal saja |
| Saham/komoditas/forex | Yahoo Finance `v8/finance/chart` | tidak | ❌ (CI saja) |
| Forex cadangan | Frankfurter.app | tidak | ✅ |
| Fundamental | FMP free tier → fallback Finnhub | **ya** | CI saja |

**Pelajaran wajib diterapkan:** selalu validasi data masuk. Seri USD/IDR pernah punya titik
rusak `1.34` di antara belasan ribu. Gunakan closing bulanan untuk DCA. Aset yang IPO di tengah
periode wajib ditandai "data parsial" di UI.

## 4. Design system

```
--bg-void: #0a0f0d   --bg-panel: #0f1613   --border: #1c2620
--text-primary: #eef2ef   --text-muted: #7f9488
--accent-gold: #c9a24b   --accent-mint: #4ade9e   --down-red: #d9694f
```

Display serif **Fraunces**, body sans **Inter**, angka mono **IBM Plex Mono**.
Elemen ciri khas: **live-pulse dot** mint di sebelah harga yang benar-benar live (kripto saja).
Data near-live memakai label "Diperbarui X lalu" — jangan pura-pura live.
Pola "hero number": angka besar di atas, konteks di bawah. Chart pakai TradingView Lightweight
Charts. Tooltip `(?)` di setiap istilah teknis. Toggle ID/EN & IDR/USD persist di localStorage.
Reduced-motion dihormati.

## 5. Guardrail (WAJIB)

- Disclaimer permanen di footer: alat edukasi & simulasi, **BUKAN nasihat keuangan**, performa
  masa lalu tidak menjamin masa depan.
- **Jangan pernah menampilkan kutipan verbatim atas nama Warren Buffett** atau siapa pun. Value
  Lens dibingkai sebagai "prinsip value investing klasik", bukan "kata Buffett". Narasi berbasis
  aturan tetap, bukan generatif.
- Proyeksi masa depan selalu **rentang skenario**, tidak pernah angka pasti.
- Jangan commit data pribadi apa pun — repo ini publik.

---

## 6. Keputusan implementasi

### Data

- **Dua sumber harga, disambung dengan penskalaan.** TradingView = riwayat (bersih, split-adjusted,
  300 bar bulanan ≈ 25 tahun). Yahoo = penyegaran berkala di CI, karena TradingView Desktop tidak
  bisa jalan di runner. Ekor Yahoo diskalakan ke level TradingView memakai bulan beririsan; rasio
  dicatat di field `seam`. Rasio di luar 0,5–2 ⇒ ekor ditolak (indikasi salah ticker).
  Rasio nyata saat ini 0,997–1,025 (oil 2,5% = selisih spot vs futures, wajar).
- **Bulan bar TradingView TIDAK boleh diambil dari timestamp.** Timestamp = jam buka sesi;
  untuk instrumen 24×5 sesi Oktober dibuka 30 September. Pakai `barTimeToEndOfPeriod()`.
  Script menolak hasil kalau jumlah bulan unik < jumlah bar — kegagalan diam jauh lebih berbahaya
  daripada gagal terang-terangan.
- TradingView me-resolve `NASDAQ:AAPL` → `BATS:AAPL` di paket gratis. Pencocokan simbol harus
  longgar (bandingkan ticker, bukan prefix bursa).
- Hanya dua berkas per aset yang disimpan (`.tv.json`, `.json`). Salinan mentah Yahoo sengaja
  tidak ditulis — akan menulis ulang 25 berkas tiap cron tanpa menambah informasi.

### Perhitungan

- Rumus hidup di `src/lib/finance/` sebagai TypeScript. **Script Node mengimpornya langsung**
  lewat type stripping bawaan Node 24 (karena itu `erasableSyntaxOnly: true` dan import
  antar-modul memakai ekstensi `.ts` eksplisit). Satu sumber kebenaran untuk frontend dan pipeline.
- **XIRR pakai bisection, bukan Newton-Raphson.** Lebih lambat beberapa mikrodetik tapi tidak
  melenceng saat arus kasnya ekstrem — dan aset yang naik 30× persis kasus yang sering muncul di sini.
- Setoran rupiah untuk aset dolar dikonversi memakai kurs bulan yang sama, jadi untung/rugi kurs
  ikut terhitung. Deret harga dikonversi lebih dulu ke IDR, lalu DCA-nya jadi kalkulasi satu mata uang.
- Benchmark (SPX) juga dikonversi ke IDR sebelum menghitung Beta/Alpha — membandingkan hal sejenis.
- Volatilitas portofolio dihitung dari **indeks beli-dan-tahan sintetis berbobot alokasi**, bukan
  dari deret nilai DCA. Deret DCA naik sebagian karena setoran baru, dan itu bukan gejolak pasar.
- Sortino mengembalikan `null` kalau tidak pernah ada bulan di bawah target — bukan angka palsu.
- Proyeksi: titik tengah = XIRR historis, **dibatasi [−10%, +15%]/tahun**; rentang = volatilitas
  historis portofolio (maks 30%). Laju asumsi selalu ditampilkan di layar. Teks catatannya
  kondisional — hanya menyebut "dibatasi" kalau memang kena batas.

### Frontend

- **HashRouter**, bukan BrowserRouter. GitHub Pages statis: `/peringkat` akan 404. Trik 404.html
  merusak tombol Back dan bikin tautan berkedip.
- `data/` di root (bukan `public/`) supaya Actions bisa commit tanpa nyampur aset frontend.
  Plugin Vite kecil di `vite.config.ts` menyajikannya saat dev dan menyalinnya ke `dist/` saat build.
- Simulator menghitung **di sisi klien** dari `data/prices/*.json`, karena JSON pra-hitung hanya
  punya nominal & periode standar — nominal bebas butuh hitung ulang. Modulnya sama, jadi hasilnya
  konsisten dengan halaman Peringkat.
- Bahasa Indonesia adalah bahasa utama di `src/i18n/strings.ts`; Inggris mengikuti.

### Pengujian

Setiap fungsi yang diekspor wajib punya tes, dan suite dijalankan ulang setiap kali ada
perubahan — bukan sekali di akhir. Per audit terakhir: **64/64 fungsi tertutup, 165 tes**.
Fungsi yang gagal secara diam-diam (validator data, konversi mata uang, aritmetika bulan)
diprioritaskan di atas rumus utamanya. Kalau sebuah fungsi hidup di `.mjs` dan sulit diuji,
pindahkan ke modul TypeScript bersama lalu re-export.

Hook React diuji dengan jsdom + Testing Library. `cleanup()` harus dipanggil eksplisit di
`afterEach` — auto-cleanup hanya aktif kalau `globals: true`, dan tanpa itu hook dari tes
sebelumnya terus melakukan polling ke `fetch` global milik tes berikutnya.

### Dividen: SUDAH diperbaiki, sebagai pilihan pengguna

Setiap aset kini punya dua deret (`monthly` = price, `monthlyTotal` = total return) dan dua set
hasil (`periods.price`, `periods.total`). Toggle di header memilih basisnya, bawaannya `total`.
Faktornya dari `adjclose ÷ close` Yahoo per bulan; bulan tanpa data memakai faktor terakhir yang
diketahui, bukan 1 — memakai 1 di tengah deret menciptakan lompatan palsu.

Dampaknya besar: median 10 tahun naik dari 163% ke 209%, dan aset yang untung dari 22/25 jadi
**25/25**. UNTR berpindah dari −4,7% ke +51,8%.

### Return riil

CPI Indonesia dari Bank Dunia (`FP.CPI.TOTL`, tahunan, indeks 2010=100) diinterpolasi geometrik
ke bulanan, diangkurkan ke **pertengahan tahun** karena nilai tahunan adalah rata-rata — anchor
ke Januari menggeser kurva setengah tahun. Setiap setoran dinaikkan ke daya beli bulan terakhir
sebelum dibandingkan; bukan sekadar mengurangi return nominal dengan inflasi rata-rata.

### Temuan awal yang memicu perbaikan di atas

Diukur 10 Agustus 2026 dengan membandingkan seri TradingView terhadap `close` dan `adjclose`
Yahoo pada bulan yang sama:

| Ticker | tv ÷ Yahoo `close` | tv ÷ Yahoo `adjclose` (Sep 2016) |
|---|---|---|
| UNTR | 1,000 | **2,037** |
| BBCA | 1,000 | 1,256 |
| ORCL | 1,000 | 1,161 |
| NVDA | 1,000 | 1,018 |

Artinya seri TradingView identik dengan harga mentah Yahoo (disesuaikan split saja). Catatan
penting untuk sesi berikutnya: **TradingView dan Yahoo bukan dua sumber independen** untuk ticker
ini — nilainya sebagai riwayat panjang yang bersih dan bebas CORS, bukan sebagai cross-check.

### Belum dikerjakan

- Fundamental belum punya API key ⇒ Value Lens menampilkan keadaan kosong yang jujur. Hanya
  pemilik repo yang bisa memasang `FMP_API_KEY` di Secrets. Perlu diketahui: tier gratis FMP dan
  Finnhub praktis tidak meliput ticker `.JK`, jadi realistis hanya 7 saham AS yang akan dapat data.
- Konstituen S&P 500 penuh belum dimuat; strukturnya sudah siap (tambah entry di `assets.json`).
  Kalau jumlah aset melonjak, `rankings.json` perlu dipecah jadi indeks ringkas + detail per aset.
