import { describe, expect, it } from 'vitest';

import {
  binanceStreamUrl,
  deriveFxRate,
  freshnessOf,
  mergeRealtime,
  parseBinanceFrame,
  parseQuoteResponse,
  reconnectDelay,
} from './sources.ts';

const frame = (data: Record<string, unknown>) => JSON.stringify({ stream: 'btcusdt@miniTicker', data });

describe('parseBinanceFrame', () => {
  it('membaca frame miniTicker sungguhan', () => {
    const tick = parseBinanceFrame(
      frame({ e: '24hrMiniTicker', E: 1_786_339_051_015, s: 'BTCUSDT', c: '65020.99000000', o: '64000.00000000' }),
    );
    expect(tick?.symbol).toBe('BTCUSDT');
    expect(tick?.price).toBeCloseTo(65_020.99, 6);
    expect(tick?.changePct).toBeCloseTo(((65_020.99 - 64_000) / 64_000) * 100, 6);
    expect(tick?.at).toBe(1_786_339_051_015);
  });

  it('menerima frame tanpa pembungkus stream', () => {
    const tick = parseBinanceFrame(JSON.stringify({ s: 'ETHUSDT', c: '2140.5', o: '2100', E: 1 }));
    expect(tick?.symbol).toBe('ETHUSDT');
    expect(tick?.price).toBe(2140.5);
  });

  it('menormalkan simbol jadi huruf besar', () => {
    expect(parseBinanceFrame(frame({ s: 'btcusdt', c: '1' }))?.symbol).toBe('BTCUSDT');
  });

  it('mengembalikan null untuk frame yang tidak bisa dipakai', () => {
    // Stream publik boleh mengirim frame kendali atau pesan kesalahan, dan satu
    // frame aneh tidak boleh menjatuhkan seluruh harga di layar.
    expect(parseBinanceFrame('bukan json')).toBeNull();
    expect(parseBinanceFrame('null')).toBeNull();
    expect(parseBinanceFrame('[]')).toBeNull();
    expect(parseBinanceFrame(JSON.stringify({ result: null, id: 1 }))).toBeNull();
    expect(parseBinanceFrame(frame({ s: 'BTCUSDT' }))).toBeNull();
    expect(parseBinanceFrame(frame({ s: 'BTCUSDT', c: '0' }))).toBeNull();
    expect(parseBinanceFrame(frame({ s: 'BTCUSDT', c: '-5' }))).toBeNull();
    expect(parseBinanceFrame(frame({ s: 'BTCUSDT', c: 'abc' }))).toBeNull();
    expect(parseBinanceFrame(frame({ c: '100' }))).toBeNull();
  });

  it('membiarkan changePct null kalau harga pembukanya tidak masuk akal', () => {
    expect(parseBinanceFrame(frame({ s: 'BTCUSDT', c: '100', o: '0' }))?.changePct).toBeNull();
    expect(parseBinanceFrame(frame({ s: 'BTCUSDT', c: '100' }))?.changePct).toBeNull();
  });

  it('memakai waktu sekarang kalau frame tidak membawa stempel waktu', () => {
    const before = Date.now();
    const tick = parseBinanceFrame(frame({ s: 'BTCUSDT', c: '100' }));
    expect(tick?.at).toBeGreaterThanOrEqual(before);
  });
});

describe('reconnectDelay', () => {
  it('tumbuh eksponensial lalu berhenti di batas atas', () => {
    const noJitter = () => 1;
    expect(reconnectDelay(0, 1000, 30_000, noJitter)).toBe(1000);
    expect(reconnectDelay(1, 1000, 30_000, noJitter)).toBe(2000);
    expect(reconnectDelay(3, 1000, 30_000, noJitter)).toBe(8000);
    expect(reconnectDelay(20, 1000, 30_000, noJitter)).toBe(30_000);
  });

  it('selalu menyisipkan jitter minimal separuh', () => {
    // Tanpa jitter, semua tab yang terputus bersamaan akan menyambung ulang pada
    // milidetik yang sama dan menciptakan lonjakan permintaan.
    expect(reconnectDelay(2, 1000, 30_000, () => 0)).toBe(2000);
    expect(reconnectDelay(2, 1000, 30_000, () => 1)).toBe(4000);
  });

  it('tidak pernah negatif meski attempt-nya aneh', () => {
    expect(reconnectDelay(-5, 1000, 30_000, () => 1)).toBe(1000);
  });
});

