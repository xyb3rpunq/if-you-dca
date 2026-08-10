import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { categoryLabel } from '../components/AssetCard.tsx';
import { Badge, ErrorState, Explain, LoadingState, PageHeading, Stat } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import { useJson } from '../lib/data.ts';
import type { FundamentalRecord, FundamentalsFile } from '../lib/data.ts';
import {
  assessFundamentals,
  dividendSustainability,
  grahamNumber,
  marginOfSafety,
  qualityChecks,
  scoreQuality,
  simplifiedDcf,
  summarizeVerdict,
} from '../lib/finance/value.ts';
import type { QualityCheck, RatioCheck, Verdict } from '../lib/finance/value.ts';
import { formatMoney, formatPercent, formatPrice, formatRate, formatRatio } from '../lib/format.ts';
import { useRankings } from '../lib/useRankings.ts';

const TONE: Record<Verdict, string> = {
  cheap: 'text-mint',
  strong: 'text-mint',
  fair: 'text-ink',
  expensive: 'text-down',
  weak: 'text-down',
  unknown: 'text-muted',
};

const CHECK_TERMS: Record<RatioCheck['key'], string | undefined> = {
  pe: 'pe',
  pb: 'pb',
  grahamCombined: 'grahamNumber',
  roe: 'roe',
  debtToEquity: 'debtToEquity',
  dividendYield: 'dividendYield',
  marginOfSafety: 'marginOfSafety',
};

