import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, LineSeries, createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';

import { useSettings } from '../i18n/context.tsx';
import type { ChartPoint } from '../lib/data.ts';
import { formatMoney } from '../lib/format.ts';

export interface GrowthChartProps {
  points: readonly ChartPoint[];
  /** Kurs untuk menampilkan nilai dalam USD; tidak dipakai saat mata uang IDR. */
  usdRate?: number | null;
  height?: number;
}

/**
 * Grafik pertumbuhan portofolio: garis nilai vs garis setoran.
 *
 * Dua garis ini yang sebenarnya menjelaskan DCA. Jarak vertikal di antaranya ADALAH
 * keuntungannya, dan momen ketika garis nilai menyeberang ke bawah garis setoran
 * adalah momen ketika investornya rugi — jauh lebih terbaca daripada satu garis harga.
 */
export function GrowthChart({ points, usdRate, height = 260 }: GrowthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const valueRef = useRef<ISeriesApi<'Area'> | null>(null);
  const investedRef = useRef<ISeriesApi<'Line'> | null>(null);
  const { lang, currency, t } = useSettings();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#7f9488',
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1c2620', style: 1 },
      },
      rightPriceScale: { borderColor: '#1c2620', scaleMargins: { top: 0.12, bottom: 0.06 } },
      timeScale: { borderColor: '#1c2620', fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        vertLine: { color: '#2a3830', width: 1, style: 2, labelBackgroundColor: '#131c18' },
        horzLine: { color: '#2a3830', width: 1, style: 2, labelBackgroundColor: '#131c18' },
      },
      handleScale: false,
      handleScroll: false,
    });

    investedRef.current = chart.addSeries(LineSeries, {
      color: '#4a5b52',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    valueRef.current = chart.addSeries(AreaSeries, {
      lineColor: '#c9a24b',
      topColor: 'rgba(201, 162, 75, 0.22)',
      bottomColor: 'rgba(201, 162, 75, 0.01)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      valueRef.current = null;
      investedRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !valueRef.current || !investedRef.current) return;

    const divisor = currency === 'USD' && usdRate ? usdRate : 1;
    const toData = (pick: (p: ChartPoint) => number): LineData<Time>[] =>
      points.map((p) => ({ time: `${p.m}-01` as Time, value: pick(p) / divisor }));

    valueRef.current.setData(toData((p) => p.v));
    investedRef.current.setData(toData((p) => p.i));

    // Sumbu harga diformat sesuai bahasa & mata uang aktif, bukan angka mentah —
    // "Rp3,5 mrd" pada label sumbu jauh lebih cepat dibaca daripada 3500000000.
    chart.applyOptions({
      localization: {
        priceFormatter: (value: number) => formatMoney(value * divisor, currency, lang),
      },
    });
    chart.timeScale().fitContent();
  }, [points, currency, usdRate, lang]);

  return (
    <figure className="m-0">
      <div ref={containerRef} className="w-full" style={{ height }} />
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-gold" aria-hidden />
          {t('sim.chartValue')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-[#4a5b52]" aria-hidden />
          {t('sim.chartInvested')}
        </span>
      </figcaption>
    </figure>
  );
}
