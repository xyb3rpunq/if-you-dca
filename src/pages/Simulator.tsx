import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { GrowthChart } from '../components/GrowthChart.tsx';
import { categoryLabel } from '../components/AssetCard.tsx';
import { Badge, ErrorState, Explain, LoadingState, Money, PageHeading, Segmented, Stat } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import type { AssetRecord, ChartPoint } from '../lib/data.ts';
import { combinePortfolio, convertSeries, simulateDca } from '../lib/finance/index.ts';
import type { DcaResult } from '../lib/finance/index.ts';
import { realMetrics } from '../lib/finance/inflation.ts';
import { addMonths, monthsBetween } from '../lib/finance/months.ts';
import { useDeflators } from '../lib/useInflation.ts';
import {
  formatMoney,
  formatMonth,
  formatMultiple,
  formatPercent,
  formatPrice,
  formatRate,
  formatRatio,
  toneFor,
} from '../lib/format.ts';
import { seriesFor, usePriceSeries } from '../lib/usePrices.ts';
import { useRankings } from '../lib/useRankings.ts';

const PRESETS = [
  { key: '1y', months: 12 },
  { key: '3y', months: 36 },
  { key: '5y', months: 60 },
  { key: '10y', months: 120 },
  { key: 'max', months: null },
] as const;

type PresetKey = (typeof PRESETS)[number]['key'] | 'custom';

const FX_ID = 'usdidr';
const BENCHMARK_ID = 'spx';

/** Rentang minimal yang masih bisa disimulasikan: dua setoran. */
const MIN_MONTHS = 2;

