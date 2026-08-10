# Value Terminal

**Kalau kamu rutin nabung tiap bulan, sekarang jadi berapa?**

Dashboard open-source untuk menyimulasikan **Dollar-Cost Averaging (DCA)** pada harga historis
sungguhan — saham AS, saham IDX, kripto, komoditas, dan kurs — dari sudut pandang investor
berbasis rupiah. Statis, gratis dijalankan, di-deploy dari GitHub.

🔗 **https://xyb3rpunq.github.io/if-you-dca/**

> ⚠️ **Ini alat edukasi & simulasi, BUKAN nasihat keuangan.** Semua angka berasal dari data
> historis. Performa masa lalu tidak menjamin hasil masa depan — terutama untuk aset volatil
> seperti kripto. Tidak ada rekomendasi beli/jual di mana pun dalam proyek ini.

---

## Apa yang ada di dalamnya

| Halaman | Isi |
|---|---|
| **Dashboard** | Kondisi pasar, hasil terbaik & terburuk berdampingan, harga kripto live |
| **Simulator DCA** | Nominal bebas, preset durasi **atau rentang tanggal bebas**, multi-aset, grafik nilai vs setoran, hasil bisa dibagikan lewat URL |
| **Peringkat** | Seluruh aset, sortir per kolom, filter kategori, statistik ringkas |
| **Value Lens** | Rasio fundamental lewat saringan Graham + Graham Number + margin of safety |
| **Rencana Saya** | Alokasi budget multi-aset, cek diversifikasi, rentang skenario ke depan |
| **Istilah** | Semua jargon dijelaskan dengan bahasa sehari-hari |

Semuanya dwibahasa (ID/EN). Setiap jumlah uang ditampilkan **dalam rupiah dan dolar sekaligus** —
toggle di header hanya memilih mana yang tampil besar, bukan menyembunyikan yang lain. Preferensi
tersimpan di `localStorage`.

## Arsitektur

GitHub Pages hanya menyajikan berkas statis — tidak ada tempat menyembunyikan API key dan tidak
ada yang bisa mem-bypass CORS. Solusinya memindahkan semua pekerjaan berat ke waktu build:

```
GitHub Actions (cron)  →  data/*.json (di-commit)  →  GitHub Pages (statis)
   ambil harga                                            baca JSON, render
   hitung DCA                                                    │
   API key di Secrets                                     browser juga fetch
                                                          CoinGecko langsung
                                                          untuk kripto live
```

**Tiga tingkat kesegaran data, dan UI menyebutnya apa adanya:**

| Data | Sumber | Kesegaran | Ditandai sebagai |
|---|---|---|---|
| Harga kripto | CoinGecko, dari browser | tiap 60 detik | titik mint berdenyut |
| Saham, komoditas, kurs | Yahoo Finance, via cron | beberapa jam | "Diperbarui 3 jam lalu" |
| Riwayat bulanan | TradingView, snapshot manual | saat di-refresh manual | tercatat di tiap berkas |

Tidak ada yang berpura-pura real-time kalau bukan real-time.

### Kenapa dua sumber harga?

Riwayat panjangnya diambil dari **TradingView Desktop** karena datanya bersih dan sudah
disesuaikan split. Tapi TradingView Desktop tidak bisa hidup di runner GitHub Actions, jadi
penyegaran berkalanya memakai **Yahoo Finance** lewat HTTP.

Dua sumber tidak boleh disambung mentah-mentah: spot emas (`TVC:GOLD`) dan futures emas (`GC=F`)
berbeda beberapa dolar, dan sambungan langsung akan tampak seperti lompatan harga yang tidak
pernah terjadi. `fetch-prices.mjs` karena itu menskalakan ekor Yahoo ke level TradingView memakai
bulan yang beririsan, lalu mencatat rasionya di field `seam` tiap berkas. Rasio di luar rentang
0,5–2 dianggap salah ticker dan ekornya ditolak.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:5174. Data sudah ikut di dalam repo, jadi tidak perlu mengambil apa pun
untuk mulai bekerja.

