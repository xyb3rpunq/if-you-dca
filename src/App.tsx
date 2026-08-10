import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.tsx';
import { SettingsProvider, useSettings } from './i18n/context.tsx';
import { Dashboard } from './pages/Dashboard.tsx';

/**
 * Hanya Dashboard yang ikut bundel awal.
 *
 * Halaman lain — terutama yang menarik TradingView Lightweight Charts — dimuat saat
 * benar-benar dibuka. Tanpa ini, seseorang yang cuma membuka Glosarium tetap
 * mengunduh seluruh mesin grafik, dan target proyek ini adalah dibaca sambil lalu
 * dari HP dengan koneksi seluler.
 */
const Simulator = lazy(() => import('./pages/Simulator.tsx').then((m) => ({ default: m.Simulator })));
const Rankings = lazy(() => import('./pages/Rankings.tsx').then((m) => ({ default: m.Rankings })));
const ValueLens = lazy(() => import('./pages/ValueLens.tsx').then((m) => ({ default: m.ValueLens })));
const Portfolio = lazy(() => import('./pages/Portfolio.tsx').then((m) => ({ default: m.Portfolio })));
const Glossary = lazy(() => import('./pages/Glossary.tsx').then((m) => ({ default: m.Glossary })));
const AssetDetail = lazy(() => import('./pages/AssetDetail.tsx').then((m) => ({ default: m.AssetDetail })));

function RouteFallback() {
  const { t } = useSettings();
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted" role="status" aria-live="polite">
      <span className="size-2 animate-pulse rounded-full bg-gold" aria-hidden />
      {t('common.loading')}
    </div>
  );
}

/**
 * HashRouter, bukan BrowserRouter.
 *
 * GitHub Pages menyajikan berkas statis: memuat langsung /peringkat akan menghasilkan
 * 404 karena tidak ada berkas di path itu. Trik 404.html bisa dipakai, tapi merusak
 * tombol Back dan membuat tautan yang dibagikan sempat berkedip. Hash tidak pernah
 * dikirim ke server, jadi setiap URL — termasuk hasil simulasi yang dibagikan —
 * langsung bisa dibuka.
 */
export function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route
              path="simulator"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Simulator />
                </Suspense>
              }
            />
            <Route
              path="peringkat"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Rankings />
                </Suspense>
              }
            />
            <Route
              path="value-lens"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <ValueLens />
                </Suspense>
              }
            />
            <Route
              path="rencana"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Portfolio />
                </Suspense>
              }
            />
            <Route
              path="istilah"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <Glossary />
                </Suspense>
              }
            />
            <Route
              path="aset/:id"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AssetDetail />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </SettingsProvider>
  );
}
