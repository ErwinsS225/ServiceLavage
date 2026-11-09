import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Vite serves the project root in development, which would expose `docs/`,
 * `tests/`, `supabase/` and `.env*` over HTTP. Only the application entry
 * points and `public/` are meant to be reachable.
 */
function devRootAllowList(): Plugin {
  return {
    name: 'dev-root-allow-list',
    apply: 'serve',
    configureServer(server) {
      const blocked = /^\/(docs|tests|supabase|\.aistudio)(\/|$)/;
      server.middlewares.use((req, _res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (blocked.test(pathname) || pathname.includes('..')) {
          _res.statusCode = 404;
          _res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          _res.end('Not found');
          return;
        }
        next();
      });
    },
  };
}

/** Precache only build artifacts, never API, auth or tenant data. */
function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    apply: 'build',
    writeBundle(options, bundle) {
      const dir = options.dir || 'dist';
      const files = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
        ...Object.keys(bundle).filter(file => file.startsWith('assets/') && /\.(js|css)$/.test(file))];
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(path.join(dir, file)));
      const version = hash.digest('hex').slice(0, 16);
      const worker = `// Static application shell only; no API responses or user data are cached.\n` +
        `const CACHE = ${JSON.stringify(`servicelavage-shell-${version}`)};\n` +
        `const FILES = ${JSON.stringify(files.map(file => `/${file}`))};\n` +
        `self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));\n` +
        `self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('servicelavage-shell-') && key !== CACHE).map(key => caches.delete(key))))));\n` +
        `self.addEventListener('fetch', event => {\n` +
        `  const url = new URL(event.request.url);\n` +
        `  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;\n` +
        `  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html')))); return; }\n` +
        `  if (FILES.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(response => response || fetch(event.request)));\n` +
        `});\n`;
      writeFileSync(path.join(dir, 'sw.js'), worker);
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), devRootAllowList(), offlineShell()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  server: {
    // Arena proxies the app under this preview suffix; keep Vite's host check enabled for other hosts.
    allowedHosts: ['.e2b.app'],
    // AI Studio can disable file watching to avoid flickering during edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
