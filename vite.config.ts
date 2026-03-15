import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

import { VitePWA } from 'vite-plugin-pwa'

function normalizeSimPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '+40000000000';
  if (trimmed.startsWith('+')) return trimmed;
  return `+${trimmed}`;
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        resolve(body ?? {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseUrlEncodedBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      if (chunks.length === 0) { resolve({}); return; }
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      resolve(Object.fromEntries(params.entries()));
    });
  });
}

function localWhatsappSimulatorPlugin(): PluginOption {
  return {
    name: 'local-whatsapp-simulator',
    apply: 'serve',
    configureServer(server) {
      // Mount the real webhook handler so `pnpm whatsapp:replay` works locally
      server.middlewares.use('/api/whatsapp', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        try {
          const body = (req.headers['content-type'] ?? '').includes('json')
            ? await parseJsonBody(req)
            : await parseUrlEncodedBody(req);

          // Adapt Node req/res to the shape the webhook handler expects (VercelRequest/VercelResponse)
          const webhookModule = await server.ssrLoadModule('/lib/whatsapp/webhook.ts');
          const fakeReq = {
            method: req.method,
            headers: req.headers,
            body,
            url: req.url,
          };
          const fakeRes = {
            _statusCode: 200,
            _headers: {} as Record<string, string>,
            _body: '',
            status(code: number) { fakeRes._statusCode = code; return fakeRes; },
            setHeader(key: string, value: string) { fakeRes._headers[key] = value; return fakeRes; },
            json(data: unknown) { fakeRes._body = JSON.stringify(data); return fakeRes; },
            send(data: string) { fakeRes._body = data; return fakeRes; },
            end() { return fakeRes; },
          };

          await webhookModule.default(fakeReq, fakeRes);

          res.statusCode = fakeRes._statusCode;
          for (const [key, value] of Object.entries(fakeRes._headers)) {
            res.setHeader(key, value);
          }
          res.end(fakeRes._body);
        } catch (error) {
          console.error('[local-whatsapp-webhook] failed:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Webhook handler failed' }));
        }
      });

      server.middlewares.use('/api/whatsapp-simulate', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        try {
          const body = await parseJsonBody(req);
          const phone = normalizeSimPhone(String(body.phone ?? ''));
          const name = String(body.name ?? 'Simulator').trim() || 'Simulator';
          const reset = Boolean(body.reset);
          const text = String(body.text ?? '').trim();

          const expectedSecret = process.env.WHATSAPP_SIMULATOR_SECRET ?? process.env.VITE_NOTIFY_SECRET ?? '';
          const providedSecret = String(req.headers['x-notify-secret'] ?? '');
          if (expectedSecret && providedSecret !== expectedSecret) {
            sendJson(res, 401, { ok: false, error: 'Unauthorized' });
            return;
          }

          const simulatorModule = await server.ssrLoadModule('/lib/whatsapp/simulator.ts');
          const stateModule = await server.ssrLoadModule('/lib/whatsapp/conversation-state.ts');
          const mode = String(body.mode ?? 'agent');
          const debug = Boolean(body.debug);
          if (reset) {
            await stateModule.resetConversationHistory(phone);
            sendJson(res, 200, { ok: true });
            return;
          }

          if (!text) {
            sendJson(res, 400, { ok: false, error: 'text is required' });
            return;
          }

          if (mode === 'direct') {
            const reply = await simulatorModule.buildLocalSimulationReply(phone, name, text);
            sendJson(res, 200, { ok: true, reply, provider: 'local' });
            return;
          }

          const result = await simulatorModule.buildSimulatorReply(phone, name, text);
          sendJson(res, 200, {
            ok: true,
            reply: result.reply,
            provider: result.provider,
            ...(debug ? { debug: result.debug } : {}),
          });
        } catch (error) {
          console.error('[local-whatsapp-simulate] failed:', error);
          sendJson(res, 500, { ok: false, error: 'Simulation failed' });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  const invoiceApiTarget = (process.env.VITE_INVOICE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  return {
  server: {
    proxy: {
      // Dev-only proxy for invoice FastAPI endpoints to avoid browser CORS in local setup.
      '/extract': {
        target: invoiceApiTarget,
        changeOrigin: true,
      },
      '/invoice': {
        target: invoiceApiTarget,
        changeOrigin: true,
      },
    },
  },
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
    localWhatsappSimulatorPlugin(),
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
        // SPA navigation fallback for deep links (e.g. /checkout) and offline refresh.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/assets\//,
          /\/favicon\.ico$/,
          /\/manifest\.webmanifest$/,
        ],
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
  };
})
