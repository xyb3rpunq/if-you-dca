import { defineConfig } from 'vitest/config';
import type { ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cp, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, 'data');

/**
 * Section 8 dari CLAUDE.md menaruh dataset di `data/` (root repo), bukan `public/`,
 * supaya GitHub Actions bisa commit ke sana tanpa nyampur dengan aset frontend.
 * Plugin kecil ini menjembatani keduanya: serve `data/` saat dev, salin ke `dist/`
 * saat build. Sengaja tanpa dependency tambahan.
 */
function serveDataDir() {
  let isBuild = false;
  return {
    name: 'value-terminal:data-dir',
    configResolved(config: { command: string }) {
      isBuild = config.command === 'build';
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith('/data/')) return next();
        // normalize() + pemeriksaan awalan menutup path traversal (../) lewat URL.
        const filePath = normalize(join(DATA_DIR, decodeURIComponent(url.slice('/data/'.length))));
        if (!filePath.startsWith(DATA_DIR)) return next();
        stat(filePath)
          .then((info) => {
            if (!info.isFile()) return next();
            const type = extname(filePath) === '.json' ? 'application/json' : 'text/plain';
            res.setHeader('content-type', `${type}; charset=utf-8`);
            createReadStream(filePath).pipe(res);
          })
          .catch(() => next());
      });
    },
    async closeBundle() {
      if (!isBuild) return;
      await cp(DATA_DIR, resolve(import.meta.dirname, 'dist/data'), {
        recursive: true,
        force: true,
      }).catch((err: Error) => {
        console.warn(`[value-terminal] gagal menyalin data/ ke dist/: ${err.message}`);
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages project site: https://xyb3rpunq.github.io/if-you-dca/
  base: process.env.VT_BASE ?? '/if-you-dca/',
  plugins: [react(), tailwindcss(), serveDataDir()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
