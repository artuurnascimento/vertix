import { useQuery } from '@tanstack/react-query'
import { callAppsProxy, isNaoConfigurado } from './appsProxy'
import type { AppProduto, VertixShop } from './appsProxy'
import type { AppBackendEstado } from './lojasStatus'

/**
 * Estado vivo do backend de um app (health + lista de lojas), cacheado
 * ~60s pelo TanStack Query. Erros viram estado ('offline' /
 * 'nao_configurado') em vez de exception — assim a lista não entra em
 * retry-loop quando um backend está fora ou sem secrets.
 */

const STALE_TIME_MS = 60_000

export interface AppStatus {
  estado: AppBackendEstado
  mensagem: string | null
  /** shop_domain → dados vivos; vazio quando o backend não respondeu. */
  shops: Record<string, VertixShop>
}

interface HealthResponse {
  ok?: boolean
  app?: string
  shops?: number
}

export function useAppStatus(produto: AppProduto): AppStatus {
  const { data, isLoading } = useQuery({
    queryKey: ['apps-proxy', produto, 'status'],
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AppStatus> => {
      try {
        const health = await callAppsProxy<HealthResponse>({
          app: produto,
          method: 'GET',
          path: '/api/vertix/health',
        })
        if (!health?.ok) {
          return {
            estado: 'offline',
            mensagem: 'Backend respondeu, mas reporta problema (health não-ok).',
            shops: {},
          }
        }

        const lista = await callAppsProxy<VertixShop[]>({
          app: produto,
          method: 'GET',
          path: '/api/vertix/shops',
        })
        const shops: Record<string, VertixShop> = {}
        for (const shop of Array.isArray(lista) ? lista : []) {
          shops[shop.shop] = shop
        }
        return { estado: 'ok', mensagem: null, shops }
      } catch (err) {
        if (isNaoConfigurado(err)) {
          return {
            estado: 'nao_configurado',
            mensagem: err instanceof Error ? err.message : null,
            shops: {},
          }
        }
        return {
          estado: 'offline',
          mensagem: err instanceof Error ? err.message : 'Backend não respondeu.',
          shops: {},
        }
      }
    },
  })

  if (isLoading || !data) {
    return { estado: 'carregando', mensagem: null, shops: {} }
  }
  return data
}
