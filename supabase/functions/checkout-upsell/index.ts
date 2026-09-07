/**
 * checkout-upsell
 *
 * Cobra o upsell (ou o downsell) no cartão que o comprador já usou, sem
 * refazer o formulário inteiro, e acrescenta o item ao pedido.
 *
 * O QUE O NAVEGADOR NÃO DECIDE:
 *   • Não decide o preço. O valor sai de `produtos`, resolvido pelo produto_id.
 *   • Não decide O QUE pode comprar. `produto_id` tem de ser exatamente o
 *     upsell_produto_id ou o downsell_produto_id DAQUELE checkout. Sem essa
 *     conferência, qualquer pedido pago viraria uma loja aberta: bastaria
 *     mandar o id de um produto barato para levar o caro por engano — ou o
 *     contrário, cobrar do cliente algo que ele nunca viu.
 *   • Não decide se já pagou. O pedido precisa estar 'pago'.
 *
 * IDEMPOTÊNCIA (dois cliques no botão = uma cobrança):
 *   A reserva do item e o teste "esse produto já está no pedido?" são o MESMO
 *   comando SQL — public.checkout_item_reservar(). Só depois de reservar é que
 *   o cartão é tocado, e a chave de idempotência mandada ao Mercado Pago é
 *   derivada de pedido+produto, então nem uma reexecução da function gera
 *   segunda cobrança.
 *
 * SOBRE O CVV — leia antes de mudar o contrato:
 *   O Mercado Pago NÃO permite cobrar um cartão salvo sem um novo código de
 *   segurança. A documentação é explícita: "é necessário capturar novamente o
 *   código de segurança (CVV) do cartão, pois o Mercado Pago não armazena esse
 *   dado por questões de segurança".
 *   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/how-tos/payment-approval/saved-cards
 *
 *   Consequência prática: esta função recebe `card_token`, NÃO o CVV cru. O
 *   navegador gera o token com o SDK do MP a partir do cartão salvo —
 *     mp.fields.createCardToken({ cardId })
 *   — e o CVV digitado vai do navegador direto para o Mercado Pago, sem passar
 *   por este servidor nem por este banco. Aceitar o CVV em texto aqui traria
 *   dado de cartão para dentro do nosso perímetro (escopo de PCI-DSS) sem
 *   ganho nenhum: a API de pagamentos não aceita CVV solto, só token.
 *
 *   Um corpo que mande `cvv` é recusado com mensagem explicando isso, em vez
 *   de ser silenciosamente ignorado — falhar calado aqui viraria "o upsell não
 *   funciona" sem ninguém saber por quê.
 *
 * NO FINANCEIRO, UM RECEBÍVEL POR COBRANÇA:
 *   O upsell aprovado é um pagamento SEPARADO no Mercado Pago, com id e data
 *   próprios. Ele vira um recebível NOVO — no mesmo cliente e no mesmo projeto
 *   da venda original —, e não um aumento do valor do recebível de antes.
 *   Somar produziria uma linha de R$ 1.394 que não corresponde a transação
 *   nenhuma, com duas cobranças de R$ 197 e R$ 1.197 no extrato do MP e nada
 *   para casar com elas. Duas cobranças, duas linhas.
 *
 *   O vínculo item ↔ recebível fica dentro do próprio item de `itens`, gravado
 *   por public.checkout_item_recebivel(). É ele que impede um segundo
 *   recebível para o mesmo item. Falhar aí NÃO desfaz a venda: o cartão já foi
 *   debitado, e a linha do Financeiro é recuperável — a cobrança não.
 *
 * Pix: quem pagou por Pix não tem cartão salvo. Esta função responde
 * `sem_cartao_salvo`, e o upsell tem de ser um pagamento novo pela
 * checkout-pagar.
 *
 * NUNCA loga token de cartão, CVV, MP_ACCESS_TOKEN nem documento do cliente.
 */

import { withCors } from '../_shared/cors.ts'
import {
  criarDb,
  jsonResponse,
  UUID_RE,
  VALOR_MAXIMO_CENTAVOS,
  VALOR_MINIMO_CENTAVOS,
  type Db,
  type PedidoItem,
  type ProdutoRow,
} from '../_shared/checkout.ts'
import { criarRecebivelComplementar } from '../_shared/entrega.ts'

