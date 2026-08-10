// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearJsonCache } from '../data.ts';
import type { AssetRecord } from '../data.ts';
import { useBinanceTicker } from './hooks.ts';
import { useRealtime } from './useRealtime.ts';

/**
 * jsdom tidak punya WebSocket, dan menguji lewat jaringan sungguhan akan membuat
 * hasilnya bergantung pada Binance sedang hidup atau tidak. Tiruan ini memberi tes
 * kendali penuh atas urutan open/message/close — termasuk urutan yang sulit
 * direproduksi di dunia nyata, seperti putus tepat sesudah frame pertama.
 */
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }

  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  /** Dipanggil tes, bukan kode produksi. */
  simulateOpen() {
    this.onopen?.();
  }
  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }
  simulateClose() {
    this.onclose?.();
  }
}

const originalWebSocket = globalThis.WebSocket;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  MockWebSocket.reset();
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  // Tanpa ini, konfigurasi dari kasus sebelumnya tetap tersimpan di cache modul
  // dan kasus berikutnya diam-diam memakai jawaban yang salah.
  clearJsonCache();
});

afterEach(() => {
  cleanup();
  globalThis.WebSocket = originalWebSocket;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const frame = (symbol: string, close: string, open?: string) =>
  JSON.stringify({ stream: `${symbol.toLowerCase()}@miniTicker`, data: { s: symbol, c: close, o: open, E: Date.now() } });

describe('useBinanceTicker', () => {
  it('tidak membuka koneksi tanpa simbol', () => {
    const { result } = renderHook(() => useBinanceTicker([]));
    expect(result.current.status).toBe('idle');
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('menyambung lalu melaporkan status live', async () => {
    const { result } = renderHook(() => useBinanceTicker(['BTCUSDT']));
    expect(result.current.status).toBe('connecting');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]?.url).toContain('btcusdt@miniTicker');

    await act(async () => MockWebSocket.instances[0]?.simulateOpen());
    expect(result.current.status).toBe('live');
  });

  it('menerapkan tick dari frame yang masuk', async () => {
    const { result } = renderHook(() => useBinanceTicker(['BTCUSDT', 'ETHUSDT']));
    const ws = MockWebSocket.instances[0] as MockWebSocket;
    await act(async () => {
      ws.simulateOpen();
      ws.simulateMessage(frame('BTCUSDT', '65000', '64000'));
      ws.simulateMessage(frame('ETHUSDT', '2140', '2100'));
    });

    expect(result.current.ticks.BTCUSDT?.price).toBe(65_000);
    expect(result.current.ticks.ETHUSDT?.price).toBe(2140);
    expect(result.current.ticks.BTCUSDT?.changePct).toBeCloseTo(1.5625, 4);
  });

  it('frame rusak diabaikan tanpa menghapus harga yang sudah ada', async () => {
    const { result } = renderHook(() => useBinanceTicker(['BTCUSDT']));
    const ws = MockWebSocket.instances[0] as MockWebSocket;
    await act(async () => {
      ws.simulateOpen();
      ws.simulateMessage(frame('BTCUSDT', '65000'));
      ws.simulateMessage('bukan json');
      ws.simulateMessage(JSON.stringify({ result: null, id: 1 }));
    });

    expect(result.current.ticks.BTCUSDT?.price).toBe(65_000);
    expect(Object.keys(result.current.ticks)).toHaveLength(1);
  });

  it('harga terakhir tetap ditampilkan setelah koneksi putus', async () => {
    // Menghapus harga saat koneksi putus akan membuat layar berkedip kosong tiap
    // kali jaringan tersendat. Yang berubah seharusnya penandanya, bukan angkanya.
    const { result } = renderHook(() => useBinanceTicker(['BTCUSDT']));
    const ws = MockWebSocket.instances[0] as MockWebSocket;
    await act(async () => {
      ws.simulateOpen();
      ws.simulateMessage(frame('BTCUSDT', '65000'));
    });
    await act(async () => ws.simulateClose());

    expect(result.current.status).toBe('offline');
    expect(result.current.ticks.BTCUSDT?.price).toBe(65_000);
  });

  it('menutup socket saat dilepas dan tidak menyambung ulang', async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderHook(() => useBinanceTicker(['BTCUSDT']));
      const ws = MockWebSocket.instances[0] as MockWebSocket;
      unmount();
      expect(ws.closed).toBe(true);

      // Jauh melebihi jeda sambung-ulang terpanjang.
      vi.advanceTimersByTime(120_000);
      expect(MockWebSocket.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('menyambung ulang setelah putus', async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useBinanceTicker(['BTCUSDT']));
      const ws = MockWebSocket.instances[0] as MockWebSocket;
      act(() => ws.simulateClose());

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mengganti koneksi ketika daftar simbolnya berubah', async () => {
    const { rerender } = renderHook(({ symbols }) => useBinanceTicker(symbols), {
      initialProps: { symbols: ['BTCUSDT'] },
    });
    expect(MockWebSocket.instances).toHaveLength(1);

    rerender({ symbols: ['BTCUSDT', 'ETHUSDT'] });
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[0]?.closed).toBe(true);

    // Urutan yang berbeda dengan isi yang sama tidak boleh memicu sambung ulang.
    rerender({ symbols: ['ETHUSDT', 'BTCUSDT'] });
    expect(MockWebSocket.instances).toHaveLength(2);
  });
});

describe('useRealtime', () => {
  const assets = [
    { id: 'btc', binance: 'BTCUSDT', yahoo: 'BTC-USD', lastPriceNative: 60_000, changeMoMPct: 1 },
    { id: 'bbca', binance: null, yahoo: 'BBCA.JK', lastPriceNative: 6375, changeMoMPct: -1 },
  ] as unknown as AssetRecord[];

  const stubFetch = (config: unknown) => {
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('live-config.json')) {
        return { ok: true, status: 200, json: async () => config } as unknown as Response;
      }
      if (url.includes('coingecko')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ bitcoin: { usd: 64_947, idr: 1_157_281_283 } }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => null } as unknown as Response;
    }) as unknown as typeof fetch;
  };

  it('menggabungkan tick kripto dengan snapshot untuk sisanya', async () => {
    stubFetch({ quoteEndpoint: null });
    const { result } = renderHook(() => useRealtime(assets));

    await act(async () => {
      MockWebSocket.instances[0]?.simulateOpen();
      MockWebSocket.instances[0]?.simulateMessage(frame('BTCUSDT', '65000', '64000'));
    });

    expect(result.current.prices.btc?.source).toBe('binance');
    expect(result.current.prices.btc?.price).toBe(65_000);
    // Tanpa proxy, saham jatuh ke snapshot dan TIDAK mengaku segar.
    expect(result.current.prices.bbca?.source).toBe('snapshot');
    expect(result.current.prices.bbca?.freshness).toBe('unknown');
    expect(result.current.quoteEndpointConfigured).toBe(false);
    expect(result.current.quoteStatus).toBe('disabled');
  });

  it('melaporkan endpoint proxy sebagai terkonfigurasi ketika diisi', async () => {
    stubFetch({ quoteEndpoint: 'https://proxy.test/quote', pollSeconds: 60 });
    const { result } = renderHook(() => useRealtime(assets));
    await waitFor(() => expect(result.current.quoteEndpointConfigured).toBe(true));
  });

  it('menyediakan kurs live yang diturunkan dari pasar', async () => {
    stubFetch({ quoteEndpoint: null });
    const { result } = renderHook(() => useRealtime(assets));
    await waitFor(() => expect(result.current.fx.rate).not.toBeNull());
    expect(result.current.fx.source).toBe('crypto-implied');
  });

  it('tidak meledak ketika daftar asetnya belum ada', () => {
    stubFetch({ quoteEndpoint: null });
    const { result } = renderHook(() => useRealtime(undefined));
    expect(result.current.prices).toEqual({});
    expect(result.current.streamStatus).toBe('idle');
  });
});
