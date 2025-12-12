import { defineNuxtPlugin } from '#app'
import { logger } from '@/lib/logger'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (error, context) => {
    logger.error('Unhandled Vue error', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      component: context?.component?.type?.name,
      props: context?.props,
    })
  })

  nuxtApp.hook('app:error', (error) => {
    logger.error('Nuxt app error', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
  })

  return {
    provide: {
      logger,
    },
  }
})
