import { Link, useParams } from 'react-router-dom';

import { categoryLabel } from '../components/AssetCard.tsx';
import { Badge, ErrorState, Explain, LoadingState, PageHeading, Stat } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import { useJson } from '../lib/data.ts';
import type { NewsFile, PriceLevelInfo, TechnicalsFile } from '../lib/data.ts';
import { scaleMoneyFields } from '../lib/finance/scale.ts';
import { formatMonth, formatPercent, formatPrice, formatRate, formatRatio, formatRelativeTime, toneFor } from '../lib/format.ts';
import { useContributionScale, useRankings } from '../lib/useRankings.ts';

/** Bar posisi harga di antara dua batas — dipakai untuk ATH dan Bollinger. */
function RangeBar({ low, high, value, label }: { low: number; high: number; value: number; label: string }) {
  const span = high - low;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - low) / span) * 100)) : 50;
  return (
    <div className="mt-2" aria-label={label}>
      <div className="relative h-1.5 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gold/40" style={{ width: `${pct}%` }} />
        <div
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-void bg-gold"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LevelRow({ level, currency, lang, tone }: { level: PriceLevelInfo; currency: string; lang: 'id' | 'en'; tone: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1.5 last:border-0">
      <span className={`tnum text-sm ${tone}`}>{formatPrice(level.price, currency, lang)}</span>
      <span className="text-[11px] text-muted">
        {level.touches}× {lang === 'id' ? 'disentuh' : 'touched'} · {level.lastTouch}
      </span>
    </li>
  );
}