function SignalDot({ signal }: { signal: QualityCheck['signal'] }) {
  const cls =
    signal === 'pass' ? 'bg-mint' : signal === 'fail' ? 'bg-down' : 'border border-line-bright bg-transparent';
  return <span className={`inline-block size-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

/** Baris rasio dengan nilai, ambang yang dipakai, dan penilaiannya. */
function RatioRow({ label, value, verdict, threshold, term }: {
  label: string;
  value: string;
  verdict?: Verdict;
  threshold?: string;
  term?: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line/50 py-2 last:border-0">
      <span className="inline-flex items-center text-sm text-muted">
        {label}
        {term && <Explain termKey={term} />}
      </span>
      <span className="flex items-baseline gap-2">
        <span className={`tnum text-sm ${verdict ? TONE[verdict] : 'text-ink'}`}>{value}</span>
        {threshold && <span className="text-[10px] whitespace-nowrap text-muted/70">{threshold}</span>}
      </span>
    </li>
  );
}

export function ValueLens() {
  const { lang, t } = useSettings();
  const { rankings, error, loading, reload } = useRankings();
  const fundamentals = useJson<FundamentalsFile>('computed/fundamentals.json');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Kontrol DCF; nilai awal sengaja konservatif, bukan optimistis.
  const [growth, setGrowth] = useState(0.05);
  const [discount, setDiscount] = useState(0.12);
  const [terminal, setTerminal] = useState(0.03);
  const [years, setYears] = useState(10);

  const stocks = useMemo(
    () => (rankings?.assets ?? []).filter((a) => a.category === 'us-stock' || a.category === 'id-stock'),
    [rankings],
  );

  const active = selectedId ?? stocks[0]?.id ?? null;
  const asset = stocks.find((s) => s.id === active) ?? null;
  const record: FundamentalRecord | undefined = active ? fundamentals.data?.assets[active] : undefined;
  const hasData = Boolean(record && !record.error && (record.pe != null || record.price != null));

  const checks = useMemo(() => {
    if (!record || !hasData) return null;
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
  }, [record, hasData]);

  const trend = useMemo(() => (record?.history ? qualityChecks(record.history) : null), [record]);
  const score = trend ? scoreQuality(trend) : null;

  const graham = record ? grahamNumber(record.eps ?? null, record.bookValuePerShare ?? null) : null;
  const mos = marginOfSafety(graham, record?.price ?? null);
  const verdict = checks ? summarizeVerdict(checks) : 'unknown';

  // Arus kas bebas per saham, bahan masukan DCF.
  const fcfPerShare = useMemo(() => {
    if (!record?.freeCashflow || !record.marketCap || !record.price) return null;
    const shares = record.marketCap / record.price;
    return shares > 0 ? record.freeCashflow / shares : null;
  }, [record]);

  const dcf = useMemo(() => {
    if (fcfPerShare == null || fcfPerShare <= 0) return null;
    return simplifiedDcf({
      freeCashFlowPerShare: fcfPerShare,
      growthRate: growth,
      terminalGrowth: terminal,
      discountRate: discount,
      years,
    });
  }, [fcfPerShare, growth, terminal, discount, years]);

  const dcfMos = marginOfSafety(dcf, record?.price ?? null);

  if (loading) return <LoadingState label={t('common.loading')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!rankings) return null;

  const currency = asset?.quoteCurrency ?? 'USD';
  const money = (v: number | null | undefined) => formatMoney(v ?? null, currency === 'IDR' ? 'IDR' : 'USD', lang);

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

      {fundamentals.loading && <LoadingState label={t('common.loading')} />}

      {asset && (
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-xl text-ink">{asset.symbol}</h2>
                <Badge>{categoryLabel(asset.category, lang)}</Badge>
                <Link to={`/aset/${asset.id}`} className="text-[11px] text-gold underline decoration-gold-dim">
                  {t('nav.assetDetail')} →
                </Link>
              </div>
              <p className="mt-0.5 text-sm text-muted">{asset.name}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] tracking-wide text-muted uppercase">{t('metric.lastPrice')}</div>
              <div className="tnum mt-1 text-lg">
                {formatPrice(record?.price ?? asset.lastPriceNative, currency, lang)}
              </div>
            </div>
          </div>

          {!hasData ? (
            <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
              {record?.error ? `${t('value.unavailable')} — ${record.error}` : t('value.verdict.unknown')}
            </p>
          ) : (
            <>
              <div className={`mt-4 rounded-lg border-l-2 border-current/40 bg-void/50 py-3 pr-3 pl-4 ${TONE[verdict]}`}>
                <p className="text-sm font-medium">{t(`value.verdict.${verdict}` as 'value.verdict.fair')}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{t('value.notAdvice')}</p>
              </div>

              {record?.bookValueConverted && (
                <p className="mt-3 rounded-lg border border-gold-dim/40 bg-gold/5 p-3 text-[11px] leading-relaxed text-muted">
                  <span className="text-gold">⚠ </span>
                  {t('value.bookValueFixed')}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {hasData && record && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel p-5">
              <h2 className="text-base">{t('value.valuation')}</h2>
              <ul className="mt-3">
                <RatioRow
                  label="P/E"
                  value={formatRatio(record.pe)}
                  verdict={checks?.find((c) => c.key === 'pe')?.verdict}
                  threshold={checks?.find((c) => c.key === 'pe')?.threshold}
                  term={CHECK_TERMS.pe}
                />
                <RatioRow label={lang === 'id' ? 'P/E proyeksi' : 'Forward P/E'} value={formatRatio(record.forwardPe)} />
                <RatioRow
                  label="P/B"
                  value={formatRatio(record.pb)}
                  verdict={checks?.find((c) => c.key === 'pb')?.verdict}
                  threshold={checks?.find((c) => c.key === 'pb')?.threshold}
                  term={CHECK_TERMS.pb}
                />
                <RatioRow label="P/S" value={formatRatio(record.ps)} />
                <RatioRow label="PEG" value={formatRatio(record.peg)} />
                <RatioRow
                  label={lang === 'id' ? 'Earnings yield' : 'Earnings yield'}
                  value={formatRate(record.earningsYield, 1, false)}
                  threshold={lang === 'id' ? 'bandingkan dgn deposito' : 'compare to deposit rate'}
                />
                <RatioRow
                  label={lang === 'id' ? 'FCF yield' : 'FCF yield'}
                  value={formatRate(record.freeCashflowYield, 1, false)}
                />
                <RatioRow
                  label={t('value.grahamNumber')}
                  value={formatPrice(graham, currency, lang)}
                  term="grahamNumber"
                />
                <RatioRow
                  label={t('value.marginOfSafety')}
                  value={formatPercent(mos)}
                  verdict={checks?.find((c) => c.key === 'marginOfSafety')?.verdict}
                  threshold={checks?.find((c) => c.key === 'marginOfSafety')?.threshold}
                  term={CHECK_TERMS.marginOfSafety}
                />
              </ul>
            </section>

            <section className="panel p-5">
              <h2 className="text-base">{t('value.quality')}</h2>
              <ul className="mt-3">
                <RatioRow
                  label="ROE"
                  value={formatRate(record.roe, 1, false)}
                  verdict={checks?.find((c) => c.key === 'roe')?.verdict}
                  threshold={checks?.find((c) => c.key === 'roe')?.threshold}
                  term={CHECK_TERMS.roe}
                />
                <RatioRow label="ROA" value={formatRate(record.roa, 1, false)} />
                <RatioRow label={lang === 'id' ? 'Margin kotor' : 'Gross margin'} value={formatRate(record.grossMargin, 1, false)} />
                <RatioRow label={lang === 'id' ? 'Margin operasi' : 'Operating margin'} value={formatRate(record.operatingMargin, 1, false)} />
                <RatioRow label={lang === 'id' ? 'Margin bersih' : 'Net margin'} value={formatRate(record.profitMargin, 1, false)} />
                <RatioRow label={lang === 'id' ? 'Pertumbuhan pendapatan' : 'Revenue growth'} value={formatRate(record.revenueGrowth)} />
                <RatioRow label={lang === 'id' ? 'Pertumbuhan laba' : 'Earnings growth'} value={formatRate(record.earningsGrowth)} />
              </ul>

              {trend && score && (
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[11px] tracking-wide text-muted uppercase">{t('value.trend')}</h3>
                    <span className="tnum text-[11px] text-muted">
                      {t('value.qualityScore', { passed: score.passed, known: score.known })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t('value.trendNote')}</p>
                  <ul className="mt-2 space-y-1.5">
                    {trend.map((check) => (
                      <li key={check.key} className="flex items-start gap-2 text-xs">
                        <span className="mt-1">
                          <SignalDot signal={check.signal} />
                        </span>
                        <span className="flex-1">
                          <span className={check.signal === 'unknown' ? 'text-muted' : 'text-ink'}>
                            {t(`value.check.${check.key}` as 'value.check.profitable')}
                          </span>
                          {check.detail && <span className="tnum ml-2 text-[11px] text-muted">{check.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted/80">{t('value.cashBackedNote')}</p>
                </div>
              )}
            </section>

            <section className="panel p-5">
              <h2 className="text-base">{t('value.health')}</h2>
              <ul className="mt-3">
                <RatioRow
                  label="Debt / Equity"
                  value={formatRatio(record.debtToEquity)}
                  verdict={checks?.find((c) => c.key === 'debtToEquity')?.verdict}
                  threshold={checks?.find((c) => c.key === 'debtToEquity')?.threshold}
                  term={CHECK_TERMS.debtToEquity}
                />
                <RatioRow label={lang === 'id' ? 'Rasio lancar' : 'Current ratio'} value={formatRatio(record.currentRatio)} />
                <RatioRow label={lang === 'id' ? 'Rasio cepat' : 'Quick ratio'} value={formatRatio(record.quickRatio)} />
                <RatioRow label={lang === 'id' ? 'Kas' : 'Cash'} value={money(record.totalCash)} />
                <RatioRow label={lang === 'id' ? 'Utang' : 'Debt'} value={money(record.totalDebt)} />
                <RatioRow label={lang === 'id' ? 'Arus kas operasi' : 'Operating cash flow'} value={money(record.operatingCashflow)} />
                <RatioRow label={lang === 'id' ? 'Arus kas bebas' : 'Free cash flow'} value={money(record.freeCashflow)} />
              </ul>
            </section>

            <section className="panel p-5">
              <h2 className="text-base">{t('value.dividend')}</h2>
              <ul className="mt-3">
                <RatioRow
                  label={lang === 'id' ? 'Dividend yield' : 'Dividend yield'}
                  value={formatRate(record.dividendYield, 2, false)}
                  verdict={checks?.find((c) => c.key === 'dividendYield')?.verdict}
                  threshold={checks?.find((c) => c.key === 'dividendYield')?.threshold}
                  term={CHECK_TERMS.dividendYield}
                />
                <RatioRow
                  label={lang === 'id' ? 'Payout ratio' : 'Payout ratio'}
                  value={formatRate(record.payoutRatio, 0, false)}
                  verdict={dividendSustainability(record.payoutRatio)}
                  threshold={lang === 'id' ? 'di atas 100% tidak berkelanjutan' : 'above 100% is unsustainable'}
                />
                <RatioRow label={lang === 'id' ? 'Laba per saham' : 'Earnings per share'} value={formatPrice(record.eps, currency, lang)} />
                <RatioRow
                  label={lang === 'id' ? 'Nilai buku per saham' : 'Book value per share'}
                  value={formatPrice(record.bookValuePerShare, currency, lang)}
                />
              </ul>
            </section>
          </div>

          <section className="panel p-5">
            <h2 className="text-base">{t('value.dcf')}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{t('value.dcfNote')}</p>

            {fcfPerShare == null || fcfPerShare <= 0 ? (
              <p className="mt-4 text-sm text-muted">{t('value.noFcf')}</p>
            ) : (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(
                    [
                      [t('value.growthAssumption'), growth, setGrowth, 0, 0.25, 0.005],
                      [t('value.discountRate'), discount, setDiscount, 0.05, 0.25, 0.005],
                      [t('value.terminalGrowth'), terminal, setTerminal, 0, 0.06, 0.0025],
                    ] as const
                  ).map(([label, value, setter, min, max, step]) => (
                    <label key={label} className="block">
                      <span className="flex items-baseline justify-between text-[11px] text-muted">
                        {label}
                        <span className="tnum text-ink">{formatRate(value, 2, false)}</span>
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => setter(Number(e.target.value))}
                        className="mt-1.5 w-full accent-[#c9a24b]"
                      />
                    </label>
                  ))}
                  <label className="block">
                    <span className="flex items-baseline justify-between text-[11px] text-muted">
                      {t('value.years')}
                      <span className="tnum text-ink">{years}</span>
                    </span>
                    <input
                      type="range"
                      min={3}
                      max={20}
                      step={1}
                      value={years}
                      onChange={(e) => setYears(Number(e.target.value))}
                      className="mt-1.5 w-full accent-[#c9a24b]"
                    />
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                  <Stat
                    label={lang === 'id' ? 'Arus kas bebas' : 'Free cash flow'}
                    value={formatPrice(fcfPerShare, currency, lang)}
                    hint={t('value.perShare')}
                    size="sm"
                  />
                  <Stat label={t('value.intrinsic')} value={formatPrice(dcf, currency, lang)} size="sm" />
                  <Stat
                    label={t('metric.lastPrice')}
                    value={formatPrice(record.price, currency, lang)}
                    hint={t('value.vs')}
                    size="sm"
                  />
                  <Stat
                    label={t('value.marginOfSafety')}
                    value={formatPercent(dcfMos)}
                    tone={dcfMos == null ? 'text-muted' : dcfMos > 0 ? 'text-mint' : 'text-down'}
                    size="sm"
                  />
                </div>
              </>
            )}
          </section>
        </>
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
              ? 'Batasnya nyata. Rumus ini lahir untuk perusahaan industri padat aset, jadi hampir selalu menyebut perusahaan perangkat lunak "kemahalan" — aset terbesar mereka berupa merek, kode, dan orang, yang tidak muncul di neraca. Perusahaan yang sedang merugi juga tidak bisa dinilai sama sekali dengan Graham Number.'
              : 'Its limits are real. The formula was built for asset-heavy industrials, so it nearly always calls software companies "overpriced" — their biggest assets are brands, code and people, none of which appear on a balance sheet. Loss-making companies cannot be valued with the Graham Number at all.'}
          </p>
          <p>
            {lang === 'id'
              ? 'Rasio bank juga perlu dibaca berbeda: Debt/Equity kehilangan makna biasanya karena berutang memang model bisnisnya. Dan rasio apa pun hanya sebagus laporan keuangan yang mendasarinya.'
              : 'Bank ratios need different reading too: Debt/Equity loses its usual meaning because borrowing is the business model. And any ratio is only as good as the financial statements beneath it.'}
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
