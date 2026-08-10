import { useMemo } from 'react';

import { useJson } from '../data.ts';
import type { AssetRecord } from '../data.ts';
import { useBinanceTicker, useLiveFx, useLiveQuotes } from './hooks.ts';
import { mergeRealtime } from './sources.ts';
import type { LivePrice } from './sources.ts';

export interface LiveConfig {
  quoteEndpoint: string | null;
  pollSeconds?: number;
}

/**
 * Satu titik masuk untuk seluruh data live di halaman.
 *
 * Menggabungkan tiga lapisan dengan tingkat kesegaran yang jujur berbeda:
 *   1. WebSocket Binance — kripto, benar-benar tick-level
 *   2. Proxy kuotasi — saham & komoditas, hanya kalau worker-nya dipasang
 *   3. Snapshot terjadwal — selalu ada sebagai dasar
 *
 * Yang penting bukan hanya memilih angka termuda, tapi membawa serta asal-usulnya
 * sampai ke layar. Tanpa itu, halaman akan terlihat sama-sama "live" untuk harga
 * Bitcoin detik ini dan harga saham semalam.
 */
export function useRealtime(assets: readonly AssetRecord[] | undefined) {
  const { data: config } = useJson<LiveConfig>('live-config.json');

  const binanceSymbols = useMemo(
    () => (assets ?? []).map((a) => a.binance).filter((s): s is string => Boolean(s)),
    [assets],
  );
  const quoteSymbols = useMemo(
    () => (assets ?? []).filter((a) => !a.binance).map((a) => a.yahoo).filter((s): s is string => Boolean(s)),
    [assets],
  );

  const { ticks, status: streamStatus } = useBinanceTicker(binanceSymbols);
  const quotes = useLiveQuotes(
    config?.quoteEndpoint ?? null,
    quoteSymbols,
    (config?.pollSeconds ?? 60) * 1000,
  );
  const fx = useLiveFx();

  // Sengaja dihitung ulang tiap render, bukan di-memo pada `ticks`: tick baru datang
  // beberapa kali per detik dan hasil gabungannya harus ikut bergerak.
  const prices: Record<string, LivePrice> = mergeRealtime(assets ?? [], ticks, quotes.quotes, Date.now());

  return {
    prices,
    fx,
    streamStatus,
    quoteStatus: quotes.status,
    quoteEndpointConfigured: Boolean(config?.quoteEndpoint),
  };
}
