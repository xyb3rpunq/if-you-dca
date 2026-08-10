import { Link } from 'react-router-dom';

import { useSettings } from '../i18n/context.tsx';
import type { AssetRecord, PeriodKey } from '../lib/data.ts';
import { formatMoney, formatMonth, formatMultiple, formatPercent, formatRate, toneFor } from '../lib/format.ts';
import { scaleMoneyFields } from '../lib/finance/scale.ts';
import { useContributionScale } from '../lib/useRankings.ts';
import { Badge, Money } from './ui.tsx';

export function categoryLabel(category: string, lang: 'id' | 'en'): string {
  const labels: Record<string, { id: string; en: string }> = {
    macro: { id: 'Makro', en: 'Macro' },
    commodity: { id: 'Komoditas', en: 'Commodity' },
    crypto: { id: 'Kripto', en: 'Crypto' },
    'us-stock': { id: 'Saham AS', en: 'US Stock' },
    'id-stock': { id: 'Saham IDX', en: 'IDX Stock' },
  };
  return labels[category]?.[lang] ?? category;
}

/**
 * Kartu satu aset dengan pola "hero number": nilai portofolio besar di atas,
 * konteks yang lebih kecil di bawahnya. Dirancang supaya inti angkanya tertangkap
 * dalam sekali lihat di layar HP.
 */
export function AssetCard({
  asset,
  period,
  livePrice,
}: {
  asset: AssetRecord;
  period: PeriodKey;
  livePrice?: number | null;
}) {
  const { lang, basis, t } = useSettings();
  const { factor } = useContributionScale();
  const raw = asset.periods[basis][period];
  if (!raw) return null;

  const result = scaleMoneyFields(raw, factor);
  const profit = result.currentValue - result.totalInvested;

  return (
    <Link
      to={`/simulator?aset=${asset.id}&periode=${period}`}
      className="panel group flex flex-col gap-3 p-4 transition-colors hover:border-line-bright"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-medium text-ink">{asset.symbol}</span>
            {livePrice != null && <span className="live-dot" aria-label={t('common.live')} />}
          </div>
          <div className="truncate text-xs text-muted">{asset.name}</div>
        </div>
        <Badge tone={asset.category === 'crypto' ? 'mint' : 'neutral'}>{categoryLabel(asset.category, lang)}</Badge>
      </div>

      <div>
        <Money idr={result.currentValue} size="lg" tone={toneFor(profit)} />
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className={`tnum font-medium ${toneFor(result.totalReturnPct)}`}>
            {formatPercent(result.totalReturnPct)}
          </span>
          <span className="tnum text-muted">{formatMultiple(result.multiple)}</span>
          <span className="text-muted">
            · {lang === 'id' ? 'dari setoran' : 'from'}{' '}
            <span className="tnum">{formatMoney(result.totalInvested, 'IDR', lang)}</span>
          </span>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px] text-muted">
        <span className="tnum">
          XIRR <span className={toneFor(result.xirr)}>{formatRate(result.xirr)}</span>
        </span>
        <span className="tnum">
          {result.months} {t('common.months')}
        </span>
        {result.partial && (
          <Badge tone="gold" title={t('common.partialHint')}>
            {t('common.partial')} · {formatMonth(result.from, lang)}
          </Badge>
        )}
      </div>
    </Link>
  );
}
