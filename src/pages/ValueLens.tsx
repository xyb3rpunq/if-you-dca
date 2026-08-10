import { useMemo, useState } from 'react';

import { categoryLabel } from '../components/AssetCard.tsx';
import { Badge, ErrorState, Explain, LoadingState, PageHeading, Stat } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import { useJson } from '../lib/data.ts';
import type { FundamentalsFile } from '../lib/data.ts';
import { assessFundamentals, grahamNumber, marginOfSafety, summarizeVerdict } from '../lib/finance/value.ts';
import type { RatioCheck, Verdict } from '../lib/finance/value.ts';
import { formatPercent, formatPrice, formatRate, formatRatio } from '../lib/format.ts';
import { useRankings } from '../lib/useRankings.ts';

const VERDICT_TONE: Record<Verdict, string> = {
  cheap: 'text-mint',
  strong: 'text-mint',
  fair: 'text-ink',
  expensive: 'text-down',
  weak: 'text-down',
  unknown: 'text-muted',
};

const CHECK_LABELS: Record<RatioCheck['key'], { id: string; en: string; term?: string }> = {
  pe: { id: 'P/E', en: 'P/E', term: 'pe' },
  pb: { id: 'P/B', en: 'P/B', term: 'pb' },
  grahamCombined: { id: 'P/E × P/B', en: 'P/E × P/B', term: 'grahamNumber' },
  roe: { id: 'ROE', en: 'ROE', term: 'roe' },
  debtToEquity: { id: 'Debt/Equity', en: 'Debt/Equity', term: 'debtToEquity' },
  dividendYield: { id: 'Dividend Yield', en: 'Dividend Yield', term: 'dividendYield' },
  marginOfSafety: { id: 'Margin of Safety', en: 'Margin of Safety', term: 'marginOfSafety' },
};

