# Proxy kuotasi (opsional)

Situs ini berjalan penuh **tanpa** worker ini. Fungsinya hanya satu: mengubah harga
saham & komoditas dari "diperbarui beberapa jam lalu" menjadi "diperbarui tadi".

## Kenapa perlu proxy sama sekali

Sudah diuji langsung dari origin situsnya (`https://xyb3rpunq.github.io`):

| Sumber | Bisa dipanggil browser? |
|---|---|
| CoinGecko (kripto) | ✅ |
| Binance WebSocket (kripto) | ✅ |
| `api.frankfurter.dev` (kurs) | ✅ |
| `open.er-api.com` (kurs) | ✅ |
| **Yahoo Finance (saham)** | ❌ diblokir CORS |
| Stooq | ❌ diblokir |
| Proxy CORS publik | ❌ terlalu lambat / tidak andal |

Kripto dan kurs sudah live tanpa apa pun. **Saham tidak bisa**, dan tidak ada
penyedia gratis yang mengizinkannya. Worker ini menutup lubang itu.

## Deploy (gratis, ±3 menit)

Kuota gratis Cloudflare: 100.000 permintaan/hari. Situs ini memakai ±1 permintaan
per pengunjung per menit, dan balasannya di-cache 30 detik di tepi jaringan.

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Hasilnya berupa URL seperti `https://value-terminal-quotes.<akunmu>.workers.dev`.

Lalu tempelkan URL itu ke [`data/live-config.json`](../data/live-config.json):

```json
{ "quoteEndpoint": "https://value-terminal-quotes.contoh.workers.dev" }
```

Commit, dan situs akan langsung memakainya. Kalau nilainya `null`, halaman jatuh
kembali ke data terjadwal dan menyebutnya apa adanya — tidak ada yang rusak.

## Batasan yang perlu diketahui sebelum berharap terlalu banyak

- Yahoo memberi harga **tertunda**, bukan tick. Saham AS umumnya ±15 menit; IDX
  juga tertunda. "Real-time" di sini berarti *diambil saat itu juga*, bukan
  *tanpa jeda bursa*. Data tanpa jeda hanya ada di feed berbayar.
- Di luar jam bursa, harga tidak bergerak. Worker mengembalikan `marketState` dan
  waktu bursa, dan UI memakainya untuk menyebut kondisi sebenarnya.
- Yahoo bisa membatasi laju permintaan. Cache tepi 30 detik dan batas 40 simbol
  per permintaan ada untuk itu.

## Keamanan

- Hanya menerima ticker yang cocok dengan `^[A-Za-z0-9.^=-]{1,15}$`, jadi tidak
  bisa dipakai sebagai proxy terbuka ke URL sembarangan.
- `ALLOWED_ORIGINS` di `wrangler.toml` membatasi siapa yang boleh memanggil.
  Ubah ke domainmu sendiri kalau repo ini di-fork.
- Tidak ada API key, tidak ada penyimpanan, tidak ada data pengguna yang lewat.
