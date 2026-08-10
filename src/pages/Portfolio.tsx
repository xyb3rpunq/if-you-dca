import { useEffect, useMemo, useState } from 'react';

import { categoryLabel } from '../components/AssetCard.tsx';
import { GrowthChart } from '../components/GrowthChart.tsx';
import { ErrorState, Explain, LoadingState, Money, PageHeading, Segmented, Stat } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import { useJson } from '../lib/data.ts';
import type { ChartPoint, CorrelationsFile } from '../lib/data.ts';
import { combinePortfolio, convertSeries, simulateDca } from '../lib/finance/dca.ts';
import { addMonths } from '../lib/finance/months.ts';
import { annualizedVolatility, monthlyReturns } from '../lib/finance/risk.ts';
import type { PricePoint } from '../lib/finance/types.ts';
import { formatMoney, formatMonth, formatMultiple, formatPercent, formatRate, toneFor } from '../lib/format.ts';
import { usePriceSeries } from '../lib/usePrices.ts';
import { useRankings } from '../lib/useRankings.ts';

const FX_ID = 'usdidr';
const DEFAULT_BUDGET = 1_800_000;
const DEFAULT_PICKS = ['spx', 'bbca'];
const HORIZONS = [5, 10, 20] as const;

/** Batas atas & bawah proyeksi. Angka historis mentah — misal 67%/tahun dari NVDA —
 *  tidak boleh diekstrapolasi ke depan seolah bisa bertahan puluhan tahun. */
const RATE_FLOOR = -0.1;
const RATE_CEILING = 0.15;
const VOL_CEILING = 0.3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Nilai akhir setoran bulanan tetap pada laju tahunan tertentu. */
function futureValue(monthlyContribution: number, annualRate: number, years: number, startingValue: number): number {
  const i = (1 + annualRate) ** (1 / 12) - 1;
  const n = years * 12;
  const grownStart = startingValue * (1 + i) ** n;
  const contributions = Math.abs(i) < 1e-9 ? monthlyContribution * n : monthlyContribution * (((1 + i) ** n - 1) / i);
  return grownStart + contributions;
}

