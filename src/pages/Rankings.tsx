import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { categoryLabel } from '../components/AssetCard.tsx';
import { Badge, ErrorState, Explain, LoadingState, Money, PageHeading, Segmented, Stat } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import type { PeriodKey } from '../lib/data.ts';
import {
  formatMoney,
  formatMonth,
  formatMultiple,
  formatPercent,
  formatRate,
  formatRatio,
  toneFor,
} from '../lib/format.ts';
import { useRankings } from '../lib/useRankings.ts';

type SortKey = 'return' | 'real' | 'value' | 'multiple' | 'xirr' | 'volatility' | 'drawdown' | 'symbol';

const COLUMNS: { key: SortKey; labelKey: Parameters<ReturnType<typeof useSettings>['t']>[0]; term?: string }[] = [
  { key: 'symbol', labelKey: 'rank.asset' },
  { key: 'value', labelKey: 'metric.value' },
  { key: 'return', labelKey: 'metric.return', term: 'totalReturn' },
  { key: 'real', labelKey: 'metric.realReturn', term: 'realReturn' },
  { key: 'multiple', labelKey: 'metric.multiple', term: 'multiple' },
  { key: 'xirr', labelKey: 'metric.xirr', term: 'xirr' },
  { key: 'volatility', labelKey: 'metric.volatility', term: 'volatility' },
  { key: 'drawdown', labelKey: 'metric.assetDrawdown', term: 'maxDrawdown' },
];

