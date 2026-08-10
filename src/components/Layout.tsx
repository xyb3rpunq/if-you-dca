import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useSettings } from '../i18n/context.tsx';
import type { Lang } from '../i18n/strings.ts';
import type { Currency } from '../lib/format.ts';
import { Segmented } from './ui.tsx';

const NAV = [
  { to: '/', key: 'nav.dashboard' },
  { to: '/simulator', key: 'nav.simulator' },
  { to: '/peringkat', key: 'nav.rankings' },
  { to: '/value-lens', key: 'nav.value' },
  { to: '/rencana', key: 'nav.portfolio' },
  { to: '/istilah', key: 'nav.glossary' },
] as const;

const REPO_URL = 'https://github.com/xyb3rpunq/if-you-dca';

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#0f1613" stroke="#1c2620" />
        <path d="M7 9l6 15h2L21 9" stroke="#c9a24b" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="10" r="2.6" fill="#4ade9e" />
      </svg>
      <span className="font-display text-[15px] leading-none font-medium tracking-tight">
        Value <span className="text-gold">Terminal</span>
      </span>
    </Link>
  );
}

export function Layout() {
  const { lang, currency, setLang, setCurrency, t } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Menu mobile harus menutup sendiri setelah pindah halaman — kalau tidak, pengguna
  // mendarat di halaman baru yang tertutup panel navigasi.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm transition-colors ${
      isActive ? 'bg-gold/12 text-gold' : 'text-muted hover:text-ink'
    }`;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
      >
        {lang === 'id' ? 'Lompat ke konten' : 'Skip to content'}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-void/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Wordmark />

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <Segmented<Lang>
                ariaLabel={t('settings.language')}
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'id', label: 'ID' },
                  { value: 'en', label: 'EN' },
                ]}
              />
              <Segmented<Currency>
                ariaLabel={t('settings.currency')}
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'IDR', label: 'Rp' },
                  { value: 'USD', label: '$' },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={t('nav.menu')}
              className="grid size-9 place-items-center rounded-lg border border-line text-muted lg:hidden"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                {menuOpen ? (
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                ) : (
                  <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-line bg-panel px-4 py-3 lg:hidden">
            <nav className="grid gap-1">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
                  {t(item.key)}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex gap-2 border-t border-line pt-3 sm:hidden">
              <Segmented<Lang>
                ariaLabel={t('settings.language')}
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'id', label: 'ID' },
                  { value: 'en', label: 'EN' },
                ]}
              />
              <Segmented<Currency>
                ariaLabel={t('settings.currency')}
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'IDR', label: 'Rp' },
                  { value: 'USD', label: '$' },
                ]}
              />
            </div>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mt-8 border-t border-line bg-panel/40">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Disclaimer permanen — Section 11. Tidak disembunyikan di balik accordion. */}
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            <span className="font-medium text-gold">⚠ </span>
            {t('footer.disclaimer')}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span>
              <span className="text-muted/70">{t('footer.dataSources')}: </span>
              {t('footer.dataNote')}
            </span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-gold underline decoration-gold-dim underline-offset-2"
            >
              {t('footer.source')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
