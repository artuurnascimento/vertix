/**
 * Conversas do checkout com o backend: um RPC para carregar a oferta e duas
 * edge functions (cupom e pagamento).
 *
 * Contrato final acordado com o backend:
 *   rpc get_checkout_info(p_slug) → { checkout, produto, bump, upsell,
 *                                     downsell, prova, garantia,
 *                                     cronometro_ate }
 *   POST /checkout-pagar  → { pedido_id, status, total_centavos,
 *                             pix?{qr,copia_cola},
 *                             cartao_salvo?{card_id,ultimos_digitos},
 *                             plano_code?, erro? }
 *   POST /cupom-validar   → { valido, desconto_centavos, mensagem,
 *                             total_centavos, subtotal_centavos,
 *                             desconto_cupom_centavos,
 *                             desconto_metodo_centavos }
 *                           body { slug, codigo, bump, metodo }
 *
 * ATENÇÃO ao `desconto_centavos` da /cupom-validar: ele é a SOMA de cupom +
 * desconto do método, não só o cupom. Quem quiser as duas linhas separadas no
 * resumo tem que ler `desconto_cupom_centavos` e `desconto_metodo_centavos`.
 */

import { supabase } from '../../lib/supabase'
import { normalizarCheckout, type CheckoutInfo } from './checkoutTypes'

/** Public Key do Mercado Pago: pública por definição (identifica a conta no
 *  SDK do navegador). O Access Token continua só nas edge functions.
 *
 *  CONSTANTE, sem override por env, e isso é deliberado: quem lê esta chave é
 *  o Payment Brick, que serve TODO o tráfego. Uma env `TEST-...` publicada
 *  aqui para experimentar o formulário novo faria o Brick tokenizar contra a
 *  conta de teste e RECUSAR TODO CARTÃO REAL — e `?sf=0` não resgataria,
 *  porque a env é resolvida no build, não na URL.
 *
 *  O caminho novo (Secure Fields) tem a própria env, isolada, em
 *  `campos/mpInstancia.ts`. */
export const MP_PUBLIC_KEY = 'APP_USR-53c10a53-70e6-4c45-90eb-cc3472aa51dd'

export interface ClienteCheckout {
  nome: string
  email: string
  whatsapp: string
  documento: string
}

export interface PixCheckout {
  /** QR em base64, data URL ou URL de imagem — a tela decide como exibir. */
  qr: string | null
  copiaCola: string | null
}

export interface CartaoSalvo {
  cardId: string
  ultimosDigitos: string | null
}

export type StatusPedido = 'aprovado' | 'pendente' | 'recusado'

export interface RespostaPagamento {
  pedidoId: string | null
  status: StatusPedido
  /** Total que o servidor realmente cobrou. Manda nele, não na prévia. */
  totalCentavos: number | null
  pix: PixCheckout | null
  cartaoSalvo: CartaoSalvo | null
  /** Código de erro cru do backend, quando houver. */
  erro: string | null
  /** Mensagem já legível vinda do backend (cupom, gateway). */
  mensagem: string | null
}

export interface RespostaCupom {
  valido: boolean
  /** SOMA dos abatimentos (cupom + método), como o servidor manda. */
  descontoCentavos: number
  /**
   * Abatimento só do CUPOM. `null` quando o servidor ainda não manda a
   * separação — nesse caso a tela cai na atribuição antiga (tudo no cupom).
   */
  descontoCupomCentavos: number | null
  /** Abatimento só do MÉTODO de pagamento. `null` = servidor sem separação. */
  descontoMetodoCentavos: number | null
  mensagem: string | null
  /** Totais já calculados no servidor — a prévia da tela vira cópia deles. */
  totalCentavos: number | null
  subtotalCentavos: number | null
}

type Registro = Record<string, unknown>

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function stringOuNull(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null
}

function inteiroOuNull(valor: unknown): number | null {
  const numero = typeof valor === 'string' ? Number(valor) : valor
  return typeof numero === 'number' && Number.isFinite(numero)
    ? Math.round(numero)
    : null
}

/**
 * Corpo de uma resposta não-2xx da edge function.
 *
 * O supabase-js NÃO entrega `data` quando o status é de erro: ele devolve um
 * FunctionsHttpError com a Response original pendurada em `context`. Sem ler
 * de lá, um `cupom_invalido` (400) ou um `gateway_recusou` (502) chegariam
 * aqui como "erro de rede" e a pessoa veria a mensagem errada.
 */
async function lerCorpoDoErro(erro: unknown): Promise<Registro | null> {
  const contexto = (erro as { context?: unknown })?.context
  if (!(contexto instanceof Response)) return null
  try {
    const corpo: unknown = await contexto.clone().json()
    return ehRegistro(corpo) ? corpo : null
  } catch {
    return null
  }
}

export async function buscarCheckout(slug: string): Promise<CheckoutInfo> {
  const { data, error } = await supabase.rpc('get_checkout_info', {
    p_slug: slug,
  })
  if (error) throw new Error(error.message)

  const info = normalizarCheckout(data, slug)
  if (info === null) throw new Error('checkout_indisponivel')
  return info
}

/**
 * Vocabulário de status do backend (`statusDoPedido` da checkout-pagar):
 * 'pago' | 'aguardando' | 'recusado' | 'reembolsado'. Aceitamos também os
 * termos crus do Mercado Pago por segurança. Tudo que não é claramente pago ou
 * aguardando vira recusa — errar para o lado de "não deu certo" é melhor que
 * mandar alguém para a página de obrigado sem ter pago.
 */
