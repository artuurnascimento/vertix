import { QueryClient } from '@tanstack/react-query'

const STALE_TIME_MS = 30_000

/** Singleton do React Query — importado uma única vez no main.tsx. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
