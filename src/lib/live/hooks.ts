import { useEffect, useMemo, useRef, useState } from 'react';

import {
  binanceStreamUrl,
  deriveFxRate,
  parseBinanceFrame,
  parseQuoteResponse,
  reconnectDelay,
} from './sources.ts';
import type { QuoteRow, Tick } from './sources.ts';

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'offline';

/**
 * Harga kripto tick-level lewat WebSocket Binance.
 *
 * Ini satu-satunya data di situs ini yang benar-benar real-time dalam arti harfiah:
 * server mendorong setiap perubahan, tidak ada polling. Sengaja memakai stream
 * publik tanpa autentikasi supaya tetap bisa jalan dari halaman statis.
 *
 * Kalau koneksi putus, ia menyambung ulang dengan jeda menaik dan harga terakhir
 * tetap ditampilkan — dengan penanda kesegaran yang berubah, bukan dihapus.
 */
export function useBinanceTicker(symbols: readonly string[]) {
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [status, setStatus] = useState<StreamStatus>('idle');
  const url = useMemo(() => binanceStreamUrl(symbols), [symbols]);

  useEffect(() => {
    if (!url || typeof WebSocket === 'undefined') {
      setStatus('idle');
      return;
    }

    let alive = true;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (!alive) return;
      setStatus('connecting');
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleRetry();
        return;
      }

      socket.onopen = () => {
        if (!alive) return;
        attempt = 0;
        setStatus('live');
      };
      socket.onmessage = (event) => {
        if (!alive) return;
        const tick = parseBinanceFrame(typeof event.data === 'string' ? event.data : '');
        if (tick) setTicks((prev) => ({ ...prev, [tick.symbol]: tick }));
      };
      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          /* penutupan gagal tidak mengubah apa pun — retry tetap dijadwalkan */
        }
      };
      socket.onclose = () => {
        if (!alive) return;
        setStatus('offline');
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (!alive) return;
      timer = setTimeout(() => {
        attempt += 1;
        connect();
      }, reconnectDelay(attempt));
    };

    connect();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        /* komponen sedang dilepas; kegagalan menutup tidak relevan */
      }
    };
  }, [url]);

  return { ticks, status };
}

export interface LiveFx {
  rate: number | null;
  at: number | null;
  source: 'crypto-implied' | 'ecb-reference' | null;
}

const FX_BOUNDS = { min: 8000, max: 25_000 };

/**
 * Kurs USD/IDR yang benar-benar diambil saat halaman dibuka.
 *
 * Sumber utamanya tidak biasa tapi masuk akal: CoinGecko bisa mengutip Bitcoin dalam
 * USD dan IDR sekaligus, dan rasionya adalah kurs yang berlaku saat itu — jauh lebih
 * segar daripada kurs referensi bank sentral yang hanya terbit sekali sehari.
 * Kalau gagal, ia turun ke kurs referensi ECB, dan sumbernya selalu disebutkan
 * supaya pembaca tahu angka mana yang sedang dipakai.
 */
export function useLiveFx(intervalMs = 120_000): LiveFx {
  const [state, setState] = useState<LiveFx>({ rate: null, at: null, source: null });

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    const readImplied = async (): Promise<LiveFx | null> => {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,idr',
        { signal: controller.signal },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { bitcoin?: { usd?: number; idr?: number } };
      const rate = deriveFxRate(json?.bitcoin?.usd, json?.bitcoin?.idr, FX_BOUNDS);
      return rate == null ? null : { rate, at: Date.now(), source: 'crypto-implied' };
    };

    const readReference = async (): Promise<LiveFx | null> => {
      const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR', {
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { rates?: { IDR?: number } };
      const rate = json?.rates?.IDR;
      if (!Number.isFinite(rate) || (rate as number) < FX_BOUNDS.min || (rate as number) > FX_BOUNDS.max) return null;
      return { rate: rate as number, at: Date.now(), source: 'ecb-reference' };
    };

    const tick = async () => {
      for (const read of [readImplied, readReference]) {
        try {
          const next = await read();
          if (next && alive) {
            setState(next);
            return;
          }
        } catch {
          // Sumber berikutnya dicoba; kegagalan total membiarkan kurs terakhir
          // tetap terpakai daripada mengosongkan seluruh angka rupiah.
        }
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [intervalMs]);

  return state;
}

export interface LiveQuotes {
  quotes: Record<string, QuoteRow>;
  at: number | null;
  status: 'disabled' | 'loading' | 'live' | 'error';
}

/**
 * Kuotasi saham & komoditas lewat proxy yang dikelola sendiri.
 *
 * Tidak ada penyedia harga saham gratis yang mengizinkan CORS, jadi ini SATU-SATUNYA
 * jalan mendapatkan harga saham langsung di browser dari situs statis. Tanpa endpoint
 * yang dikonfigurasi, hook ini diam dan halaman jatuh ke data terjadwal — yang tetap
 * benar, hanya lebih lama. Lihat `worker/README.md`.
 */
export function useLiveQuotes(
  endpoint: string | null | undefined,
  symbols: readonly string[],
  intervalMs = 60_000,
): LiveQuotes {
  const [state, setState] = useState<LiveQuotes>({ quotes: {}, at: null, status: 'disabled' });
  const key = useMemo(() => [...new Set(symbols)].sort().join(','), [symbols]);
  const endpointRef = useRef(endpoint);
  endpointRef.current = endpoint;

  useEffect(() => {
    if (!endpoint || !key) {
      setState((prev) => ({ ...prev, status: 'disabled' }));
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'loading' }));

    const tick = async () => {
      try {
        const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}symbols=${encodeURIComponent(key)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = parseQuoteResponse(await res.json());
        if (!alive) return;
        if (rows.length === 0) {
          setState((prev) => ({ ...prev, status: 'error' }));
          return;
        }
        setState({
          quotes: Object.fromEntries(rows.map((r) => [r.symbol, r])),
          at: Date.now(),
          status: 'live',
        });
      } catch (err) {
        if (alive && (err as Error).name !== 'AbortError') {
          setState((prev) => ({ ...prev, status: 'error' }));
        }
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [endpoint, key, intervalMs]);

  return state;
}