interface RequestBody {
  pedido_id?: string
  produto_id?: string
  /** Token gerado no navegador a partir do cartão salvo + CVV. */
  card_token?: string
  /** Recusado de propósito — ver cabeçalho. */
  cvv?: unknown
  installments?: number
}

interface PedidoRow {
  id: string
  checkout_id: string
  cliente_email: string
  cliente_nome: string
  cliente_documento: string | null
  itens: PedidoItem[]
  total_centavos: number
  status: string
  mp_customer_id: string | null
  mp_card_id: string | null
  // Lidos para o recebível complementar (ver cabeçalho), nunca devolvidos.
  cliente_whatsapp: string | null
  receivable_id: string | null
}

interface CheckoutRow {
  id: string
  titulo: string
  upsell_produto_id: string | null
  downsell_produto_id: string | null
}

function centavosParaReais(centavos: number): number {
  const inteiros = Math.trunc(centavos / 100)
  const resto = centavos % 100
  return Number(`${inteiros}.${String(resto).padStart(2, '0')}`)
}

Deno.serve(
  withCors(async (req) => {
    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, erro: 'method_not_allowed' }, 405)
    }

    let body: RequestBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ ok: false, erro: 'payload_invalido' }, 400)
    }

    const pedidoId = body.pedido_id
    if (!pedidoId || !UUID_RE.test(pedidoId)) {
      return jsonResponse({ ok: false, erro: 'pedido_id_invalido' }, 400)
    }

    const produtoId = body.produto_id
    if (!produtoId || !UUID_RE.test(produtoId)) {
      return jsonResponse({ ok: false, erro: 'produto_id_invalido' }, 400)
    }

    // Recusa explícita, não silenciosa. Ver cabeçalho.
    if (body.cvv !== undefined) {
      return jsonResponse(
        {
          ok: false,
          erro: 'cvv_nao_aceito',
          mensagem:
            'Envie card_token gerado no navegador com mp.fields.createCardToken({ cardId }). O CVV não deve passar pelo servidor.',
        },
        400
      )
    }

    const cardToken = (body.card_token ?? '').trim()
    if (!cardToken) {
      return jsonResponse({ ok: false, erro: 'card_token_obrigatorio' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) {
      console.error('[checkout-upsell] Env ausente.')
      return jsonResponse({ ok: false, erro: 'config_ausente' }, 500)
    }

    const db: Db = criarDb(supabaseUrl, serviceRoleKey)

    // ----------------------------------------------------------------------
    // 1. O pedido existe, é dele, e está pago?
    // ----------------------------------------------------------------------

    let pedido: PedidoRow | undefined
    try {
      const linhas = await db.select<PedidoRow>(
        `pedidos?id=eq.${pedidoId}` +
          '&select=id,checkout_id,cliente_email,cliente_nome,cliente_documento,' +
          'itens,total_centavos,status,mp_customer_id,mp_card_id,' +
          // Só para o recebível complementar. A resposta continua sem eles.
          'cliente_whatsapp,receivable_id&limit=1'
      )
      pedido = linhas[0]
    } catch {
      return jsonResponse({ ok: false, erro: 'falha_ao_ler_pedido' }, 502)
    }

    if (!pedido) {
      return jsonResponse({ ok: false, erro: 'pedido_nao_encontrado' }, 404)
    }
    if (pedido.status !== 'pago') {
      return jsonResponse({ ok: false, erro: 'pedido_nao_pago' }, 409)
    }
    if (!pedido.mp_customer_id || !pedido.mp_card_id) {
      // Pix, ou cartão que não foi salvo. O upsell existe, mas por aqui não dá.
      return jsonResponse({ ok: false, erro: 'sem_cartao_salvo' }, 409)
    }

    // ----------------------------------------------------------------------
    // 2. Esse produto é MESMO o upsell/downsell deste checkout?
    // ----------------------------------------------------------------------

    let checkout: CheckoutRow | undefined
    try {
      const linhas = await db.select<CheckoutRow>(
        `checkouts?id=eq.${pedido.checkout_id}` +
          '&select=id,titulo,upsell_produto_id,downsell_produto_id&limit=1'
      )
      checkout = linhas[0]
    } catch {
      return jsonResponse({ ok: false, erro: 'falha_ao_ler_checkout' }, 502)
    }
    if (!checkout) {
      return jsonResponse({ ok: false, erro: 'checkout_nao_encontrado' }, 404)
    }

    const ehUpsell = checkout.upsell_produto_id === produtoId
    const ehDownsell = checkout.downsell_produto_id === produtoId
    if (!ehUpsell && !ehDownsell) {
      // Mesma resposta para "não é oferta deste checkout" e "produto não
      // existe": diferenciar contaria ao visitante o que há no catálogo.
      return jsonResponse({ ok: false, erro: 'produto_nao_ofertado' }, 403)
    }

    let produto: ProdutoRow | undefined
    try {
      const linhas = await db.select<ProdutoRow>(
        `produtos?id=eq.${produtoId}&ativo=is.true` +
          '&select=id,nome,slug,descricao,preco_centavos,preco_ancora_centavos,tipo,entrega,ativo&limit=1'
      )
      produto = linhas[0]
    } catch {
      return jsonResponse({ ok: false, erro: 'falha_ao_ler_produto' }, 502)
    }
    if (!produto) {
      return jsonResponse({ ok: false, erro: 'produto_nao_ofertado' }, 403)
    }

    const preco = produto.preco_centavos
    if (preco < VALOR_MINIMO_CENTAVOS || preco > VALOR_MAXIMO_CENTAVOS) {
      console.error('[checkout-upsell] Preço fora da faixa:', preco, produtoId)
      return jsonResponse({ ok: false, erro: 'valor_invalido' }, 422)
    }

    // ----------------------------------------------------------------------
    // 3. Reserva — a guarda de idempotência, antes de tocar no cartão
    // ----------------------------------------------------------------------

    const item: PedidoItem = {
      produto_id: produto.id,
      nome: produto.nome,
      tipo: ehUpsell ? 'upsell' : 'downsell',
      preco_centavos: preco,
      pago: false,
      entrega: produto.entrega,
      mp_payment_id: null,
    }

    let reservou: boolean | null
    try {
      reservou = await db.rpc<boolean>('checkout_item_reservar', {
        p_pedido_id: pedidoId,
        p_item: item,
      })
    } catch {
      return jsonResponse({ ok: false, erro: 'falha_ao_reservar_item' }, 502)
    }

    if (reservou !== true) {
      // O produto já está no pedido. Duas situações muito diferentes:
      const jaExistente = pedido.itens.find((i) => i.produto_id === produtoId)
      if (jaExistente?.pago) {
        // Já foi comprado. Segundo clique: devolve sucesso com o total atual,
        // sem cobrar de novo. É isso que "idempotente" significa aqui.
        return jsonResponse({
          ok: true,
          total_centavos: pedido.total_centavos,
          ja_processado: true,
        })
      }
      // Reserva pendurada de uma tentativa que morreu no meio. Não cobramos
      // por cima: pode haver uma cobrança em voo no MP neste exato instante.
      return jsonResponse({ ok: false, erro: 'cobranca_em_andamento' }, 409)
    }

    // ----------------------------------------------------------------------
    // 4. Cobrança no cartão salvo
    // ----------------------------------------------------------------------
    // payer.type = 'customer' + payer.id é a forma documentada de pagar com
    // cartão salvo; o token acima já nasceu amarrado a esse cartão.
    // https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/how-tos/payment-approval/saved-cards

    const documento = pedido.cliente_documento
    const pagamento: Record<string, unknown> = {
      transaction_amount: centavosParaReais(preco),
      description: produto.nome,
      external_reference: pedido.id,
      token: cardToken,
      installments:
        Number.isInteger(body.installments) && (body.installments as number) > 0
          ? body.installments
          : 1,
      statement_descriptor: 'VERTIX',
      payer: {
        type: 'customer',
        id: pedido.mp_customer_id,
        email: pedido.cliente_email,
        ...(documento && {
          identification: {
            type: documento.length > 11 ? 'CNPJ' : 'CPF',
            number: documento,
          },
        }),
      },
    }

    let mpRes: Response
    let mpBody: Record<string, unknown> = {}
    try {
      mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          // Derivada de pedido+produto: reexecutar esta function devolve o
          // mesmo pagamento do MP em vez de cobrar duas vezes.
          'X-Idempotency-Key': `${pedidoId}:${produtoId}`,
        },
        body: JSON.stringify(pagamento),
      })
      mpBody = (await mpRes.json().catch(() => ({}))) as Record<string, unknown>
    } catch (erro) {
      // Rede caiu sem resposta. NÃO desfazemos a reserva: pode ter cobrado.
      // A reserva pendurada é justamente o que impede uma segunda cobrança —
      // ver o ramo 'cobranca_em_andamento' acima.
      console.error(
        '[checkout-upsell] Rede falhou ao chamar o MP. Pedido:',
        pedidoId,
        erro instanceof Error ? erro.message : ''
      )
      return jsonResponse({ ok: false, erro: 'gateway_indisponivel' }, 502)
    }

    const aprovado = mpRes.ok && mpBody.status === 'approved'
    const mpPaymentId = mpBody.id != null ? String(mpBody.id) : null

    if (!aprovado) {
      console.error(
        '[checkout-upsell] Upsell não aprovado. Pedido:',
        pedidoId,
        'http:',
        mpRes.status,
        'status:',
        String(mpBody.status ?? ''),
        'detalhe:',
        String(mpBody.status_detail ?? '')
      )
      // Recusa definitiva: desfaz a reserva para o cliente poder tentar de
      // novo (outro cartão, outro CVV) sem esbarrar na própria reserva.
      try {
        await db.rpc('checkout_item_baixar', {
          p_pedido_id: pedidoId,
          p_produto_id: produtoId,
          p_aprovado: false,
        })
      } catch {
        console.error(
          '[checkout-upsell] Falha ao desfazer reserva. Pedido:',
          pedidoId
        )
      }
      return jsonResponse(
        {
          ok: false,
          erro: 'pagamento_recusado',
          mensagem: (mpBody.status_detail as string) ?? null,
        },
        402
      )
    }

    // ----------------------------------------------------------------------
    // 5. Baixa: marca pago e soma ao total — dentro do banco, num comando
    // ----------------------------------------------------------------------

    try {
      await db.rpc('checkout_item_baixar', {
        p_pedido_id: pedidoId,
        p_produto_id: produtoId,
        p_aprovado: true,
        p_mp_payment_id: mpPaymentId,
      })
    } catch {
      console.error(
        '[checkout-upsell] Cobrado mas não baixado. Pedido:',
        pedidoId,
        'mp_payment_id:',
        mpPaymentId
      )
      // Dinheiro entrou. Responder erro faria o front cobrar de novo.
      return jsonResponse({
        ok: true,
        total_centavos: pedido.total_centavos + preco,
        conciliacao_pendente: true,
      })
    }

    // ----------------------------------------------------------------------
    // 6. Financeiro — a segunda cobrança vira a segunda linha
    // ----------------------------------------------------------------------
    // Depois da baixa, e só na aprovação. Não desfaz nada e não altera a
    // resposta: criarRecebivelComplementar() não lança e engole as próprias
    // falhas (ver _shared/entrega.ts). O worker NÃO é avisado de novo — ele já
    // foi chamado uma vez pelo pedido, e a entrega do upsell é problema dele.
    await criarRecebivelComplementar(
      db,
      {
        pedido: {
          id: pedido.id,
          cliente_nome: pedido.cliente_nome,
          cliente_email: pedido.cliente_email,
          cliente_whatsapp: pedido.cliente_whatsapp,
          total_centavos: pedido.total_centavos,
          itens: pedido.itens ?? [],
          receivable_id: pedido.receivable_id,
        },
        produto_id: produtoId,
        // O id curto amarra as duas linhas para quem olha o Financeiro sem
        // abrir o pedido. 8 caracteres do uuid bastam para achar a venda e não
        // enchem a coluna de descrição.
        descricao: `${produto.nome} — complemento do pedido ${pedido.id.slice(0, 8)}`,
        valor_centavos: preco,
      },
      'checkout-upsell'
    )

    let totalFinal = pedido.total_centavos + preco
    try {
      const linhas = await db.select<{ total_centavos: number }>(
        `pedidos?id=eq.${pedidoId}&select=total_centavos&limit=1`
      )
      if (linhas[0]) totalFinal = linhas[0].total_centavos
    } catch {
      // Total calculado localmente já serve para a tela de obrigado.
    }

    return jsonResponse({ ok: true, total_centavos: totalFinal })
  })
)
