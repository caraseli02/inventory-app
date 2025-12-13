import { defineNuxtPlugin } from '#app'
import { logger } from '@/lib/logger'

type VueErrorContext = {
  component?: {
    type?: { name?: string }
    $options?: { name?: string }
    $props?: Record<string, unknown>
  }
  props?: Record<string, unknown>
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (error, context) => {
    const ctx = context as VueErrorContext | undefined
    const componentName = ctx?.component?.type?.name ?? ctx?.component?.$options?.name
    const props = ctx?.component?.$props ?? ctx?.props

    logger.error('Unhandled Vue error', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      component: componentName,
      props,
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
