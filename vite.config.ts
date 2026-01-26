
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Halagel Production Dashboard',
        short_name: 'HalagelMfg',
        description: 'Offline-capable manufacturing production dashboard',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M2 20V9l4-2 4 2V4l4-2 4 2v16H2Z"/%3E%3Cpath d="M6 17h1"/%3E%3Cpath d="M6 13h1"/%3E%3Cpath d="M10 17h1"/%3E%3Cpath d="M10 13h1"/%3E%3Cpath d="M14 17h1"/%3E%3Cpath d="M14 13h1"/%3E%3Cpath d="M18 17h1"/%3E%3Cpath d="M18 13h1"/%3E%3Cpath d="M18 9h1"/%3E%3Cpath d="M18 5h1"/%3E%3C/svg%3E',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="M2 20V9l4-2 4 2V4l4-2 4 2v16H2Z"/%3E%3Cpath d="M6 17h1"/%3E%3Cpath d="M6 13h1"/%3E%3Cpath d="M10 17h1"/%3E%3Cpath d="M10 13h1"/%3E%3Cpath d="M14 17h1"/%3E%3Cpath d="M14 13h1"/%3E%3Cpath d="M18 17h1"/%3E%3Cpath d="M18 13h1"/%3E%3Cpath d="M18 9h1"/%3E%3Cpath d="M18 5h1"/%3E%3C/svg%3E',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.dicebear\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'avatars-cache'
            }
          }
        ]
      }
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