```bash
npm test          # unit test rumus keuangan (45 test)
npm run build     # build produksi ke dist/
npm run typecheck
```

## Memperbarui data

```bash
npm run data:fetch      # ambil harga dari Yahoo + gabungkan dengan snapshot TradingView
npm run data:compute    # hitung ulang seluruh simulasi DCA
npm run data:all        # keduanya + fundamental
```

Di GitHub, `.github/workflows/refresh-data.yml` menjalankan ini terjadwal (10.30 & 22.00 WIB)
dan mem-*commit* hasilnya. Bisa juga dipicu manual dari tab **Actions**.

### Menarik ulang riwayat dari TradingView

Ini langkah **lokal** dan opsional — hanya perlu kalau menambah aset baru atau ingin memperpanjang
riwayat. Butuh aplikasi TradingView Desktop terpasang.

1. Jalankan TradingView Desktop dengan remote debugging aktif (port 9222), lalu buka satu chart.
2. `npm run data:tv` — atau `npm run data:tv -- --only=aapl,btc` untuk sebagian aset saja.

Script menyambung ke aplikasi lewat Chrome DevTools Protocol, mengganti simbol satu per satu,
dan membaca bar bulanan langsung dari model chart-nya. Hasilnya ditulis ke `data/prices/*.tv.json`.

<details>
<summary>Kenapa lewat CDP, bukan API?</summary>

TradingView tidak punya API historis gratis, dan `exportData()` di aplikasi desktop dikunci
("Data export is not supported") pada paket non-berbayar. Tapi bar yang sudah dimuat ke chart
bisa dibaca dari `mainSeries().bars()`.

Satu jebakan penting: timestamp bar bulanan adalah **jam buka sesi**, dan untuk instrumen 24×5
(forex, CFD komoditas) sesi bulan Oktober dibuka Minggu malam **30 September**. Dipetakan
mentah-mentah, sekitar 80 dari 300 bar menabrak bulan tetangganya. Script memakai
`barTimeToEndOfPeriod()` untuk mendapatkan bulan yang benar, dan menolak hasil apa pun yang
jumlah bulan uniknya menyusut dari jumlah barnya.
</details>

## Menambah aset baru

Cukup tambahkan satu entry di [`data/assets.json`](data/assets.json) — tidak ada kode yang perlu
diubah:

```json
{
  "id": "tlkm",
  "symbol": "TLKM",
  "name": "Telkom Indonesia",
  "category": "id-stock",
  "quoteCurrency": "IDR",
  "tags": ["blue-chip"],
  "tv": "IDX:TLKM",
  "yahoo": "TLKM.JK",
  "fundamentals": "TLKM.JK"
}
```

Lalu jalankan `npm run data:tv -- --only=tlkm && npm run data:all`. Struktur ini juga menampung
seluruh konstituen S&P 500 tanpa perubahan kode.

Field opsional: `listedSince` (penanda data parsial), `coingecko` (mengaktifkan harga live),
`sanity: { min, max }` (rentang wajar untuk pemeriksaan anomali), `role` (`fx` atau `benchmark`).

## Data fundamental (opsional)

Value Lens butuh API key gratis. Tanpa key, situs tetap berjalan penuh dan halaman itu
menampilkan keadaan kosong yang jujur — bukan angka karangan.

