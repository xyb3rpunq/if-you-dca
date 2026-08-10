import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AssetCard, categoryLabel } from '../components/AssetCard.tsx';
import {
  ContributionInput,
  ErrorState,
  Explain,
  Freshness,
  LoadingState,
  Segmented,
  Stat,
} from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import type { AssetRecord, PeriodKey } from '../lib/data.ts';
import { useRealtime } from '../lib/live/useRealtime.ts';
import {
  formatMoney,
  formatMonth,
  formatPercent,
  formatPrice,
  formatRelativeTime,
  toneFor,
} from '../lib/format.ts';
import { useRankings } from '../lib/useRankings.ts';

const SNAPSHOT_IDS = ['usdidr', 'spx', 'gold', 'btc'];

export function Dashboard() {
  const { lang, basis, contribution, t } = useSettings();
  const { rankings, error, loading, reload } = useRankings();
  const [period, setPeriod] = useState<PeriodKey>('10y');

  const live = useRealtime(rankings?.assets);

  const ranked = useMemo(() => {
    if (!rankings) return [];
    return rankings.assets
      .filter((a) => a.periods[basis][period] && a.role !== 'fx')
      .sort(
        (a, b) =>
          (b.periods[basis][period]?.totalReturnPct ?? 0) - (a.periods[basis][period]?.totalReturnPct ?? 0),
      );
  }, [rankings, period, basis]);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!rankings) return null;

  const stats = rankings.summaryStats[basis][period];
  const snapshot = SNAPSHOT_IDS.map((id) => rankings.assets.find((a) => a.id === id)).filter(
    (a): a is AssetRecord => Boolean(a),
  );
  const periodOptions = rankings.periods.map((p) => ({
    value: p.key,
    label: lang === 'id' ? p.label_id : p.label_en,
  }));
  const amount = formatMoney(contribution, 'IDR', lang);

  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-[11px] tracking-[0.18em] text-gold uppercase">
          {formatMonth(rankings.latestMonth, lang)} · {rankings.assets.length}{' '}
          {lang === 'id' ? 'aset dilacak' : 'assets tracked'}
        </p>
        <h1 className="mt-2 max-w-2xl text-3xl leading-tight sm:text-4xl">{t('app.tagline')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {t('dash.heroLead', { amount })}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="text-xs text-muted">{t('dash.pickPeriod')}</span>
          <Segmented<PeriodKey> ariaLabel={t('dash.pickPeriod')} value={period} onChange={setPeriod} options={periodOptions} />
        </div>
        <div className="mt-3">
          <ContributionInput compact />
        </div>

        {stats.median != null && (
          <p className="mt-4 max-w-2xl rounded-lg border-l-2 border-gold-dim bg-panel/60 py-2.5 pr-3 pl-4 text-sm text-muted">
            {t('dash.statLine', {
              positive: stats.positive,
              count: stats.count,
              median: formatPercent(stats.median),
            })}
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg">{t('dash.marketSnapshot')}</h2>
          <Freshness
            live={false}
            label={`${t('common.updated')} ${formatRelativeTime(rankings.generatedAt, lang)}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {snapshot.map((asset) => {
            const point = live.prices[asset.id];
            const isStreaming = point?.source === 'binance' && point.freshness === 'live';
            return (
              <div key={asset.id} className="panel p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="font-mono">{asset.symbol}</span>
                  {isStreaming && <span className="live-dot" aria-label={t('common.live')} />}
                </div>
                <div className="tnum mt-1.5 text-base text-ink">
                  {formatPrice(point?.price ?? asset.lastPriceNative, asset.quoteCurrency, lang)}
                </div>
                <div className={`tnum mt-0.5 text-[11px] ${toneFor(point?.changePct ?? asset.changeMoMPct)}`}>
                  {formatPercent(point?.changePct ?? asset.changeMoMPct)}{' '}
                  {point?.source === 'binance'
                    ? lang === 'id'
                      ? '24 jam'
                      : '24h'
                    : point?.source === 'proxy'
                      ? lang === 'id'
                        ? 'hari ini'
                        : 'today'
                      : lang === 'id'
                        ? 'bulan ini'
                        : 'this month'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Setiap kelas aset menyebut kesegarannya sendiri. Menyamaratakan semuanya
            sebagai "live" adalah cara paling halus untuk menyesatkan pembaca. */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            {live.streamStatus === 'live' ? (
              <span className="live-dot" aria-hidden />
            ) : (
              <span className="inline-block size-1.5 rounded-full bg-muted/60" aria-hidden />
            )}
            {lang === 'id' ? 'Kripto' : 'Crypto'}:{' '}
            {live.streamStatus === 'live'
              ? lang === 'id'
                ? 'streaming tick-level'
                : 'tick-level stream'
              : live.streamStatus === 'connecting'
                ? lang === 'id'
                  ? 'menyambung…'
                  : 'connecting…'
                : lang === 'id'
                  ? 'terputus, memakai harga terakhir'
                  : 'disconnected, showing last price'}
          </span>
          <span>
            {lang === 'id' ? 'Saham & komoditas' : 'Stocks & commodities'}:{' '}
            {live.quoteStatus === 'live'
              ? lang === 'id'
                ? 'kuotasi langsung (tertunda bursa)'
                : 'direct quotes (exchange-delayed)'
              : live.quoteEndpointConfigured
                ? lang === 'id'
                  ? 'proxy tidak merespons, memakai data terjadwal'
                  : 'proxy unavailable, using scheduled data'
                : `${t('common.updated')} ${formatRelativeTime(rankings.generatedAt, lang)}`}
          </span>
          {live.fx.rate && (
            <span className="tnum">
              USD/IDR {Math.round(live.fx.rate).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}{' '}
              <span className="text-muted/70">
                ({live.fx.source === 'crypto-implied' ? (lang === 'id' ? 'pasar' : 'market') : 'ECB'})
              </span>
            </span>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg">{t('dash.topMovers')}</h2>
          <Link to="/peringkat" className="text-xs text-gold underline decoration-gold-dim underline-offset-2">
            {t('dash.seeAll')} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.slice(0, 6).map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              period={period}
              livePrice={live.prices[asset.id]?.source === 'binance' ? live.prices[asset.id]?.price : null}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg">{t('dash.worst')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.slice(-3).reverse().map((asset) => (
            <AssetCard key={asset.id} asset={asset} period={period} />
          ))}
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
          {lang === 'id'
            ? 'Bagian ini sengaja ditampilkan sejajar dengan pemenangnya. Melihat hanya aset yang menang adalah cara paling cepat salah menilai peluang.'
            : 'This section is deliberately given equal weight to the winners. Looking only at what won is the fastest way to misjudge the odds.'}
        </p>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg">{t('dash.trySimulator')}</h2>
            <p className="mt-1 max-w-lg text-sm text-muted">{t('sim.lead')}</p>
          </div>
          <Link
            to="/simulator"
            className="rounded-lg border border-gold-dim bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
          >
            {t('nav.simulator')} →
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
          <Stat
            label={t('rank.summaryMedian')}
            value={formatPercent(stats.median)}
            tone={toneFor(stats.median)}
            size="sm"
          />
          <Stat label={t('rank.summaryBest')} value={formatPercent(stats.best)} tone="text-mint" size="sm" />
          <Stat label={t('rank.summaryWorst')} value={formatPercent(stats.worst)} tone="text-down" size="sm" />
          <Stat
            label={t('rank.summaryPositive')}
            value={`${stats.positive}/${stats.count}`}
            size="sm"
          />
        </div>
      </section>

      <section className="text-xs text-muted">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="live-dot" aria-hidden /> {t('common.live')} — {lang === 'id' ? 'kripto, tiap 60 detik' : 'crypto, every 60s'}
          </span>
          <span>
            · {t('common.nearLive')} — {lang === 'id' ? 'saham & komoditas, via cron' : 'stocks & commodities, via cron'}
          </span>
          <span className="inline-flex items-center">
            {lang === 'id' ? 'Kategori' : 'Categories'}: {categoryLabel('us-stock', lang)}, {categoryLabel('id-stock', lang)},{' '}
            {categoryLabel('crypto', lang)}, {categoryLabel('commodity', lang)}
            <Explain termKey="dca" />
          </span>
        </span>
      </section>
    </div>
  );
}
