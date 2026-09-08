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
 * Por isso o método de pagamento também entra aqui: desde 20260908200000 o
 * Pix tem desconto próprio, e ele incide DEPOIS do cupom (a ordem inteira está
 * em calcularTotais()). Uma prévia que ignorasse o método mostraria o preço de
 * cartão para quem já escolheu Pix — o mesmo erro que este endpoint existe
 * para evitar, só que na outra direção.
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
  calcularTotais,
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
  /**
   * Método de pagamento escolhido na tela ('pix', 'credit_card'...). Só o
   * MÉTODO — nunca um valor, nunca um percentual. Quanto o método desconta é
   * lido de `checkouts.desconto_pix_percentual` aqui dentro, exatamente como a
   * checkout-pagar faz na hora de cobrar.
   *
   * Ausente ou desconhecido = sem desconto de método, que é o comportamento
   * anterior a esta mudança: a prévia só encolhe quando o método realmente
   * desconta.
   */
  metodo?: string
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

    // Campo de cupom vazio NÃO é mais uma saída antecipada. Desde que o método
    // entrou na conta, o total depende do Pix mesmo sem cupom nenhum, e a tela
    // precisa poder perguntar "quanto fica no Pix?" sem inventar um código.
    // Continua respondendo `valido: false` — não há cupom aplicado —, só que
    // agora com os totais certos.
    let cupomValido = false
    let descontoCupom = 0
    let mensagem = 'Digite um cupom.'

    if (codigo) {
      let avaliado
      try {
        avaliado = await avaliarCupom(db, codigo, oferta.produto.id, subtotal)
      } catch {
        return jsonResponse({ erro: 'falha_ao_validar_cupom' }, 502)
      }
      cupomValido = avaliado.valido
      descontoCupom = avaliado.desconto_centavos
      mensagem = avaliado.mensagem
    }

    // A conta inteira, na ordem oficial: subtotal → cupom → método.
    // É literalmente a mesma chamada que a checkout-pagar faz para cobrar.
    const totais = calcularTotais(
      oferta.checkout,
      subtotal,
      descontoCupom,
      body.metodo
    )

    return jsonResponse({
      valido: cupomValido,
      mensagem,
      // SOMA dos descontos (cupom + método), para valer a identidade que a
      // tela e o recibo assumem: total = subtotal − desconto. Com cupom
      // inválido e Pix ligado, `valido` é false e este número ainda é o
      // desconto real do Pix — a tela mostra o preço certo enquanto explica
      // por que o cupom não colou.
      desconto_centavos: totais.desconto_centavos,
      subtotal_centavos: totais.subtotal_centavos,
      // O mesmo número que a checkout-pagar vai cobrar se nada mudar até o
      // clique — mesmo método, mesmo bump, mesmo cupom.
      total_centavos: totais.total_centavos,
      // Quebra dos dois, para a tela poder escrever duas linhas ("Cupom BF10"
      // e "Desconto Pix") em vez de um total anônimo. Acréscimo ao contrato:
      // campo novo, nenhum campo antigo mudou de nome.
      desconto_cupom_centavos: totais.desconto_cupom_centavos,
      desconto_metodo_centavos: totais.desconto_metodo_centavos,
    })
  })
)
