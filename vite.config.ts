import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// The dev server proxies the API hosts so the app can be tried in a desktop browser;
// it strips Origin because YouTube only allows `Origin: null` (what the TV's file:// app sends).
const proxy = (target: string) => ({
  target,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/_\w+/, ''),
  configure: (px: any) => px.on('proxyReq', (req: any) => (req.removeHeader('origin'), req.removeHeader('referer'))),
})

// Widget runs from file://, so: relative base, one classic script (see scripts/pack.mjs).
// Tizen 5.5 is about Chromium 69 (assumed; Settings > Diagnostics prints the real value).
export default defineConfig({
  base: './',
  plugins: [preact()],
  server: {
    proxy: {
      '/_ytm': proxy('https://music.youtube.com'),
      '/_yt': proxy('https://www.youtube.com'),
      '/_saavn': proxy('https://www.jiosaavn.com'),
      '/_lrclib': proxy('https://lrclib.net'),
    },
  },
  build: {
    target: 'chrome69',
    cssTarget: 'chrome69',
    modulePreload: false,
    assetsInlineLimit: 0,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  test: { environment: 'node' },
})