export function Rankings() {
  const { lang, basis, t } = useSettings();
  const { rankings, usdRate, error, loading, reload } = useRankings();
  const [period, setPeriod] = useState<PeriodKey>('10y');
  const [sort, setSort] = useState<SortKey>('return');
  const [descending, setDescending] = useState(true);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (!rankings) return [];
    const needle = query.trim().toLowerCase();

    const filtered = rankings.assets.filter((asset) => {
      if (!asset.periods[basis][period]) return false;
      if (category !== 'all' && asset.category !== category) return false;
      if (needle && !asset.symbol.toLowerCase().includes(needle) && !asset.name.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });

    const pick = (id: string, key: SortKey): number | string => {
      const asset = filtered.find((a) => a.id === id);
      const p = asset?.periods[basis][period];
      if (!asset || !p) return 0;
      switch (key) {
        case 'symbol':
          return asset.symbol;
        case 'value':
          return p.currentValue;
        case 'real':
          return p.realTotalReturnPct ?? Number.NEGATIVE_INFINITY;
        case 'multiple':
          return p.multiple;
        case 'xirr':
          return p.xirr ?? Number.NEGATIVE_INFINITY;
        case 'volatility':
          return p.volatility ?? Number.NEGATIVE_INFINITY;
        case 'drawdown':
          return p.assetMaxDrawdown ?? Number.NEGATIVE_INFINITY;
        default:
          return p.totalReturnPct;
      }
    };

    return [...filtered].sort((a, b) => {
      const left = pick(a.id, sort);
      const right = pick(b.id, sort);
      const cmp =
        typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right);
      return descending ? -cmp : cmp;
    });
  }, [rankings, period, basis, category, query, sort, descending]);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!rankings) return null;

  const stats = rankings.summaryStats[basis][period];
  const invested = rows[0]?.periods[basis][period]?.totalInvested ?? 0;

  const onSort = (key: SortKey) => {
    if (key === sort) setDescending((v) => !v);
    else {
      setSort(key);
      setDescending(key !== 'symbol');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeading title={t('rank.title')} lead={t('rank.lead')} />

      <section className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
        <Stat label={t('rank.summaryMedian')} value={formatPercent(stats.median)} tone={toneFor(stats.median)} size="sm" />
        <Stat label={t('rank.summaryMean')} value={formatPercent(stats.mean)} tone={toneFor(stats.mean)} size="sm" />
        <Stat label={t('rank.summaryPositive')} value={`${stats.positive}/${stats.count}`} size="sm" />
        <Stat label={t('rank.summaryBest')} value={formatPercent(stats.best)} tone="text-mint" size="sm" />
        <Stat label={t('rank.summaryWorst')} value={formatPercent(stats.worst)} tone="text-down" size="sm" />
        <p className="col-span-full border-t border-line pt-3 text-xs leading-relaxed text-muted">
          {t('rank.medianNote')}
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Segmented<PeriodKey>
          ariaLabel={t('dash.pickPeriod')}
          value={period}
          onChange={setPeriod}
          options={rankings.periods.map((p) => ({ value: p.key, label: lang === 'id' ? p.label_id : p.label_en }))}
        />
        <Segmented
          ariaLabel={t('rank.category')}
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'us-stock', label: categoryLabel('us-stock', lang) },
            { value: 'id-stock', label: categoryLabel('id-stock', lang) },
            { value: 'crypto', label: categoryLabel('crypto', lang) },
            { value: 'commodity', label: categoryLabel('commodity', lang) },
          ]}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search')}
          className="ml-auto w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-gold-dim sm:w-52"
        />
      </section>

      <p className="text-xs text-muted">
        {lang === 'id' ? 'Semua angka mengasumsikan setoran' : 'All figures assume contributions of'}{' '}
        <span className="tnum text-ink">{formatMoney(rankings.contribution, 'IDR', lang)}</span>
        {t('common.perMonth')}
        {invested > 0 && (
          <>
            {' · '}
            {lang === 'id' ? 'total setoran' : 'total invested'}{' '}
            <span className="tnum text-ink">{formatMoney(invested, 'IDR', lang)}</span>
            {usdRate && <span className="tnum"> ({formatMoney(invested / usdRate, 'USD', lang)})</span>}
          </>
        )}
      </p>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] tracking-wide text-muted uppercase">
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-3 py-2.5 font-medium ${column.key === 'symbol' ? 'text-left' : 'text-right'}`}
                    aria-sort={sort === column.key ? (descending ? 'descending' : 'ascending') : 'none'}
                  >
                    <span className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => onSort(column.key)}
                        className={`transition-colors hover:text-ink ${sort === column.key ? 'text-gold' : ''}`}
                      >
                        {t(column.labelKey)}
                        {sort === column.key && <span aria-hidden> {descending ? '↓' : '↑'}</span>}
                      </button>
                      {column.term && <Explain termKey={column.term} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((asset, index) => {
                const p = asset.periods[basis][period];
                if (!p) return null;
                return (
                  <tr key={asset.id} className="border-b border-line/50 last:border-0 hover:bg-panel-raised/60">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="tnum w-5 text-[11px] text-muted">{index + 1}</span>
                        <Link
                          to={`/simulator?aset=${asset.id}&periode=${period}`}
                          className="font-mono text-xs text-ink hover:text-gold"
                        >
                          {asset.symbol}
                        </Link>
                        {p.partial && (
                          <Badge tone="gold" title={t('common.partialHint')}>
                            {formatMonth(p.from, lang)}
                          </Badge>
                        )}
                        {asset.hasDividendData && (
                          <Badge
                            tone="mint"
                            title={t('basis.dividendAdds', { value: `+${asset.dividendContributionPct.toFixed(0)}%` })}
                          >
                            div
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 ml-7 truncate text-[11px] text-muted">{asset.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money idr={p.currentValue} size="sm" align="right" />
                    </td>
                    <td className={`tnum px-3 py-2.5 text-right font-medium ${toneFor(p.totalReturnPct)}`}>
                      {formatPercent(p.totalReturnPct)}
                    </td>
                    <td className={`tnum px-3 py-2.5 text-right ${toneFor(p.realTotalReturnPct)}`}>
                      {formatPercent(p.realTotalReturnPct)}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right text-muted">{formatMultiple(p.multiple)}</td>
                    <td className={`tnum px-3 py-2.5 text-right ${toneFor(p.xirr)}`}>{formatRate(p.xirr)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-muted">{formatRate(p.volatility, 0, false)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-down">{formatRate(p.assetMaxDrawdown, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="p-6 text-sm text-muted">{t('common.noResults')}</p>}
      </section>

      <p className="text-xs text-muted">
        {lang === 'id'
          ? 'Kolom volatilitas & jatuh terdalam sengaja diletakkan bersebelahan dengan kolom untung: keduanya adalah harga yang dibayar untuk keuntungan di sebelahnya.'
          : 'Volatility and max drawdown sit deliberately next to the gain columns: they are the price paid for the gains beside them.'}{' '}
        <span className="tnum">{formatRatio(stats.fullHistoryCount, 0)}</span>{' '}
        {lang === 'id' ? 'aset punya data penuh untuk periode ini.' : 'assets have full history for this period.'}
      </p>
    </div>
  );
}
