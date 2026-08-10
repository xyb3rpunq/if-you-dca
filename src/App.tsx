import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.tsx';
import { SettingsProvider } from './i18n/context.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Glossary } from './pages/Glossary.tsx';
import { Portfolio } from './pages/Portfolio.tsx';
import { Rankings } from './pages/Rankings.tsx';
import { Simulator } from './pages/Simulator.tsx';
import { ValueLens } from './pages/ValueLens.tsx';

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
            <Route path="simulator" element={<Simulator />} />
            <Route path="peringkat" element={<Rankings />} />
            <Route path="value-lens" element={<ValueLens />} />
            <Route path="rencana" element={<Portfolio />} />
            <Route path="istilah" element={<Glossary />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </SettingsProvider>
  );
}