export function Portfolio() {
  const { lang, t } = useSettings();
  const { rankings, usdRate, error, loading, reload } = useRankings();
  const correlations = useJson<CorrelationsFile>('computed/correlations.json');

  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(10);

  // Pilihan awal 50/50 hanya sebagai titik berangkat yang netral, bukan saran alokasi.
  useEffect(() => {
    if (!rankings || Object.keys(weights).length > 0) return;
    setWeights(Object.fromEntries(DEFAULT_PICKS.map((id) => [id, DEFAULT_BUDGET / DEFAULT_PICKS.length])));
  }, [rankings, weights]);

  const selected = useMemo(() => Object.keys(weights).filter((id) => (weights[id] ?? 0) > 0), [weights]);
  const needed = useMemo(() => [...new Set([...selected, FX_ID])], [selected]);
  const { series } = usePriceSeries(needed);

  const latestMonth = rankings?.latestMonth ?? null;
  const from = latestMonth ? addMonths(latestMonth, -119) : undefined;

  const parts = useMemo(() => {
    if (!rankings || !latestMonth) return [];
    const fx = series[FX_ID]?.monthly ?? null;
    return selected
      .map((id) => {
        const asset = rankings.assets.find((a) => a.id === id);
        const file = series[id];
        if (!asset || !file) return null;
        const result = simulateDca({
          prices: file.monthly,
          fx: asset.quoteCurrency === 'IDR' ? null : fx,
          contribution: weights[id] ?? 0,
          from,
          to: latestMonth,
        });
        return result ? { id, asset, result } : null;
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [rankings, latestMonth, selected, series, weights, from]);

  const combined = useMemo(
    () => (parts.length ? combinePortfolio(parts.map((p) => ({ id: p.id, result: p.result }))) : null),
    [parts],
  );

  /**
   * Volatilitas portofolio dihitung dari indeks beli-dan-tahan sintetis berbobot
   * alokasi, bukan dari deret nilai DCA. Deret DCA naik sebagian karena setoran baru
   * masuk, dan itu bukan gejolak pasar — memakainya akan menyamarkan risiko.
   */
  const portfolioVolatility = useMemo(() => {
    if (!rankings || parts.length === 0) return null;
    const fx = series[FX_ID]?.monthly ?? null;
    const totalWeight = parts.reduce((acc, p) => acc + (weights[p.id] ?? 0), 0);
    if (totalWeight <= 0) return null;

    const normalized = parts.map((p) => {
      const file = series[p.id];
      if (!file) return null;
      const inBase = convertSeries(file.monthly, p.asset.quoteCurrency === 'IDR' ? null : fx).filter(
        (point) => !from || point.m >= from,
      );
      const base = inBase[0]?.c;
      if (!base || base <= 0) return null;
      return { weight: (weights[p.id] ?? 0) / totalWeight, points: new Map(inBase.map((x) => [x.m, x.c / base])) };
    });
    if (normalized.some((n) => n == null)) return null;

    const months = combined?.series.map((s) => s.m) ?? [];
    const index: PricePoint[] = [];
    for (const m of months) {
      let value = 0;
      let covered = 0;
      for (const entry of normalized) {
        const ratio = entry?.points.get(m);
        if (ratio == null || !entry) continue;
        value += entry.weight * ratio;
        covered += entry.weight;
      }
      // Bulan yang belum lengkap datanya di-skala ulang, bukan dianggap sebagian nol.
      if (covered > 0.999) index.push({ m, c: value });
    }
    if (index.length < 13) return null;
    return annualizedVolatility(monthlyReturns(index));
  }, [rankings, parts, series, weights, combined, from]);

  const averageCorrelation = useMemo(() => {
    const matrix = correlations.data?.matrix;
    if (!matrix || selected.length < 2) return null;
    const values: number[] = [];
    for (let i = 0; i < selected.length; i += 1) {
      for (let j = i + 1; j < selected.length; j += 1) {
        const a = selected[i];
        const b = selected[j];
        const value = a && b ? matrix[a]?.[b] : null;
        if (value != null) values.push(value);
      }
    }
    return values.length ? values.reduce((x, y) => x + y, 0) / values.length : null;
  }, [correlations.data, selected]);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!rankings) return null;

  const allocated = selected.reduce((acc, id) => acc + (weights[id] ?? 0), 0);
  const remaining = budget - allocated;
  const chartPoints: ChartPoint[] = (combined?.series ?? []).map((p) => ({
    m: p.m,
    i: Math.round(p.invested),
    v: Math.round(p.value),
  }));

  const rawRate = combined?.xirr ?? 0;
  const centre = clamp(rawRate, RATE_FLOOR, RATE_CEILING);
  const clamped = Math.abs(rawRate - centre) > 1e-9;
  const spread = Math.min(portfolioVolatility ?? 0.15, VOL_CEILING);
  const scenarios = [
    { key: 'pf.pessimistic' as const, rate: centre - spread, tone: 'text-down' },
    { key: 'pf.moderate' as const, rate: centre, tone: 'text-ink' },
    { key: 'pf.optimistic' as const, rate: centre + spread, tone: 'text-mint' },
  ];

  const setWeight = (id: string, value: number) =>
    setWeights((prev) => {
      const next = { ...prev };
      if (value <= 0) delete next[id];
      else next[id] = value;
      return next;
    });

  return (
    <div className="space-y-5">
      <PageHeading title={t('pf.title')} lead={t('pf.lead')} />

      <section className="panel p-4">
        <label className="block max-w-xs">
          <span className="text-xs text-muted">{t('pf.budget')}</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-void px-3 py-2 focus-within:border-gold-dim">
            <span className="text-sm text-muted">Rp</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={100_000}
              value={budget}
              onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
              className="tnum w-full bg-transparent text-sm outline-none"
            />
            <span className="text-xs whitespace-nowrap text-muted">{t('common.perMonth')}</span>
          </div>
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-muted">
            {t('pf.allocation')}: <span className="tnum text-ink">{formatMoney(allocated, 'IDR', lang)}</span>
          </span>
          <span className={remaining < 0 ? 'text-down' : 'text-muted'}>
            {remaining < 0 ? t('pf.overBudget') : t('pf.remaining')}:{' '}
            <span className="tnum">{formatMoney(Math.abs(remaining), 'IDR', lang)}</span>
          </span>
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {rankings.assets
            .filter((a) => a.role !== 'fx')
            .map((asset) => {
              const value = weights[asset.id] ?? 0;
              return (
                <div key={asset.id} className="flex items-center gap-3">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value > 0}
                      onChange={(e) => setWeight(asset.id, e.target.checked ? Math.max(100_000, budget / 4) : 0)}
                      className="size-3.5 accent-[#c9a24b]"
                    />
                    <span className="font-mono text-xs text-ink">{asset.symbol}</span>
                    <span className="truncate text-[11px] text-muted">{categoryLabel(asset.category, lang)}</span>
                  </label>
                  {value > 0 && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={budget}
                        step={50_000}
                        value={Math.min(value, budget)}
                        onChange={(e) => setWeight(asset.id, Number(e.target.value))}
                        aria-label={`${t('pf.allocation')} ${asset.symbol}`}
                        className="w-28 accent-[#c9a24b] sm:w-44"
                      />
                      <span className="tnum w-20 text-right text-xs text-muted">
                        {formatMoney(value, 'IDR', lang)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {!combined && <p className="panel p-6 text-sm text-muted">{t('sim.emptyPick')}</p>}

      {combined && (
        <>
          <section className="panel p-5">
            <div className="text-[11px] tracking-wide text-muted uppercase">
              {lang === 'id' ? 'Kalau rencana ini dijalankan 10 tahun terakhir' : 'If this plan ran for the last 10 years'}
            </div>
            <div className="mt-1">
              <Money idr={combined.currentValue} size="hero" tone={toneFor(combined.totalReturnPct)} />
            </div>
            <div className="mt-2 text-sm text-muted">
              {lang === 'id' ? 'dari setoran' : 'from'}{' '}
              <span className="tnum text-ink">{formatMoney(combined.totalInvested, 'IDR', lang)}</span> ·{' '}
              {formatMonth(combined.from, lang)} – {formatMonth(combined.to, lang)}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              <Stat label={t('metric.return')} value={formatPercent(combined.totalReturnPct)} tone={toneFor(combined.totalReturnPct)} termKey="totalReturn" />
              <Stat label={t('metric.multiple')} value={formatMultiple(combined.multiple)} termKey="multiple" />
              <Stat label={t('metric.xirr')} value={formatRate(combined.xirr)} tone={toneFor(combined.xirr)} termKey="xirr" />
              <Stat label={t('metric.volatility')} value={formatRate(portfolioVolatility, 0, false)} termKey="volatility" />
            </div>
          </section>

          <section className="panel p-4">
            <GrowthChart points={chartPoints} usdRate={usdRate} height={260} />
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center text-base">
              {t('pf.diversification')}
              <Explain termKey="correlation" />
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {averageCorrelation == null
                ? lang === 'id'
                  ? 'Pilih minimal dua aset untuk melihat seberapa mirip gerakannya.'
                  : 'Pick at least two assets to see how similarly they move.'
                : t(
                    averageCorrelation > 0.7 ? 'pf.corrHigh' : averageCorrelation > 0.4 ? 'pf.corrMedium' : 'pf.corrLow',
                    { value: averageCorrelation.toFixed(2) },
                  )}
            </p>
          </section>

          <section className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base">{t('pf.scenarios')}</h2>
              <Segmented<string>
                ariaLabel={t('pf.scenarios')}
                value={String(horizon)}
                onChange={(v) => setHorizon(Number(v) as (typeof HORIZONS)[number])}
                options={HORIZONS.map((y) => ({ value: String(y), label: `${y}${lang === 'id' ? ' thn' : 'y'}` }))}
              />
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">{t('pf.scenarioLead')}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {scenarios.map((scenario) => (
                <div key={scenario.key} className="rounded-lg border border-line bg-void/50 p-4">
                  <div className="text-[11px] tracking-wide text-muted uppercase">{t(scenario.key)}</div>
                  <div className="mt-1.5">
                    <Money
                      idr={futureValue(allocated, scenario.rate, horizon, combined.currentValue)}
                      size="md"
                      tone={scenario.tone}
                    />
                  </div>
                  {/* Laju yang dipakai selalu ditampilkan — angka proyeksi tanpa asumsinya
                      hanyalah tebakan yang terlihat pasti. */}
                  <div className="tnum mt-1 text-[11px] text-muted">
                    {lang === 'id' ? 'asumsi' : 'assumes'} {formatRate(scenario.rate)}/{lang === 'id' ? 'thn' : 'yr'}
                  </div>
                </div>
              ))}
            </div>

            {/* Catatan menyesuaikan keadaan: menyebut "dibatasi" saat tidak ada yang
                dibatasi justru membuat pembaca salah paham soal angkanya sendiri. */}
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
              {clamped
                ? lang === 'id'
                  ? `Hasil historis portofolio ini ${formatRate(combined.xirr)}/tahun, dan itu sengaja TIDAK dipakai apa adanya untuk proyeksi — titik tengahnya dipotong ke ${formatRate(centre)}/tahun. Return setinggi itu memang pernah terjadi, tapi memproyeksikannya lurus ke depan selama ${horizon} tahun menghasilkan angka yang menyesatkan.`
                  : `This portfolio returned ${formatRate(combined.xirr)}/year historically, and that is deliberately NOT carried forward — the midpoint is cut to ${formatRate(centre)}/year. Returns that high have happened, but extrapolating them straight out for ${horizon} years produces misleading numbers.`
                : lang === 'id'
                  ? `Titik tengah memakai hasil historis portofolio ini apa adanya (${formatRate(centre)}/tahun), dibatasi maksimum ${(RATE_CEILING * 100).toFixed(0)}%/tahun kalau lebih tinggi dari itu. Rentang atas-bawahnya berasal dari volatilitas historis portofolio ini sendiri, bukan dari asumsi luar.`
                  : `The midpoint uses this portfolio's own historical return as-is (${formatRate(centre)}/year), capped at ${(RATE_CEILING * 100).toFixed(0)}%/year if it were higher. The spread above and below comes from this portfolio's own historical volatility, not from outside assumptions.`}
            </p>
          </section>

          <section className="panel overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-base">{t('sim.breakdown')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="px-4 py-2 font-medium">{t('rank.asset')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('pf.allocation')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.invested')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.value')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('metric.return')}</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(({ id, asset, result }) => (
                    <tr key={id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">{asset.symbol}</td>
                      <td className="tnum px-3 py-2.5 text-right text-muted">
                        {allocated > 0 ? `${(((weights[id] ?? 0) / allocated) * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Money idr={result.totalInvested} size="sm" align="right" tone="text-muted" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Money idr={result.currentValue} size="sm" align="right" />
                      </td>
                      <td className={`tnum px-4 py-2.5 text-right ${toneFor(result.totalReturnPct)}`}>
                        {formatPercent(result.totalReturnPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
