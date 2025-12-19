import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],

          // React Query (TanStack Query)
          'query-vendor': ['@tanstack/react-query'],

          // Airtable SDK
          'airtable-vendor': ['airtable'],

          // UI libraries (Radix UI primitives for shadcn)
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-icons',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-select',
          ],

          // Scanner library (html5-qrcode is heavy ~150KB)
          'scanner-vendor': ['html5-qrcode'],
        },
      },
    },
    // Adjust chunk size warning limit
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Grocery Inventory Manager',
        short_name: 'Inventory',
        description: 'Manage grocery stock and barcodes',
        theme_color: '#0f172a',
        background_color: '#FAFAF9',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'any', // Changed from 'portrait' to support iPad landscape
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // Force new service worker to activate immediately
        skipWaiting: true,
        // Take control of all pages immediately
        clientsClaim: true,
        // Clean up old caches to prevent chunk mismatch
        cleanupOutdatedCaches: true,
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
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
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
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/api\/v0\/product\/.*\.json/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // <== 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/images\.openfoodfacts\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // <== 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Supabase Edge Functions - don't cache, always get fresh
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-functions-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 5 // <== 5 minutes fallback only
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})
