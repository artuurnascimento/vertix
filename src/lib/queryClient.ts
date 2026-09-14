import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { capturar } from './log'

const STALE_TIME_MS = 30_000

/** Singleton do React Query — importado uma única vez no main.tsx. */
export const queryClient = new QueryClient({
  // Toda consulta ou mutação que falha vai para a trilha de logs com a chave
  // (de onde veio) — o componente continua tratando o erro na tela como
  // sempre; aqui é só para a equipe ver depois o que quebrou e quando.
  queryCache: new QueryCache({
    onError: (erro, query) =>
      capturar('react-query', 'consulta_falhou', erro, {
        detalhes: { chave: query.queryKey.slice(0, 4) },
      }),
  }),
  mutationCache: new MutationCache({
    onError: (erro, _variaveis, _contexto, mutation) =>
      capturar('react-query', 'mutacao_falhou', erro, {
        detalhes: { chave: mutation.options.mutationKey?.slice(0, 4) ?? null },
      }),
  }),
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
