/**
 * cupom-validar
 *
 * Confere um cupom para a página MOSTRAR o desconto antes de pagar.
 *
 * Esta função não decide nada sobre dinheiro. Quem resolve o valor cobrado é a
 * checkout-pagar, que revalida o mesmo cupom contra o banco no instante da
 * cobrança — porque entre o cliente digitar "BF50" e clicar em pagar cabe o
 * cupom expirar, ser desativado ou esgotar o limite. Aqui é só a prévia.
 *
 * O desconto sai da MESMA função de cálculo usada pela cobrança
 * (_shared/checkout.ts). Duas contas separadas divergiriam num arredondamento
 * e o cliente veria um preço na tela e outro na fatura.
 *
 * Sobre as mensagens: cupom inexistente e cupom desativado devolvem o mesmo
 * texto ("Cupom inválido."). Separar os dois transformaria este endpoint num
 * oráculo de quais códigos existem, e o primeiro script a passar por aqui
 * enumeraria a tabela de cupons inteira.
 *
 * Nunca loga o código tentado nem qualquer dado de cliente — não há dado de
 * cliente neste caminho, e é bom que continue assim.
 */

import { withCors } from '../_shared/cors.ts'
import {
  avaliarCupom,
  carregarOferta,
  criarDb,
  jsonResponse,
  SLUG_RE,
  type Db,
} from '../_shared/checkout.ts'

interface RequestBody {
  slug?: string
  codigo?: string
  /**
   * Se a caixinha do order bump está marcada. Entra na conta porque o desconto
   * percentual incide sobre o subtotal, e mostrar o desconto sem o bump para
   * quem marcou o bump erraria o número na tela.
   */
  bump?: boolean
}

/** Resposta única de "não vale", para não vazar por qual motivo exatamente. */
function invalido(mensagem: string, status = 200): Response {
  return jsonResponse(
    { valido: false, desconto_centavos: 0, mensagem },
    status
  )
}

Deno.serve(
  withCors(async (req) => {
    if (req.method !== 'POST') {
      return jsonResponse({ erro: 'method_not_allowed' }, 405)
    }

    let body: RequestBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ erro: 'payload_invalido' }, 400)
    }

    const slug = (body.slug ?? '').trim().toLowerCase()
    if (!SLUG_RE.test(slug)) {
      return jsonResponse({ erro: 'slug_invalido' }, 400)
    }

    const codigo = (body.codigo ?? '').trim()
    if (!codigo) {
      return invalido('Digite um cupom.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[cupom-validar] Env do Supabase ausente.')
      return jsonResponse({ erro: 'config_ausente' }, 500)
    }

    const db: Db = criarDb(supabaseUrl, serviceRoleKey)

    let oferta
    try {
      oferta = await carregarOferta(db, slug)
    } catch {
      return jsonResponse({ erro: 'falha_ao_ler_checkout' }, 502)
    }
    if (!oferta) {
      return jsonResponse({ erro: 'checkout_nao_encontrado' }, 404)
    }

    // Subtotal pela MESMA regra da checkout-pagar: principal + bump marcado.
    const comBump = body.bump === true && oferta.bump !== null
    const subtotal =
      oferta.produto.preco_centavos +
      (comBump ? (oferta.bump?.preco_centavos ?? 0) : 0)

    let avaliado
    try {
      avaliado = await avaliarCupom(db, codigo, oferta.produto.id, subtotal)
    } catch {
      return jsonResponse({ erro: 'falha_ao_validar_cupom' }, 502)
    }

    return jsonResponse({
      valido: avaliado.valido,
      desconto_centavos: avaliado.desconto_centavos,
      mensagem: avaliado.mensagem,
      // Conveniência para a tela não recalcular: é o mesmo número que a
      // checkout-pagar vai cobrar se nada mudar até o clique.
      total_centavos: subtotal - avaliado.desconto_centavos,
      subtotal_centavos: subtotal,
    })
  })
)