function lerStatus(valor: unknown): StatusPedido {
  const status = typeof valor === 'string' ? valor.toLowerCase() : ''
  if (status === 'pago' || status === 'aprovado' || status === 'approved') {
    return 'aprovado'
  }
  if (
    status === 'aguardando' ||
    status === 'pendente' ||
    status === 'pending' ||
    status === 'in_process' ||
    status === 'authorized'
  ) {
    return 'pendente'
  }
  return 'recusado'
}

function lerPix(valor: unknown): PixCheckout | null {
  if (!ehRegistro(valor)) return null
  const qr = stringOuNull(valor.qr) ?? stringOuNull(valor.qr_code_base64)
  const copiaCola =
    stringOuNull(valor.copia_cola) ?? stringOuNull(valor.qr_code)
  if (qr === null && copiaCola === null) return null
  return { qr, copiaCola }
}

function lerCartaoSalvo(valor: unknown): CartaoSalvo | null {
  if (!ehRegistro(valor)) return null
  const cardId = stringOuNull(valor.card_id) ?? stringOuNull(valor.cardId)
  if (cardId === null) return null
  return {
    cardId,
    ultimosDigitos:
      stringOuNull(valor.ultimos_digitos) ?? stringOuNull(valor.ultimosDigitos),
  }
}

export interface PedidoRequisicao {
  slug: string
  cliente: ClienteCheckout
  formData: unknown
  bump: boolean
  cupom: string | null
  /**
   * Segundo token do cartão, gerado no mesmo submit só para SALVAR o cartão —
   * o token do `formData` é de uso único e morre ao criar o pagamento. É
   * acessório: sem ele a venda passa igual, só o upsell perde o caminho curto.
   */
  cardTokenSalvar: string | null
}

function lerRespostaPagamento(corpo: Registro): RespostaPagamento {
  const erro = stringOuNull(corpo.erro) ?? stringOuNull(corpo.error)
  return {
    pedidoId: stringOuNull(corpo.pedido_id) ?? stringOuNull(corpo.pedidoId),
    status: erro !== null ? 'recusado' : lerStatus(corpo.status),
    totalCentavos: inteiroOuNull(corpo.total_centavos),
    pix: lerPix(corpo.pix),
    cartaoSalvo: lerCartaoSalvo(corpo.cartao_salvo),
    erro,
    mensagem: stringOuNull(corpo.mensagem) ?? stringOuNull(corpo.message),
  }
}

export async function pagarCheckout(
  pedido: PedidoRequisicao
): Promise<RespostaPagamento> {
  const { data, error } = await supabase.functions.invoke('checkout-pagar', {
    body: {
      slug: pedido.slug,
      cliente: pedido.cliente,
      formData: pedido.formData,
      bump: pedido.bump,
      ...(pedido.cupom ? { cupom: pedido.cupom } : {}),
      ...(pedido.cardTokenSalvar
        ? { card_token_salvar: pedido.cardTokenSalvar }
        : {}),
    },
  })

  if (error) {
    const corpo = await lerCorpoDoErro(error)
    // Sem corpo legível não houve resposta da função: não há pedido, e fingir
    // "pendente" faria a pessoa esperar por algo que nunca vai confirmar.
    if (corpo === null) throw new Error(error.message)
    return lerRespostaPagamento(corpo)
  }

  return lerRespostaPagamento(ehRegistro(data) ? data : {})
}

/**
 * Valida o cupom no servidor. O `bump` vai junto porque desconto percentual
 * incide sobre o subtotal: sem ele, quem marcou o bump veria um desconto menor
 * na tela do que o que seria realmente aplicado.
 *
 * O `metodo` vai pelo mesmo motivo, um passo adiante: o desconto do Pix incide
 * sobre o subtotal JÁ descontado o cupom, então o `total_centavos` da resposta
 * depende dos dois. Mudar de método invalida a resposta anterior tanto quanto
 * marcar o bump invalida.
 */
export async function validarCupom(
  slug: string,
  codigo: string,
  bump: boolean,
  metodo: string
): Promise<RespostaCupom> {
  const { data, error } = await supabase.functions.invoke('cupom-validar', {
    body: { slug, codigo, bump, metodo },
  })

  const corpo = error
    ? await lerCorpoDoErro(error)
    : ehRegistro(data)
      ? data
      : {}
  if (corpo === null) throw new Error('cupom_indisponivel')

  const desconto = inteiroOuNull(corpo.desconto_centavos) ?? 0
  const descontoCupom = inteiroOuNull(corpo.desconto_cupom_centavos)
  const descontoMetodo = inteiroOuNull(corpo.desconto_metodo_centavos)

  // O cupom vale quando o SERVIDOR diz que vale E ele sozinho abateu alguma
  // coisa. Sem esta distinção, um código inexistente num checkout com desconto
  // no Pix passaria por válido: `desconto_centavos` viria positivo por causa
  // do Pix, e a tela mostraria "cupom aplicado" para um código que não existe.
  const abatimentoDoCupom = descontoCupom ?? desconto

  return {
    valido: corpo.valido === true && abatimentoDoCupom > 0,
    descontoCentavos: Math.max(0, desconto),
    descontoCupomCentavos:
      descontoCupom === null ? null : Math.max(0, descontoCupom),
    descontoMetodoCentavos:
      descontoMetodo === null ? null : Math.max(0, descontoMetodo),
    mensagem: stringOuNull(corpo.mensagem) ?? stringOuNull(corpo.message),
    totalCentavos: inteiroOuNull(corpo.total_centavos),
    subtotalCentavos: inteiroOuNull(corpo.subtotal_centavos),
  }
}
