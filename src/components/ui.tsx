import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useSettings } from '../i18n/context.tsx';
import { glossary } from '../i18n/strings.ts';

/**
 * Ikon (?) yang menjelaskan istilah teknis di tempat.
 *
 * Ini bukan hiasan — ini yang membedakan "human friendly" sebagai slogan dan sebagai
 * kenyataan. Bekerja lewat klik (bukan cuma hover) supaya bisa dipakai di HP, dan
 * menutup lewat Escape atau klik di luar.
 */
export function Explain({ termKey, className = '' }: { termKey: string; className?: string }) {
  const { lang, t } = useSettings();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const term = glossary.find((g) => g.key === termKey);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!term) return null;

  return (
    <span ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`${t('gloss.title')}: ${term.term[lang]}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 grid size-4 shrink-0 place-items-center rounded-full border border-line-bright text-[9px] leading-none font-medium text-muted transition-colors hover:border-gold hover:text-gold"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="panel absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 p-3 text-left shadow-2xl shadow-black/60 sm:w-72"
        >
          <span className="block font-display text-sm text-ink">{term.term[lang]}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">{term.short[lang]}</span>
          <Link
            to={`/istilah#${term.key}`}
            className="mt-2 inline-block text-[11px] font-medium text-gold underline decoration-gold-dim underline-offset-2"
            onClick={() => setOpen(false)}
          >
            {lang === 'id' ? 'Penjelasan lengkap →' : 'Full explanation →'}
          </Link>
        </span>
      )}
    </span>
  );
}

/** Satu angka dengan label dan penjelasan opsional. */
export function Stat({
  label,
  value,
  tone = 'text-ink',
  hint,
  termKey,
  size = 'md',
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  hint?: string;
  termKey?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const valueClass =
    size === 'lg' ? 'hero-number text-2xl sm:text-3xl' : size === 'sm' ? 'tnum text-sm' : 'tnum text-lg';
  return (
    <div className="min-w-0">
      <div className="flex items-center text-[11px] tracking-wide text-muted uppercase">
        <span className="truncate">{label}</span>
        {termKey && <Explain termKey={termKey} />}
      </div>
      <div className={`mt-1 ${valueClass} ${tone}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gold' | 'mint' | 'down';
  title?: string;
}) {
  const tones = {
    neutral: 'border-line-bright text-muted',
    gold: 'border-gold-dim text-gold',
    mint: 'border-mint/40 text-mint',
    down: 'border-down/40 text-down',
  } as const;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Penanda data live vs data terjadwal — sengaja dibedakan tegas. */
export function Freshness({ live, label }: { live: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      {live && <span className="live-dot" aria-hidden />}
      <span>{label}</span>
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  // Pembungkus yang bisa digeser: jumlah opsi bisa bertambah dan label bisa panjang,
  // dan di layar 375px itu cukup untuk mendorong seluruh halaman melebar.
  return (
    <div className="-mx-1 max-w-full overflow-x-auto px-1">
      <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-line bg-panel p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              value === option.value ? 'bg-gold/15 text-gold' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted" role="status" aria-live="polite">
      <span className="size-2 animate-pulse rounded-full bg-gold" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useSettings();
  return (
    <div className="panel my-8 p-6" role="alert">
      <h2 className="text-base text-down">{t('common.error')}</h2>
      <p className="mt-2 text-sm text-muted">{t('common.errorHint')}</p>
      <p className="mt-2 font-mono text-[11px] break-all text-muted/70">{error.message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-gold-dim px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function PageHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {lead && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{lead}</p>}
    </header>
  );
}