describe('deriveFxRate', () => {
  it('menurunkan kurs dari aset yang dikutip dua mata uang', () => {
    // Angka nyata dari CoinGecko: BTC $64.947 dan Rp1.157.281.283.
    expect(deriveFxRate(64_947, 1_157_281_283) as number).toBeCloseTo(17_819, 0);
  });

  it('menolak kurs di luar rentang wajar', () => {
    // Kurs yang salah merusak SETIAP angka rupiah di situs sekaligus, jadi lebih
    // baik tidak ada kurs daripada kurs yang meleset.
    expect(deriveFxRate(1, 1)).toBeNull();
    expect(deriveFxRate(1, 1_000_000)).toBeNull();
    expect(deriveFxRate(64_947, 1_157_281)).toBeNull();
  });

  it('menghormati batas yang disetel sendiri', () => {
    expect(deriveFxRate(1, 5000, { min: 1000, max: 10_000 })).toBe(5000);
  });

  it('menolak masukan yang tidak valid', () => {
    expect(deriveFxRate(null, 100)).toBeNull();
    expect(deriveFxRate(100, null)).toBeNull();
    expect(deriveFxRate(0, 100)).toBeNull();
    expect(deriveFxRate(-1, -17_000)).toBeNull();
    expect(deriveFxRate(Number.NaN, 1_000_000)).toBeNull();
  });
});

describe('freshnessOf', () => {
  const now = 1_700_000_000_000;

  it('membedakan live, baru, dan basi', () => {
    expect(freshnessOf(now, now)).toBe('live');
    expect(freshnessOf(now - 30_000, now)).toBe('live');
    expect(freshnessOf(now - 5 * 60_000, now)).toBe('recent');
    expect(freshnessOf(now - 60 * 60_000, now)).toBe('stale');
  });

  it('tepat di ambang masih dihitung kategori yang lebih segar', () => {
    expect(freshnessOf(now - 60_000, now)).toBe('live');
    expect(freshnessOf(now - 60_001, now)).toBe('recent');
    expect(freshnessOf(now - 15 * 60_000, now)).toBe('recent');
    expect(freshnessOf(now - 15 * 60_000 - 1, now)).toBe('stale');
  });

  it('stempel waktu masa depan diperlakukan live, bukan basi', () => {
    // Jam klien bisa meleset beberapa detik dari server; itu bukan alasan
    // menandai harga yang baru saja tiba sebagai kedaluwarsa.
    expect(freshnessOf(now + 5000, now)).toBe('live');
  });

  it('tanpa stempel waktu hasilnya unknown, bukan ditebak live', () => {
    expect(freshnessOf(null, now)).toBe('unknown');
    expect(freshnessOf(undefined, now)).toBe('unknown');
    expect(freshnessOf(Number.NaN, now)).toBe('unknown');
  });
});

describe('binanceStreamUrl', () => {
  it('membangun URL stream gabungan yang terurut dan unik', () => {
    expect(binanceStreamUrl(['BTCUSDT', 'ethusdt', 'BTCUSDT'])).toBe(
      'wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker',
    );
  });

  it('urutan masukan tidak mengubah URL, sehingga hook tidak menyambung ulang sia-sia', () => {
    expect(binanceStreamUrl(['ETHUSDT', 'BTCUSDT'])).toBe(binanceStreamUrl(['BTCUSDT', 'ETHUSDT']));
  });

  it('mengembalikan null kalau tidak ada simbol yang sah', () => {
    expect(binanceStreamUrl([])).toBeNull();
    expect(binanceStreamUrl(['', '  '])).toBeNull();
  });
});

