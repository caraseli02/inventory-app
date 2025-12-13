import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: true },
  typescript: {
    strict: true,
  },
  modules: ['@nuxtjs/tailwindcss'],
  routeRules: {
    '/inventory': { ssr: false },
    '/checkout': { ssr: false },
    '/scan': { ssr: false },
  },
  app: {
    head: {
      title: 'Inventory App | Nuxt Scaffold',
      meta: [
        { name: 'description', content: 'Nuxt 3 scaffold for migrating the Inventory App.' },
      ],
    },
  },
  runtimeConfig: {
    blob: {
      readWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
    },
    public: {
      airtableApiKey: process.env.NUXT_PUBLIC_AIRTABLE_API_KEY,
      airtableBaseId: process.env.NUXT_PUBLIC_AIRTABLE_BASE_ID,
      imgbbApiKey: process.env.NUXT_PUBLIC_IMGBB_API_KEY,
      backendProxyUrl: process.env.NUXT_PUBLIC_BACKEND_PROXY_URL,
      proxyAuthToken: process.env.NUXT_PROXY_AUTH_TOKEN,
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
    viewer: false,
  },
})
