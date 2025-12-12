export default defineNuxtConfig({
  devtools: { enabled: true },
  typescript: {
    strict: true,
  },
  modules: ['@nuxtjs/tailwindcss'],
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
