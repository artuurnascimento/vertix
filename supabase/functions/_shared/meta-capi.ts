/**
 * Meta Conversions API — o `Purchase` sai DAQUI, do servidor, na confirmação
 * do pagamento.
 *
 * Por que no servidor e não no navegador: a página de obrigado pode nem ser
 * aberta (Pix pago pelo app do banco, aba fechada), e o pixel não roda em
 * pay.vertix.studio. O funil do Scan já manda Lead e InitiateCheckout pelo
 * navegador; sem o Purchase o ciclo nunca fechava e nenhuma campanha sabia o
 * que vendeu.
 *
 * Deduplicação: `event_id` é o id do pedido. Se um dia o navegador também
 * mandar Purchase com o mesmo id, a Meta conta um só — é o mecanismo que ela
 * documenta para browser + servidor.
 *
 * Privacidade: e-mail e telefone vão em SHA-256 (o formato que a API exige),
 * nunca em claro. Nada de nome, CPF ou endereço.
 *
 * Desligado sem META_PIXEL_ID e META_CAPI_TOKEN. NUNCA lança e NUNCA atrasa a
 * entrega: uma falha aqui é um evento perdido, não uma venda perdida.
 */

const GRAPH_VERSAO = 'v21.0'
const TIMEOUT_MS = 5_000
const MOEDA = 'BRL'

export interface PurchaseMeta {
  /** Id do pedido — vira o event_id de deduplicação. */
  eventId: string
  valorCentavos: number
  email: string
  /** E.164 ou qualquer formato: só os dígitos são usados. */
  telefone: string | null
  /** Página onde a compra aconteceu, quando conhecida. */
  sourceUrl?: string | null
  /** O que foi comprado, para o relatório de anúncios. */
  contentName: string
}

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Normalizações que a Meta exige antes do hash: minúsculo/aparado; só dígitos. */
export async function hashesDeContato(
  email: string,
  telefone: string | null
): Promise<{ em: string[]; ph: string[] }> {
  const em = email.trim().toLowerCase()
  const ph = (telefone ?? '').replace(/\D/g, '')
  return {
    em: em ? [await sha256Hex(em)] : [],
    ph: ph ? [await sha256Hex(ph)] : [],
  }
}

/** Corpo do evento, separado para ser testável sem rede. */
export async function montarEventoPurchase(
  dados: PurchaseMeta,
  agoraSegundos: number = Math.floor(Date.now() / 1000)
): Promise<Record<string, unknown>> {
  const userData = await hashesDeContato(dados.email, dados.telefone)
  return {
    event_name: 'Purchase',
    event_time: agoraSegundos,
    event_id: dados.eventId,
    action_source: 'website',
    ...(dados.sourceUrl ? { event_source_url: dados.sourceUrl } : {}),
    user_data: userData,
    custom_data: {
      currency: MOEDA,
      value: dados.valorCentavos / 100,
      content_name: dados.contentName,
      content_type: 'product',
    },
  }
}

/**
 * Manda o Purchase. Devolve true quando a Meta aceitou; false em qualquer
 * outro caso (desligado, rede, resposta de erro) — sempre logando o motivo,
 * nunca o token.
 */
export async function enviarPurchaseMeta(
  dados: PurchaseMeta,
  rotulo: string
): Promise<boolean> {
  const pixelId = Deno.env.get('META_PIXEL_ID')?.trim()
  const token = Deno.env.get('META_CAPI_TOKEN')?.trim()
  if (!pixelId || !token) return false

  try {
    const evento = await montarEventoPurchase(dados)
    const corpo: Record<string, unknown> = { data: [evento] }
    const testEventCode = Deno.env.get('META_CAPI_TEST_EVENT_CODE')?.trim()
    if (testEventCode) corpo.test_event_code = testEventCode

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSAO}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    )
    if (!res.ok) {
      // Só o status: o corpo do erro pode ecoar parâmetros da chamada.
      console.error(`[${rotulo}] Meta CAPI recusou o Purchase ${dados.eventId}: ${res.status}`)
      return false
    }
    return true
  } catch (erro) {
    console.error(`[${rotulo}] Meta CAPI indisponível para ${dados.eventId}:`, erro)
    return false
  }
}