export function Simulator() {
  const { lang, basis, t } = useSettings();
  const { rankings, usdRate, error, loading, reload } = useRankings();
  const [params, setParams] = useSearchParams();

  const [selected, setSelected] = useState<string[]>(() => {
    const raw = params.get('aset');
    return raw ? raw.split(',').filter(Boolean) : ['spx'];
  });
  const [amount, setAmount] = useState(() => Number(params.get('jumlah') ?? 900_000));
  const [customFrom, setCustomFrom] = useState(() => params.get('dari') ?? '');
  const [customTo, setCustomTo] = useState(() => params.get('sampai') ?? '');
  const [preset, setPreset] = useState<PresetKey>(() => {
    // URL yang membawa dari/sampai selalu berarti rentang bebas, apa pun isi `periode`.
    if (params.get('dari') || params.get('sampai')) return 'custom';
    return (params.get('periode') as PresetKey) ?? '10y';
  });
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Seluruh keadaan simulasi hidup di URL, jadi hasilnya bisa dibagikan apa adanya
  // tanpa backend apa pun — cukup salin alamatnya.
  useEffect(() => {
    const next = new URLSearchParams();
    if (selected.length) next.set('aset', selected.join(','));
    next.set('jumlah', String(amount));
    next.set('periode', preset);
    if (preset === 'custom') {
      if (customFrom) next.set('dari', customFrom);
      if (customTo) next.set('sampai', customTo);
    }
    setParams(next, { replace: true });
  }, [selected, amount, preset, customFrom, customTo, setParams]);

  // Benchmark ikut dimuat supaya Beta & Alpha bisa dihitung di sisi klien; tanpa itu
  // kedua metrik hanya menampilkan em dash dan kolomnya jadi sia-sia.
  const needed = useMemo(() => [...new Set([...selected, FX_ID, BENCHMARK_ID])], [selected]);
  const { series, loading: pricesLoading, error: pricesError } = usePriceSeries(needed);

  const latestMonth = rankings?.latestMonth ?? null;

  /** Bulan terawal yang punya data di antara aset yang sedang dipilih. */
  const earliestMonth = useMemo(() => {
    if (!rankings) return null;
    const months = selected
      .map((id) => rankings.assets.find((a) => a.id === id)?.dataFrom)
      .filter((m): m is string => Boolean(m));
    return months.length ? months.reduce((a, b) => (a < b ? a : b)) : null;
  }, [rankings, selected]);

  const range = useMemo(() => {
    if (!latestMonth) return null;
    if (preset === 'custom') {
      const from = customFrom || earliestMonth || latestMonth;
      const to = customTo || latestMonth;
      return { from, to, valid: monthsBetween(from, to) >= MIN_MONTHS - 1 };
    }
    const months = PRESETS.find((p) => p.key === preset)?.months ?? null;
    return {
      from: months == null ? undefined : addMonths(latestMonth, -(months - 1)),
      to: latestMonth,
      valid: true,
    };
  }, [preset, customFrom, customTo, earliestMonth, latestMonth]);

  const results = useMemo(() => {
    if (!rankings || !latestMonth || !range?.valid) return [];
    const fx = series[FX_ID]?.monthly ?? null;
    const { from, to } = range;
    // Benchmark dikonversi ke rupiah dan memakai basis yang sama dengan asetnya,
    // supaya Beta membandingkan hal yang sejenis.
    const benchmarkPrices = seriesFor(series[BENCHMARK_ID], basis);
    const benchmark = benchmarkPrices ? convertSeries(benchmarkPrices, fx) : null;

    return selected
      .map((id) => {
        const asset = rankings.assets.find((a) => a.id === id);
        const file = series[id];
        const prices = seriesFor(file, basis);
        if (!asset || !file || !prices) return null;
        const result = simulateDca({
          prices,
          fx: asset.quoteCurrency === 'IDR' ? null : fx,
          contribution: amount / selected.length,
          from,
          to,
          benchmark: id === BENCHMARK_ID ? null : benchmark,
        });
        return result ? { asset, file, result } : null;
      })
      .filter((entry): entry is { asset: AssetRecord; file: (typeof series)[string]; result: DcaResult } =>
        Boolean(entry),
      );
  }, [rankings, latestMonth, range, selected, series, amount, basis]);

  const combined = useMemo(
    () => (results.length > 0 ? combinePortfolio(results.map((r) => ({ id: r.asset.id, result: r.result }))) : null),
    [results],
  );

  const chartPoints: ChartPoint[] = useMemo(
    () => (combined?.series ?? []).map((p) => ({ m: p.m, i: Math.round(p.invested), v: Math.round(p.value) })),
    [combined],
  );

  const { deflators, meta: inflationMeta } = useDeflators(latestMonth);
  const real = useMemo(() => {
    if (!combined || deflators.size === 0) return null;
    return realMetrics(combined.series, amount, combined.currentValue, deflators, combined.totalReturnPct);
  }, [combined, amount, deflators]);

  const grouped = useMemo(() => {
    if (!rankings) return [];
    const needle = query.trim().toLowerCase();
    const matches = rankings.assets.filter(
      (a) => !needle || a.symbol.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle),
    );
    const byCategory = new Map<string, AssetRecord[]>();
    for (const asset of matches) {
      const list = byCategory.get(asset.category) ?? [];
      list.push(asset);
      byCategory.set(asset.category, list);
    }
    return [...byCategory.entries()];
  }, [rankings, query]);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!rankings) return null;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const choosePreset = (next: PresetKey) => {
    // Saat berpindah ke rentang bebas, kolomnya diisi dengan rentang yang sedang
    // ditampilkan — supaya hasilnya tidak melompat begitu tombolnya ditekan.
    if (next === 'custom') {
      setCustomFrom((current) => current || range?.from || earliestMonth || '');
      setCustomTo((current) => current || range?.to || latestMonth || '');
    }
    setPreset(next);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard diblokir (konteks non-HTTPS, izin ditolak). URL-nya tetap sudah
      // berisi seluruh keadaan, jadi pengguna bisa menyalinnya dari address bar.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading title={t('sim.title')} lead={t('sim.lead')} />

      <section className="panel grid gap-4 p-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted">{t('sim.amount')}</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-void px-3 py-2 focus-within:border-gold-dim">
            <span className="text-sm text-muted">Rp</span>
            <input
              type="number"
              inputMode="numeric"
              min={10_000}
              step={50_000}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="tnum w-full bg-transparent text-sm outline-none"
            />
            <span className="text-xs whitespace-nowrap text-muted">{t('common.perMonth')}</span>
          </div>
          {selected.length > 1 && (
            <span className="mt-1 block text-[11px] text-muted">
              {lang === 'id' ? 'Dibagi rata ke' : 'Split evenly across'} {selected.length}{' '}
              {lang === 'id' ? 'aset' : 'assets'} ={' '}
              {formatMoney(amount / selected.length, 'IDR', lang)}
              {t('common.perMonth')}
            </span>
          )}
        </label>

        <div>
          <span className="text-xs text-muted">{t('sim.period')}</span>
          <div className="mt-1.5">
            <Segmented<PresetKey>
              ariaLabel={t('sim.period')}
              value={preset}
              onChange={choosePreset}
              options={[
                ...PRESETS.map((p) => ({
                  value: p.key as PresetKey,
                  label:
                    rankings.periods.find((meta) => meta.key === p.key)?.[lang === 'id' ? 'label_id' : 'label_en'] ??
                    p.key,
                })),
                { value: 'custom' as PresetKey, label: t('sim.custom') },
              ]}
            />
          </div>

          {preset === 'custom' && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {/* input[type=month] menghasilkan "YYYY-MM" — persis format kunci bulan
                  yang dipakai seluruh pipeline, jadi tidak ada parsing di tengah. */}
              <label className="block">
                <span className="text-[11px] text-muted">{t('sim.from')}</span>
                <input
                  type="month"
                  value={customFrom}
                  min={earliestMonth ?? undefined}
                  max={latestMonth ?? undefined}
                  placeholder="YYYY-MM"
                  pattern="\d{4}-\d{2}"
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="tnum mt-1 block rounded-lg border border-line bg-void px-2.5 py-1.5 text-sm outline-none focus:border-gold-dim"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted">{t('sim.to')}</span>
                <input
                  type="month"
                  value={customTo}
                  min={earliestMonth ?? undefined}
                  max={latestMonth ?? undefined}
                  placeholder="YYYY-MM"
                  pattern="\d{4}-\d{2}"
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="tnum mt-1 block rounded-lg border border-line bg-void px-2.5 py-1.5 text-sm outline-none focus:border-gold-dim"
                />
              </label>
              {range && !range.valid && <p className="text-[11px] text-down">{t('sim.rangeInvalid')}</p>}
            </div>
          )}

          {range?.valid && combined && (
            <p className="mt-2 text-[11px] text-muted">
              {formatMonth(combined.from, lang)} – {formatMonth(combined.to, lang)} ·{' '}
              {t('sim.rangeMonths', { n: monthsBetween(combined.from, combined.to) + 1 })}
              {range.from && combined.from > range.from && (
                <> · {t('sim.rangeClamped', { from: formatMonth(combined.from, lang) })}</>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base">{t('sim.asset')}</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded-lg border border-line bg-void px-3 py-1.5 text-sm outline-none focus:border-gold-dim sm:w-56"
          />
        </div>

        <div className="mt-3 space-y-3">
          {grouped.length === 0 && <p className="text-sm text-muted">{t('common.noResults')}</p>}
          {grouped.map(([category, assets]) => (
            <div key={category}>
              <h3 className="text-[11px] tracking-wide text-muted uppercase">{categoryLabel(category, lang)}</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {assets.map((asset) => {
                  const active = selected.includes(asset.id);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(asset.id)}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors ${
                        active
                          ? 'border-gold-dim bg-gold/15 text-gold'
                          : 'border-line text-muted hover:border-line-bright hover:text-ink'
                      }`}
                      title={asset.name}
                    >
                      {asset.symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {pricesError && <ErrorState error={pricesError} />}
      {selected.length === 0 && <p className="panel p-6 text-sm text-muted">{t('sim.emptyPick')}</p>}
      {pricesLoading && selected.length > 0 && !combined && <LoadingState label={t('common.loading')} />}

      {combined && (
        <>
          <section className="panel p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] tracking-wide text-muted uppercase">{t('metric.value')}</div>
                <div className="mt-1">
                  <Money idr={combined.currentValue} size="hero" tone={toneFor(combined.totalReturnPct)} />
                </div>
                <div className="mt-2 text-sm text-muted">
                  {lang === 'id' ? 'dari total setoran' : 'from total contributions'}{' '}
                  <span className="tnum text-ink">{formatMoney(combined.totalInvested, 'IDR', lang)}</span>
                  {' · '}
                  {formatMonth(combined.from, lang)} – {formatMonth(combined.to, lang)}
                </div>
              </div>
              <button
                type="button"
                onClick={share}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-gold-dim hover:text-gold"
              >
                {copied ? t('common.copied') : t('common.share')}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              <Stat
                label={t('metric.profit')}
                idr={combined.currentValue - combined.totalInvested}
                tone={toneFor(combined.currentValue - combined.totalInvested)}
              />
              <Stat
                label={t('metric.return')}
                value={formatPercent(combined.totalReturnPct)}
                tone={toneFor(combined.totalReturnPct)}
                termKey="totalReturn"
              />
              <Stat label={t('metric.multiple')} value={formatMultiple(combined.multiple)} termKey="multiple" />
              <Stat
                label={t('metric.xirr')}
                value={formatRate(combined.xirr)}
                tone={toneFor(combined.xirr)}
                termKey="xirr"
                hint={lang === 'id' ? 'per tahun' : 'per year'}
              />
            </div>
          </section>

          {real && (
            <section className="panel p-5">
              <h2 className="flex items-center text-base">
                {t('metric.realReturn')}
                <Explain termKey="realReturn" />
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{t('real.lead')}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                <Stat label={t('metric.realInvested')} idr={real.realTotalInvested} size="sm" />
                <Stat
                  label={t('metric.realReturn')}
                  value={formatPercent(real.realTotalReturnPct)}
                  tone={toneFor(real.realTotalReturnPct)}
                  size="sm"
                />
                <Stat
                  label={t('metric.realXirr')}
                  value={formatRate(real.realXirr)}
                  tone={toneFor(real.realXirr)}
                  size="sm"
                />
                <Stat
                  label={t('metric.inflationDrag')}
                  value={formatPercent(-real.inflationDragPct)}
                  tone="text-down"
                  size="sm"
                />
              </div>
              {inflationMeta && (
                <p className="mt-3 text-[11px] text-muted/80">
                  {t('real.estimated', { year: inflationMeta.latestActualYear })} — {inflationMeta.source}
                </p>
              )}
            </section>
          )}

          <section className="panel p-4">
            <GrowthChart points={chartPoints} usdRate={usdRate} height={280} />
          </section>

          <section className="panel overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-base">{t('sim.breakdown')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="px-4 py-2 font-medium">{t('rank.asset')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.value')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.return')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.xirr')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.volatility')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('metric.assetDrawdown')}</th>
                    <th className="px-4 py-2 text-right font-medium">{t('metric.avgPrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(({ asset, result }) => (
                    <tr key={asset.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-ink">{asset.symbol}</span>
                          {result.partial && (
                            <Badge tone="gold" title={t('common.partialHint')}>
                              {formatMonth(result.from, lang)}
                            </Badge>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-muted">{asset.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Money idr={result.currentValue} size="sm" align="right" />
                      </td>
                      <td className={`tnum px-3 py-2.5 text-right ${toneFor(result.totalReturnPct)}`}>
                        {formatPercent(result.totalReturnPct)}
                      </td>
                      <td className={`tnum px-3 py-2.5 text-right ${toneFor(result.xirr)}`}>
                        {formatRate(result.xirr)}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right text-muted">{formatRate(result.volatility, 0, false)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-down">
                        {formatRate(result.assetMaxDrawdown, 0)}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-muted">
                        {formatPrice(
                          result.totalInvested / result.units / (asset.quoteCurrency === 'USD' && usdRate ? usdRate : 1),
                          asset.quoteCurrency,
                          lang,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {results.length === 1 && results[0] && (
            <section className="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <Stat label={t('metric.twr')} value={formatRate(results[0].result.twr)} termKey="twr" size="sm" />
              <Stat
                label={t('metric.sharpe')}
                value={formatRatio(results[0].result.sharpe)}
                termKey="sharpe"
                size="sm"
              />
              <Stat
                label={t('metric.sortino')}
                value={formatRatio(results[0].result.sortino)}
                termKey="sortino"
                size="sm"
              />
              <Stat label={t('metric.beta')} value={formatRatio(results[0].result.beta)} termKey="beta" size="sm" />
              <Stat
                label={t('metric.alpha')}
                value={formatRate(results[0].result.alpha)}
                tone={toneFor(results[0].result.alpha)}
                termKey="alpha"
                size="sm"
              />
              <Stat
                label={t('metric.maxDrawdown')}
                value={formatRate(results[0].result.maxDrawdown, 0)}
                tone="text-down"
                termKey="maxDrawdown"
                size="sm"
              />
              <Stat
                label={t('metric.units')}
                value={results[0].result.units.toFixed(results[0].result.units < 1 ? 6 : 2)}
                size="sm"
              />
              <Stat
                label={t('metric.lastPrice')}
                value={formatPrice(results[0].file.monthly.at(-1)?.c ?? null, results[0].asset.quoteCurrency, lang)}
                size="sm"
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
