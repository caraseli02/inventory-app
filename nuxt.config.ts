import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,
  plugins: [
    { src: './plugins/vue-query.client', mode: 'client' },
    { src: './plugins/logger' },
    { src: './plugins/i18n.client', mode: 'client' },
  ],
})
