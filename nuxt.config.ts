import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: true },
  typescript: {
    strict: true,
  },
  modules: ['@nuxtjs/tailwindcss'],
  plugins: [
    { src: './plugins/vue-query.client', mode: 'client' },
    { src: './plugins/logger' },
    { src: './plugins/i18n.client', mode: 'client' },
  ],
  app: {
    head: {
      title: 'Inventory App | Nuxt Scaffold',
      meta: [
        { name: 'description', content: 'Nuxt 3 scaffold for migrating the Inventory App.' },
      ],
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config.ts',
    viewer: false,
  },
})