describe('mergeRealtime', () => {
  const now = 1_700_000_000_000;
  const assets = [
    { id: 'btc', binance: 'BTCUSDT', yahoo: 'BTC-USD', lastPriceNative: 60_000, changeMoMPct: 1 },
    { id: 'aapl', binance: null, yahoo: 'AAPL', lastPriceNative: 300, changeMoMPct: 2 },
    { id: 'bbca', binance: null, yahoo: 'BBCA.JK', lastPriceNative: 6375, changeMoMPct: -1 },
  ];
  const ticks = { BTCUSDT: { symbol: 'BTCUSDT', price: 65_000, changePct: 1.5, at: now - 1000 } };
  const quotes = {
    AAPL: { symbol: 'AAPL', price: 313, changePct: 0.8, currency: 'USD', at: now - 120_000 },
  };

  it('tick WebSocket mengalahkan segalanya', () => {
    const merged = mergeRealtime(assets, ticks, quotes, now);
    expect(merged.btc?.source).toBe('binance');
    expect(merged.btc?.price).toBe(65_000);
    expect(merged.btc?.freshness).toBe('live');
  });

  it('kuotasi proxy dipakai kalau tidak ada tick', () => {
    const merged = mergeRealtime(assets, ticks, quotes, now);
    expect(merged.aapl?.source).toBe('proxy');
    expect(merged.aapl?.price).toBe(313);
    expect(merged.aapl?.freshness).toBe('recent');
  });

  it('snapshot dipakai sebagai lapisan terakhir dan TIDAK pernah mengaku segar', () => {
    // Ini pengaman intinya: harga berumur delapan jam tidak boleh mendapat
    // penanda kesegaran yang sama dengan harga yang benar-benar mengalir.
    const merged = mergeRealtime(assets, ticks, quotes, now);
    expect(merged.bbca?.source).toBe('snapshot');
    expect(merged.bbca?.price).toBe(6375);
    expect(merged.bbca?.at).toBeNull();
    expect(merged.bbca?.freshness).toBe('unknown');
  });

  it('mencocokkan simbol Binance tanpa peduli besar-kecil huruf', () => {
    const merged = mergeRealtime(
      [{ id: 'btc', binance: 'btcusdt', yahoo: null, lastPriceNative: 1, changeMoMPct: null }],
      ticks,
      {},
      now,
    );
    expect(merged.btc?.source).toBe('binance');
  });

  it('aset tanpa harga apa pun tidak muncul di hasil', () => {
    const merged = mergeRealtime(
      [{ id: 'kosong', binance: null, yahoo: null, lastPriceNative: null, changeMoMPct: null }],
      {},
      {},
      now,
    );
    expect(merged.kosong).toBeUndefined();
  });

  it('tick basi tetap dipakai tapi ditandai basi, bukan dibuang', () => {
    const stale = { BTCUSDT: { symbol: 'BTCUSDT', price: 64_000, changePct: null, at: now - 3_600_000 } };
    const merged = mergeRealtime(assets, stale, {}, now);
    expect(merged.btc?.price).toBe(64_000);
    expect(merged.btc?.freshness).toBe('stale');
  });

  it('tanpa sumber live sama sekali, semuanya jatuh ke snapshot', () => {
    const merged = mergeRealtime(assets, {}, {}, now);
    expect(Object.values(merged).every((p) => p.source === 'snapshot')).toBe(true);
    expect(Object.keys(merged)).toHaveLength(3);
  });
});

describe('parseQuoteResponse', () => {
  it('membaca baris kuotasi yang sah', () => {
    const rows = parseQuoteResponse({
      quotes: [
        { symbol: 'AAPL', price: 313.33, changePct: 1.2, currency: 'USD', at: 1_700_000_000_000 },
        { symbol: 'BBCA.JK', price: 6375, changePct: -0.5, currency: 'IDR', at: 1_700_000_000_000 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.symbol).toBe('AAPL');
    expect(rows[1]?.currency).toBe('IDR');
  });

  it('membuang baris rusak tapi mempertahankan yang sehat', () => {
    // Proxy boleh gagal sebagian; satu ticker bermasalah tidak boleh menghapus
    // seluruh kuotasi dari layar.
    const rows = parseQuoteResponse({
      quotes: [
        { symbol: 'AAPL', price: 313.33 },
        { symbol: 'RUSAK', price: 0 },
        { symbol: 'RUSAK2', price: 'abc' },
        { price: 100 },
        null,
        'bukan objek',
      ],
    });
    expect(rows.map((r) => r.symbol)).toEqual(['AAPL']);
    expect(rows[0]?.changePct).toBeNull();
  });

  it('mengembalikan array kosong untuk bentuk yang tidak dikenal', () => {
    expect(parseQuoteResponse(null)).toEqual([]);
    expect(parseQuoteResponse({})).toEqual([]);
    expect(parseQuoteResponse({ quotes: 'bukan array' })).toEqual([]);
    expect(parseQuoteResponse([])).toEqual([]);
  });
});