1. Daftar gratis di [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs)
   (atau [Finnhub](https://finnhub.io/)).
2. **Settings → Secrets and variables → Actions → New repository secret**
3. Nama: `FMP_API_KEY` (atau `FINNHUB_API_KEY`), isi dengan key-nya.
4. Jalankan ulang workflow **Segarkan data pasar**.

Key hanya dibaca di dalam Actions. Tidak pernah masuk ke kode frontend.

## Validasi data

Data pasar gratis bisa rusak dengan cara yang diam-diam merusak semua hitungan di atasnya. Seri
USD/IDR pernah memuat nilai `1.34` di tengah deret belasan ribu — satu titik seperti itu cukup
untuk melipatgandakan hasil DCA secara keliru.

Karena itu `sanitizeMonthly()` menolak nilai di luar rentang wajar per aset dan lonjakan satu
titik yang langsung berbalik, lalu menambalnya lewat interpolasi linier. Setiap perbaikan tercatat
di `data/computed/meta.json`, jadi tidak ada yang diperbaiki diam-diam.

## Metodologi

- Simulasi memakai **harga penutupan bulanan**, konsisten dengan "beli tiap bulan di tanggal yang sama".
- Setoran rupiah untuk aset dolar dikonversi memakai **kurs bulan itu juga**, jadi untung/rugi
  nilai tukar ikut terhitung — inilah yang benar-benar dialami investor rupiah.
- **XIRR** ditampilkan berdampingan dengan Total Return. Total Return lebih mudah dipahami, tapi
  menyesatkan untuk membandingkan periode yang panjangnya berbeda; XIRR memperhitungkan kapan tiap
  setoran masuk.
- Aset yang listing di tengah periode diberi badge **"Data parsial"** dengan bulan mulainya.
- Bulan berjalan yang belum tutup ditandai `lastMonthIsPartial`.
- Beta & Alpha memakai benchmark **S&P 500 yang juga dikonversi ke rupiah**, supaya membandingkan
  hal yang sejenis.
- Proyeksi ke depan selalu berupa **rentang skenario**, tidak pernah angka tunggal, dan laju
  asumsinya selalu ditampilkan. Titik tengahnya dibatasi maksimum 15%/tahun.

Seluruh rumus ada di [`src/lib/finance/`](src/lib/finance/) sebagai pure function bertipe, dengan
45 unit test. Script pipeline **mengimpor modul yang sama** lewat type stripping bawaan Node 24 —
satu sumber kebenaran, tidak ada rumus yang di-copy dua kali.

## Struktur repo

```
├── .github/workflows/     refresh-data.yml (cron) & deploy.yml (Pages)
├── data/
│   ├── assets.json        daftar aset — satu-satunya tempat menambah ticker
│   ├── prices/            {id}.tv.json (snapshot) & {id}.json (gabungan)
│   └── computed/          rankings, dca per aset, korelasi, meta, fundamental
├── scripts/
│   ├── fetch-tradingview.mjs   lokal, lewat CDP
│   ├── fetch-prices.mjs        CI, Yahoo Finance + penggabungan
│   ├── compute-dca.mjs         semua simulasi
│   └── compute-fundamentals.mjs
└── src/
    ├── lib/finance/       semua rumus + unit test
    ├── components/  i18n/  pages/  styles/
```

## Batasan yang diketahui

- Harga saham tertinggal beberapa jam. Feed real-time untuk saham berbayar, dan proyek ini
  memilih jujur soal itu daripada memasang label "live" yang keliru.
- Riwayat TradingView terbatas 300 bar bulanan (±25 tahun) — cukup untuk seluruh periode di sini.
- **Dividen belum dihitung.** Seri harga sudah disesuaikan split tapi bukan dividen, jadi semua
  angka di sini adalah *price return*, bukan *total return*. Untuk saham dividen tinggi selisihnya
  besar: diukur terhadap `adjclose` Yahoo, dividen UNTR selama 10 tahun setara ~104% dari harga
  sahamnya, BBCA ~26%, ORCL ~16%. Saham yang tidak membagi dividen (NVDA ~2%) nyaris tidak
  terpengaruh. Ini koreksi yang direncanakan berikutnya.
- Simulasi juga mengabaikan biaya broker dan pajak. Hasil nyata akan sedikit lebih rendah.
- Graham Number tidak berlaku untuk perusahaan merugi, dan cenderung menyebut perusahaan
  perangkat lunak "kemahalan" karena aset utamanya tidak ada di neraca.

### Kalau nanti butuh saham real-time (Fase 2)

Upgrade termudah adalah **Cloudflare Pages Functions** — tetap deploy dari GitHub, tetap gratis,
tapi dapat serverless function untuk mem-proxy Yahoo Finance tanpa masalah CORS. Frontend-nya
tidak perlu diubah; cukup ganti sumber `dataUrl()` untuk harga terkini.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
