import { defineNuxtPlugin } from '#app'
import { VueQueryPlugin, QueryClient, QueryCache, MutationCache } from '@tanstack/vue-query'
import { logger } from '@/lib/logger'

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 10,
        staleTime: 1000 * 60 * 5,
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.error('Vue Query error', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          queryKey: query.queryKey,
          queryHash: query.queryHash,
        })
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logger.error('Vue Query mutation error', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          mutationKey: mutation.options.mutationKey,
        })
      },
    }),
  })

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = createQueryClient()
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  nuxtApp.provide('vueQueryClient', queryClient)
})