export function ValueLens() {
  const { lang, t } = useSettings();
  const { rankings, error, loading, reload } = useRankings();
  const fundamentals = useJson<FundamentalsFile>('computed/fundamentals.json');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stocks = useMemo(
    () => (rankings?.assets ?? []).filter((a) => a.category === 'us-stock' || a.category === 'id-stock'),
    [rankings],
  );

  const active = selectedId ?? stocks[0]?.id ?? null;
  const asset = stocks.find((s) => s.id === active) ?? null;
  const record = active ? fundamentals.data?.assets[active] : undefined;

  const checks = useMemo(() => {
    if (!record || record.error) return null;
    return assessFundamentals({
      price: record.price ?? null,
      eps: record.eps ?? null,
      bookValuePerShare: record.bookValuePerShare ?? null,
      pe: record.pe ?? null,
      pb: record.pb ?? null,
      ps: record.ps ?? null,
      dividendYield: record.dividendYield ?? null,
      roe: record.roe ?? null,
      roa: record.roa ?? null,
      debtToEquity: record.debtToEquity ?? null,
    });
  }, [record]);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!rankings) return null;

  const graham = record ? grahamNumber(record.eps ?? null, record.bookValuePerShare ?? null) : null;
  const mos = marginOfSafety(graham, record?.price ?? null);
  const verdict = checks ? summarizeVerdict(checks) : 'unknown';
  const dataMissing = !fundamentals.data?.available;

  return (
    <div className="space-y-5">
      <PageHeading title={t('value.title')} lead={t('value.lead')} />

      <section className="panel p-4">
        <h2 className="text-[11px] tracking-wide text-muted uppercase">{t('value.pickStock')}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stocks.map((stock) => (
            <button
              key={stock.id}
              type="button"
              aria-pressed={stock.id === active}
              onClick={() => setSelectedId(stock.id)}
              title={stock.name}
              className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors ${
                stock.id === active
                  ? 'border-gold-dim bg-gold/15 text-gold'
                  : 'border-line text-muted hover:border-line-bright hover:text-ink'
              }`}
            >
              {stock.symbol}
            </button>
          ))}
        </div>
      </section>

      {dataMissing && (
        <section className="panel border-dashed p-6">
          <h2 className="text-base text-gold">{t('value.unavailable')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t('value.unavailableHint')}</p>
          {fundamentals.data?.message && (
            <p className="mt-3 rounded-lg bg-void/60 p-3 font-mono text-[11px] leading-relaxed text-muted/80">
              {fundamentals.data.message}
            </p>
          )}
        </section>
      )}

      {asset && (
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-xl text-ink">{asset.symbol}</h2>
                <Badge>{categoryLabel(asset.category, lang)}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted">{asset.name}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] tracking-wide text-muted uppercase">{t('metric.lastPrice')}</div>
              <div className="tnum mt-1 text-lg">
                {formatPrice(record?.price ?? asset.lastPriceNative, asset.quoteCurrency, lang)}
              </div>
            </div>
          </div>

          {!record || record.error || !checks ? (
            <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
              {record?.error
                ? `${t('value.unavailable')} — ${record.error}`
                : t('value.verdict.unknown')}
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                <Stat
                  label={t('value.grahamNumber')}
                  value={formatPrice(graham, asset.quoteCurrency, lang)}
                  termKey="grahamNumber"
                />
                <Stat
                  label={t('value.marginOfSafety')}
                  value={formatPercent(mos)}
                  tone={mos == null ? 'text-muted' : mos > 0 ? 'text-mint' : 'text-down'}
                  termKey="marginOfSafety"
                />
                <Stat label="P/E" value={formatRatio(record.pe)} termKey="pe" />
                <Stat label="P/B" value={formatRatio(record.pb)} termKey="pb" />
              </div>

              <div className={`mt-5 rounded-lg border-l-2 border-current/40 bg-void/50 py-3 pr-3 pl-4 ${VERDICT_TONE[verdict]}`}>
                <p className="text-sm font-medium">{t(`value.verdict.${verdict}` as 'value.verdict.fair')}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{t('value.notAdvice')}</p>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <tbody>
                    {checks.map((check) => (
                      <tr key={check.key} className="border-b border-line/50 last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">
                          <span className="inline-flex items-center">
                            {CHECK_LABELS[check.key][lang]}
                            {CHECK_LABELS[check.key].term && <Explain termKey={CHECK_LABELS[check.key].term as string} />}
                          </span>
                        </th>
                        <td className="tnum py-2 pr-3 text-right">
                          {check.key === 'roe' || check.key === 'dividendYield'
                            ? formatRate(check.value, 1, false)
                            : check.key === 'marginOfSafety'
                              ? formatPercent(check.value)
                              : formatRatio(check.value)}
                        </td>
                        <td className={`py-2 pr-3 text-right text-xs ${VERDICT_TONE[check.verdict]}`}>
                          {check.verdict === 'unknown' ? '—' : check.verdict}
                        </td>
                        <td className="py-2 text-right text-[11px] whitespace-nowrap text-muted/70">{check.threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel p-5">
        <h2 className="text-base">
          {lang === 'id' ? 'Kenapa saringan ini, dan apa batasnya' : 'Why this screen, and where it breaks'}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            {lang === 'id'
              ? 'Saringan yang dipakai di sini adalah batas yang dirumuskan Benjamin Graham untuk investor defensif: P/E maksimum 15 dan P/B maksimum 1,5. Keduanya sudah lama menjadi materi publik, dan dipilih karena sederhana serta bisa diperiksa ulang siapa pun — bukan karena paling canggih.'
              : 'The screen used here is the one Benjamin Graham set for defensive investors: a maximum P/E of 15 and maximum P/B of 1.5. Both have long been public material, chosen because they are simple and independently checkable — not because they are the most sophisticated.'}
          </p>
          <p>
            {lang === 'id'
              ? 'Batasnya nyata. Rumus ini lahir untuk perusahaan industri padat aset, jadi hampir selalu menyebut perusahaan perangkat lunak "kemahalan" — aset terbesar mereka berupa merek, kode, dan orang, yang tidak muncul di neraca. Perusahaan yang sedang merugi juga tidak bisa dinilai sama sekali dengan rumus ini.'
              : 'Its limits are real. The formula was built for asset-heavy industrials, so it nearly always calls software companies "overpriced" — their biggest assets are brands, code and people, none of which appear on a balance sheet. Loss-making companies cannot be valued with it at all.'}
          </p>
          <p className="text-muted/80">
            {lang === 'id'
              ? 'Penilaian di halaman ini dihasilkan oleh aturan tetap terhadap angka, bukan oleh model bahasa, dan tidak mengutip siapa pun. Anggap sebagai titik awal untuk bertanya, bukan jawaban.'
              : 'The verdicts on this page come from fixed rules applied to numbers, not from a language model, and quote no one. Treat them as a starting point for questions, not as answers.'}
          </p>
        </div>
      </section>
    </div>
  );
}
