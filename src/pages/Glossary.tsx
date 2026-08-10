import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { PageHeading } from '../components/ui.tsx';
import { useSettings } from '../i18n/context.tsx';
import { glossary } from '../i18n/strings.ts';

export function Glossary() {
  const { lang, t } = useSettings();
  const { hash } = useLocation();

  // Tautan "penjelasan lengkap" dari tooltip membawa hash istilahnya. HashRouter
  // sudah memakai hash untuk rute, jadi loncatan ke anchor harus dilakukan sendiri.
  useEffect(() => {
    const id = hash.replace(/^#/, '');
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('price-flash');
    const timer = setTimeout(() => target.classList.remove('price-flash'), 1200);
    return () => clearTimeout(timer);
  }, [hash]);

  return (
    <div className="space-y-5">
      <PageHeading title={t('gloss.title')} lead={t('gloss.lead')} />

      <nav aria-label={t('gloss.title')} className="panel flex flex-wrap gap-1.5 p-3">
        {glossary.map((term) => (
          <a
            key={term.key}
            href={`#${term.key}`}
            className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-gold-dim hover:text-gold"
          >
            {term.term[lang]}
          </a>
        ))}
      </nav>

      <div className="space-y-3">
        {glossary.map((term) => (
          <section key={term.key} id={term.key} className="panel scroll-mt-20 p-5">
            <h2 className="text-lg">{term.term[lang]}</h2>
            <p className="mt-1.5 text-sm text-ink">{term.short[lang]}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{term.long[lang]}</p>
            {term.formula && (
              <div className="mt-3 border-t border-line pt-3">
                <span className="text-[11px] tracking-wide text-muted uppercase">{t('gloss.formula')}</span>
                <code className="mt-1 block font-mono text-xs text-gold">{term.formula}</code>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
