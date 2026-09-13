/**
 * Acesso a dados das telas pós-compra. Só leitura e uma cobrança — tudo o que
 * decide preço acontece no servidor; nada que o navegador manda muda valor.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { CheckoutInfo, RespostaUpsell } from './upsellFluxo'
import type { StatusPedido } from './pedidoResumo'

/**
 * Configuração do checkout pelo slug, na forma CRUA da RPC — é dela que
 * `resolverOferta` tira `upsell_produto_id`, título, texto e preço.
 *
 * Duas decisões aqui foram defeitos em produção, e por isso estão escritas:
 *
 * 1. A chamada é `supabase.rpc(...)`, no cliente. A versão anterior guardava
 *    `supabase.rpc` numa variável e chamava solta; o método usa `this.rest`,
 *    o `this` sumia e a função estourava ANTES de qualquer requisição. A
 *    query caía em erro, e a tela de upsell tem `isError → obrigado`: nenhum
 *    comprador jamais viu o upsell nem o downsell.
 *
 * 2. A chave é PRÓPRIA (`checkout-info-cru`), não a `checkout-info` da tela
 *    de checkout. Aquela guarda o objeto já normalizado por `checkoutApi`
 *    (`temUpsell: true`, sem `upsell_produto_id`); reaproveitá-la parecia
 *    poupar uma ida ao banco, mas entregava a forma errada e, sem o id do
 *    produto, a oferta não se resolvia — segundo caminho para o mesmo
 *    obrigado. A ida extra custa uma RPC atrás do "Confirmando seu pedido…".
 */
export function useCheckoutInfo(slug: string | undefined) {
  return useQuery({
    queryKey: ['checkout-info-cru', slug],
    enabled: Boolean(slug),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<CheckoutInfo> => {
      const { data, error } = await supabase.rpc('get_checkout_info', {
        p_slug: slug ?? '',
      })
      if (error) throw new Error(error.message)
      return data as unknown as CheckoutInfo
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
/** De quanto em quanto tempo reconsultar enquanto o pagamento não fecha. */
const INTERVALO_PENDENTE_MS = 8_000

/**
 * @param acompanhar Reconsulta sozinho enquanto o pedido não estiver pago.
 *   Existe para a confirmação de um Pix: a pessoa paga no app do banco com a
 *   página aberta ao lado, e sem isso ficaria olhando "aguardando" para
 *   sempre, mesmo depois de o dinheiro cair. A `checkout-info` já pergunta ao
 *   Mercado Pago quando o pedido está aguardando, então cada consulta traz o
 *   estado real, e não uma cópia velha do nosso banco.
 *
 *   Desligado por padrão porque a página de upsell lê o status uma vez só,
 *   para decidir se oferece o cartão salvo — repetir ali seria consulta à toa.
 */
export function useStatusPedido(
  pedidoId: string | undefined,
  acompanhar = false
) {
  return useQuery({
    queryKey: ['checkout-status-pedido', pedidoId],
    enabled: Boolean(pedidoId),
    retry: false,
    // Sem cache enquanto acompanha: com `staleTime` alto o refetch devolveria
    // o valor guardado, e a tela nunca sairia de "aguardando".
    staleTime: acompanhar ? 0 : 60_000,
    refetchInterval: (query) => {
      if (!acompanhar) return false
      const status = query.state.data?.status
      // Para de perguntar assim que existe desfecho: pago, recusado e
      // reembolsado não voltam atrás.
      return status === 'aguardando' || status === undefined || status === null
        ? INTERVALO_PENDENTE_MS
        : false
    },
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
