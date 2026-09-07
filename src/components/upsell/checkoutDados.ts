/**
 * Acesso a dados das telas pós-compra. Só leitura e uma cobrança — tudo o que
 * decide preço acontece no servidor; nada que o navegador manda muda valor.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CheckoutInfo, RespostaUpsell } from './upsellFluxo'
import type { StatusPedido } from './pedidoResumo'

/**
 * Chamada de RPC por nome solto.
 *
 * `src/lib/database.types.ts` é gerado a partir do banco e pertence a outro
 * agente; a função do checkout ainda não está lá, então o `supabase.rpc`
 * tipado recusa o nome. Este é o ÚNICO ponto de escape de tipo do módulo — no
 * dia em que os types forem regerados ele some e a chamada abaixo volta a ser
 * conferida pelo compilador.
 */
interface RespostaRpc {
  data: unknown
  error: { message: string } | null
}

function rpc(nome: string, args: Record<string, unknown>): Promise<RespostaRpc> {
  const chamar = supabase.rpc as unknown as (
    nome: string,
    args: Record<string, unknown>
  ) => Promise<RespostaRpc>
  return chamar(nome, args)
}

/**
 * Configuração do checkout pelo slug. Mesma RPC que a tela de checkout usa —
 * cai no cache do react-query, então quem vem do checkout não paga a ida.
 */
export function useCheckoutInfo(slug: string | undefined) {
  return useQuery({
    queryKey: ['checkout-info', slug],
    enabled: Boolean(slug),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<CheckoutInfo> => {
      const { data, error } = await rpc('get_checkout_info', { p_slug: slug })
      if (error) throw new Error(error.message)
      return data as CheckoutInfo
    },
  })
}

/**
 * Status do pedido já pago, pela edge function `checkout-info`.
 *
 * É daqui que sai a resposta para a pergunta que decide a tela inteira: existe
 * cartão salvo neste pedido? Quem pagou por Pix nunca terá, e há caminhos em
 * que o cartão não foi guardado mesmo tendo sido usado — nesses casos a oferta
 * de um toque simplesmente não existe.
 *
 * Falha de rede não vira tela de erro: devolvemos null e a confirmação se vira
 * com o que a sessão já sabe (ver pedidoResumo.montarResumo). O que NÃO pode
 * acontecer é tratar "não sei" como "tem cartão salvo" — por isso o null
 * propaga e a página de upsell interpreta ausência como "sem cartão".
 */
export function useStatusPedido(pedidoId: string | undefined) {
  return useQuery({
    queryKey: ['checkout-status-pedido', pedidoId],
    enabled: Boolean(pedidoId),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<StatusPedido | null> => {
      try {
        const { data, error } = await supabase.functions.invoke(
          'checkout-info',
          { body: { pedido_id: pedidoId } }
        )
        if (error) return null
        return (data ?? null) as StatusPedido | null
      } catch {
        return null
      }
    },
  })
}

export interface EntradaCobranca {
  pedidoId: string
  produtoId: string
  /**
   * Token de uso único gerado no navegador pelo SDK do Mercado Pago a partir
   * do cartão salvo (ver cardToken.ts). NUNCA um CVV: o backend recusa um
   * corpo com código de segurança, e com razão.
   */
  cardToken: string
}

/**
 * Cobra a oferta no cartão salvo do primeiro pagamento.
 *
 * O corpo carrega apenas ids e o token — nunca número, validade ou código de
 * segurança do cartão. Quem tem o cartão tokenizado é o gateway.
 *
 * A edge function pode responder o erro com status não-2xx; nesse caso o
 * supabase-js entrega um FunctionsHttpError com a Response original em
 * `context`. Lemos o corpo de lá para não perder o código do erro — é ele que
 * diz se a falha foi no código de segurança ou em outra coisa.
 */
export async function cobrarUpsell({
  pedidoId,
  produtoId,
  cardToken,
}: EntradaCobranca): Promise<RespostaUpsell> {
  const { data, error } = await supabase.functions.invoke('checkout-upsell', {
    body: {
      pedido_id: pedidoId,
      produto_id: produtoId,
      card_token: cardToken,
    },
  })

  if (error) {
    const corpo = await lerCorpoDoErro(error)
    if (corpo) return corpo
    return { ok: false, erro: 'falha_rede' }
  }

  return (data ?? { ok: false, erro: 'resposta_vazia' }) as RespostaUpsell
}

async function lerCorpoDoErro(erro: unknown): Promise<RespostaUpsell | null> {
  const contexto = (erro as { context?: unknown })?.context
  if (!(contexto instanceof Response)) return null
  try {
    return (await contexto.clone().json()) as RespostaUpsell
  } catch {
    return null
  }
}
