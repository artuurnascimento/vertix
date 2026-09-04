import { supabase } from '../../lib/supabase'

/**
 * Cliente tipado da edge function apps-proxy — única ponte entre o painel
 * e as APIs de serviço dos apps próprios (Recover/Reviews/Scan). Os tokens
 * de serviço vivem só nos secrets da function; aqui trafega apenas o JWT do
 * usuário logado (anexado pelo supabase-js).
 */

/** Apps por loja Shopify (aparecem no módulo Lojas). */
export type AppProduto = 'recover' | 'reviews'

/** Todos os apps atendidos pelo apps-proxy (Scan não é app por loja). */
export type AppVertix = AppProduto | 'scan'

export const PRODUTOS: AppProduto[] = ['recover', 'reviews']

export const PRODUTO_META: Record<AppProduto, { label: string; nome: string }> = {
  recover: { label: 'Recover', nome: 'Vertix Recover' },
  reviews: { label: 'Reviews', nome: 'Vertix Reviews' },
}

/** Loja como o backend do app a enxerga (GET /api/vertix/shops). */
export interface VertixShop {
  shop: string
  fromName: string | null
  language: 'en' | 'fr' | null
  enabled: boolean
  smsEnabled: boolean
  onboardedAt: string | null
  hasOwnResendKey: boolean
  hasOwnTwilioCreds: boolean
}

/** GET /api/vertix/shops/:shop/stats?from&to */
export interface VertixStats {
  carts: { total: number; pending: number; recovered: number }
  emailsSent: number
  smsSent: number
  revenueRecovered: { amount: number; currency: string }
}

/** Campos seguros de GET/PATCH /api/vertix/shops/:shop/settings */
export interface VertixSettings {
  enabled: boolean
  discountPercent: number
  language: 'en' | 'fr'
  delay1Minutes: number
  delay2Minutes: number
  smsEnabled: boolean
  smsDelayMinutes: number
  fromEmail: string | null
  logoUrl: string | null
  onboardedAt: string | null
}

interface ProxyRequest {
  app: AppVertix
  method: 'GET' | 'PATCH' | 'POST'
  path: string
  body?: unknown
}

/** Erro do proxy/backend com o status HTTP preservado para o chamador. */
export class ProxyError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ProxyError'
    this.status = status
  }
}

/** Marca de "app sem URL/token configurado" (503 da edge function). */
export function isNaoConfigurado(err: unknown): boolean {
  return err instanceof ProxyError && err.status === 503
}

/**
 * Chama a edge function apps-proxy e devolve o JSON do backend. Non-2xx
 * vira ProxyError com a mensagem do corpo (padrão do sync no Trafego).
 */
export async function callAppsProxy<T>(request: ProxyRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke('apps-proxy', {
    body: request,
  })

  if (error) {
    let detail = ''
    let status = 0
    try {
      const ctx = (
        error as {
          context?: {
            status?: number
            json?: () => Promise<{ error?: string }>
          }
        }
      ).context
      status = ctx?.status ?? 0
      detail = (await ctx?.json?.())?.error ?? ''
    } catch {
      detail = ''
    }
    throw new ProxyError(detail || error.message, status)
  }

  return data as T
}

/** Janela de 30 dias (ISO) para o stats padrão do detalhe. */
export function statsRange30d(now = new Date()): { from: string; to: string } {
  const from = new Date(now)
  from.setDate(from.getDate() - 30)
  return { from: from.toISOString(), to: now.toISOString() }
}

/** Receita recuperada na moeda que o backend devolveu (fallback: código cru). */
export function formatMoeda(amount: number, currency: string): string {
  try {
    return amount.toLocaleString('pt-BR', { style: 'currency', currency })
  } catch {
    return `${currency} ${amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
}