export function AssetDetail() {
  const { id = '' } = useParams();
  const { lang, basis, t } = useSettings();
  const { rankings, error, loading, reload } = useRankings();
  const { factor } = useContributionScale();
  const technicals = useJson<TechnicalsFile>(id ? `computed/technicals/${id}.json` : null);
  const news = useJson<NewsFile>(id ? `computed/news/${id}.json` : null);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const asset = rankings?.assets.find((a) => a.id === id);
  if (!asset) {
    return (
      <div className="panel p-6">
        <p className="text-sm text-muted">{t('common.noResults')}</p>
        <Link to="/peringkat" className="mt-3 inline-block text-sm text-gold underline decoration-gold-dim">
          ← {t('nav.rankings')}
        </Link>
      </div>
    );
  }

  const tech = technicals.data;
  const ind = tech?.indicators;
  const price = tech?.price ?? asset.lastPriceNative ?? 0;
  const currency = asset.quoteCurrency;
  const period = asset.periods[basis]['10y'] ?? asset.periods[basis].max;
  const dca = period ? scaleMoneyFields(period, factor) : null;

  const rsiTone = ind?.rsi14 == null ? 'text-muted' : ind.rsi14 >= 70 ? 'text-down' : ind.rsi14 <= 30 ? 'text-mint' : 'text-ink';
  const macdTone = ind?.macdHistogram == null ? 'text-muted' : ind.macdHistogram > 0 ? 'text-mint' : 'text-down';

  return (
    <div className="space-y-5">
      <PageHeading title={`${asset.symbol} — ${asset.name}`} />

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={asset.category === 'crypto' ? 'mint' : 'neutral'}>
                {categoryLabel(asset.category, lang)}
              </Badge>
              {asset.hasDividendData && (
                <Badge tone="mint" title={t('basis.dividendAdds', { value: `+${asset.dividendContributionPct.toFixed(0)}%` })}>
                  div +{asset.dividendContributionPct.toFixed(0)}%
                </Badge>
              )}
              <Badge>{asset.resolvedSymbol ?? asset.symbol}</Badge>
            </div>
            <div className="hero-number mt-3 text-3xl">{formatPrice(price, currency, lang)}</div>
            <div className={`tnum mt-1 text-sm ${toneFor(asset.changeMoMPct)}`}>
              {formatPercent(asset.changeMoMPct)} {lang === 'id' ? 'bulan ini' : 'this month'}
            </div>
          </div>
          <Link
            to={`/simulator?aset=${asset.id}&periode=10y`}
            className="rounded-lg border border-gold-dim bg-gold/10 px-3 py-1.5 text-sm text-gold transition-colors hover:bg-gold/20"
          >
            {t('nav.simulator')} →
          </Link>
        </div>

        {dca && (
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
            <Stat label={t('metric.value')} idr={dca.currentValue} size="sm" />
            <Stat
              label={t('metric.return')}
              value={formatPercent(dca.totalReturnPct)}
              tone={toneFor(dca.totalReturnPct)}
              size="sm"
            />
            <Stat label={t('metric.xirr')} value={formatRate(dca.xirr)} tone={toneFor(dca.xirr)} size="sm" />
            <Stat
              label={t('metric.realReturn')}
              value={formatPercent(dca.realTotalReturnPct)}
              tone={toneFor(dca.realTotalReturnPct)}
              size="sm"
            />
          </div>
        )}
      </section>

      {technicals.error && <ErrorState error={technicals.error} onRetry={technicals.reload} />}
      {technicals.loading && <LoadingState label={t('common.loading')} />}

      {tech && (
        <>
          <section className="panel p-5">
            <h2 className="flex items-center text-base">
              {t('tech.extremes')}
              <Explain termKey="ath" />
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <Stat
                  label={t('tech.ath')}
                  value={formatPrice(tech.allTimeHigh?.price, currency, lang)}
                  hint={tech.allTimeHigh ? `${formatMonth(tech.allTimeHigh.at.slice(0, 7), lang)}` : undefined}
                />
                <div className={`tnum mt-1 text-sm ${toneFor(tech.allTimeHigh?.distancePct)}`}>
                  {formatPercent(tech.allTimeHigh?.distancePct)} {t('tech.fromAth')}
                </div>
              </div>
              <div>
                <Stat
                  label={t('tech.atl')}
                  value={formatPrice(tech.allTimeLow?.price, currency, lang)}
                  hint={tech.allTimeLow ? `${formatMonth(tech.allTimeLow.at.slice(0, 7), lang)}` : undefined}
                />
                <div className={`tnum mt-1 text-sm ${toneFor(tech.allTimeLow?.distancePct)}`}>
                  {formatPercent(tech.allTimeLow?.distancePct)} {t('tech.fromAtl')}
                </div>
              </div>
            </div>
            {tech.allTimeHigh && tech.allTimeLow && (
              <RangeBar
                low={tech.allTimeLow.price}
                high={tech.allTimeHigh.price}
                value={price}
                label={t('tech.extremes')}
              />
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-muted">{t('tech.athNote', { from: tech.dataFrom ?? '—' })}</p>
          </section>

          <section className="panel p-5">
            <h2 className="flex items-center text-base">
              {t('tech.levels')}
              <Explain termKey="supportResistance" />
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t('tech.levelsNote')}</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="text-[11px] tracking-wide text-down uppercase">{t('tech.resistance')}</h3>
                <ul className="mt-1">
                  {tech.resistances.length === 0 && <li className="py-2 text-xs text-muted">{t('tech.noLevels')}</li>}
                  {[...tech.resistances].reverse().map((level) => (
                    <LevelRow key={level.price} level={level} currency={currency} lang={lang} tone="text-down" />
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[11px] tracking-wide text-mint uppercase">{t('tech.support')}</h3>
                <ul className="mt-1">
                  {tech.supports.length === 0 && <li className="py-2 text-xs text-muted">{t('tech.noLevels')}</li>}
                  {tech.supports.map((level) => (
                    <LevelRow key={level.price} level={level} currency={currency} lang={lang} tone="text-mint" />
                  ))}
                </ul>
              </div>
            </div>

            {tech.pivots && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="flex items-center text-[11px] tracking-wide text-muted uppercase">
                  {t('tech.pivots')}
                  <Explain termKey="pivotPoints" />
                </h3>
                <div className="mt-2 overflow-x-auto">
                  <div className="flex min-w-[30rem] gap-2 text-center">
                    {(['s3', 's2', 's1', 'pivot', 'r1', 'r2', 'r3'] as const).map((key) => (
                      <div
                        key={key}
                        className={`flex-1 rounded-lg border px-2 py-1.5 ${
                          key === 'pivot' ? 'border-gold-dim bg-gold/10' : 'border-line'
                        }`}
                      >
                        <div className="text-[10px] tracking-wide text-muted uppercase">{key}</div>
                        <div className="tnum mt-0.5 text-xs">{formatPrice(tech.pivots?.[key], currency, lang)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {t('tech.pivotBasis', { period: tech.pivotBasis ? formatMonth(tech.pivotBasis, lang) : '—' })}
                </p>
              </div>
            )}
          </section>

          {ind && (
            <section className="panel p-5">
              <h2 className="text-base">{t('tech.indicators')}</h2>
              <p className="mt-1 text-xs text-muted">{t('tech.indicatorsNote', { bars: tech.dailyBars })}</p>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="RSI (14)" value={formatRatio(ind.rsi14, 1)} tone={rsiTone} termKey="rsi" size="sm" />
                <Stat label="MACD" value={formatRatio(ind.macd, 4)} tone={macdTone} termKey="macd" size="sm" />
                <Stat label="Signal" value={formatRatio(ind.macdSignal, 4)} size="sm" />
                <Stat label="Histogram" value={formatRatio(ind.macdHistogram, 4)} tone={macdTone} size="sm" />
                <Stat label="Stoch %K" value={formatRatio(ind.stochK, 1)} termKey="stochastic" size="sm" />
                <Stat label="Stoch %D" value={formatRatio(ind.stochD, 1)} size="sm" />
                <Stat label="ATR (14)" value={formatPrice(ind.atr14, currency, lang)} termKey="atr" size="sm" />
                <Stat
                  label={t('tech.bandwidth')}
                  value={formatRate(ind.bollingerBandwidth, 1, false)}
                  termKey="bollinger"
                  size="sm"
                />
              </div>

              <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-[11px] tracking-wide text-muted uppercase">{t('tech.movingAverages')}</h3>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {(
                      [
                        ['SMA 20', ind.sma20],
                        ['SMA 50', ind.sma50],
                        ['SMA 200', ind.sma200],
                        ['EMA 12', ind.ema12],
                        ['EMA 26', ind.ema26],
                      ] as const
                    ).map(([label, value]) => (
                      <li key={label} className="flex items-baseline justify-between gap-3">
                        <span className="text-muted">{label}</span>
                        <span className="tnum">
                          {formatPrice(value, currency, lang)}
                          {value != null && (
                            <span className={`ml-2 text-[11px] ${price >= value ? 'text-mint' : 'text-down'}`}>
                              {price >= value ? t('tech.above') : t('tech.below')}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[11px] tracking-wide text-muted uppercase">Bollinger (20, 2)</h3>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {(
                      [
                        [t('tech.upper'), ind.bollingerUpper],
                        [t('tech.middle'), ind.bollingerMiddle],
                        [t('tech.lower'), ind.bollingerLower],
                      ] as const
                    ).map(([label, value]) => (
                      <li key={label} className="flex items-baseline justify-between gap-3">
                        <span className="text-muted">{label}</span>
                        <span className="tnum">{formatPrice(value, currency, lang)}</span>
                      </li>
                    ))}
                  </ul>
                  {ind.bollingerLower != null && ind.bollingerUpper != null && (
                    <RangeBar low={ind.bollingerLower} high={ind.bollingerUpper} value={price} label="Bollinger" />
                  )}
                </div>
              </div>

              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
                {t('tech.disclaimer')}
              </p>
            </section>
          )}
        </>
      )}

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base">{t('tech.news')}</h2>
          {news.data && (
            <span className="text-[11px] text-muted">
              {t('common.updated')} {formatRelativeTime(news.data.generatedAt, lang)}
            </span>
          )}
        </div>
        {news.loading && <LoadingState label={t('common.loading')} />}
        {(news.error || news.data?.items.length === 0) && (
          <p className="mt-2 text-sm text-muted">{t('tech.noNews')}</p>
        )}
        <ul className="mt-3 space-y-3">
          {(news.data?.items ?? []).map((item) => (
            <li key={item.url} className="border-b border-line/50 pb-3 last:border-0 last:pb-0">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm leading-snug text-ink hover:text-gold"
              >
                {item.title}
              </a>
              <div className="mt-1 text-[11px] text-muted">
                {item.publisher ?? item.source}
                {item.publishedAt && <> · {formatRelativeTime(item.publishedAt, lang)}</>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">{t('tech.newsNote')}</p>
      </section>
    </div>
  );
}
