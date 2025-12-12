import { QueryClient } from '@tanstack/vue-query';

export const vueQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default vueQueryClient;
