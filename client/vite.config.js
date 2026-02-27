import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'ספוטליינר – Spotliner',
        short_name: 'ספוטליינר',
        description: 'האזן למוזיקה שמועלית על ידי הקהילה',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait-primary',
        dir: 'rtl',
        lang: 'he',
        icons: [
          { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
        ],
        start_url: '/',
        scope: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https?:\/\/.*\/api\//, handler: 'NetworkFirst', options: { cacheName: 'api', expiration: { maxEntries: 50 } } },
          { urlPattern: /^https?:\/\/.*\/uploads\//, handler: 'CacheFirst', options: { cacheName: 'uploads', expiration: { maxEntries: 100 } } },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
