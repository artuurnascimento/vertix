/**
 * checkout-info
 *
 * Estado de UM pedido, para a tela de obrigado e para a espera do Pix.
 *
 * POR QUE ESTA FUNÇÃO EXISTE
 *   O cartão responde na hora: a checkout-pagar já devolve 'pago' ou
 *   'recusado'. O Pix, não — ele nasce 'aguardando' e só vira dinheiro quando
 *   o cliente abre o banco, o que acontece minutos depois, com a página aberta.
 *
 *   A confirmação automática do resto do sistema passa pela edge
 *   `payment-webhook`, que resolve o pagamento por `external_reference` dentro
 *   de `receivables` — a tabela de parcelas de contrato. Um pedido do checkout
 *   NÃO é um receivable, então o webhook de hoje não sabe fechá-lo. Enquanto
 *   ele não aprender sobre `pedidos`, esta função é a ponte: a página consulta
 *   o próprio pedido, e o servidor — nunca o navegador — pergunta ao Mercado
 *   Pago como está aquele pagamento e grava o resultado.
 *
 * O que o corpo manda é só o `pedido_id`, que é um uuid v4 não adivinhável —
 * mesma mecânica do payment_token da página de pagamento. Ainda assim a
 * resposta é uma PROJEÇÃO: nome, e-mail, documento e whatsapp do comprador não
 * saem daqui. Quem abriu a página já sabe quem é; quem tropeçar no id não
 * ganha um dossiê.
 *
 * A transição 'aguardando' → 'pago' é feita com UPDATE condicionado ao status
 * atual. Duas abas da mesma página consultando ao mesmo tempo não incrementam
 * o cupom duas vezes: só o UPDATE que encontrar a linha ainda 'aguardando'
 * afeta alguma coisa, e só ele registra o uso.
 *
 * Quando a confirmação acontece de verdade (Pix pago), esta função também
 * fecha o ciclo da venda: cria o recebível já pago no Financeiro e avisa o
 * worker do Scan para entregar (ver _shared/entrega.ts). Isso roda SÓ no ramo
 * em que o UPDATE condicionado encontrou a linha ainda 'aguardando' — é a
 * mesma trava que já protege o cupom, e é o que impede duas abas de gerarem
 * dois recebíveis para o mesmo Pix.
 *
 * Nunca loga MP_ACCESS_TOKEN, dado de cartão nem documento do cliente.
 */

import { withCors } from '../_shared/cors.ts'
import {
  criarDb,
  entregaPlanoScan,
  gerarPlanoCode,
  jsonResponse,
  UUID_RE,
  type Db,
  type PedidoItem,
} from '../_shared/checkout.ts'
import { concluirPedidoPago } from '../_shared/entrega.ts'

interface RequestBody {
  pedido_id?: string
}

interface PedidoRow {
  id: string
  status: string
  // Lidos para o pós-venda (cliente e recebível do Financeiro), NUNCA
  // devolvidos na resposta — ver respostaPedido() e o cabeçalho.
  cliente_nome: string
  cliente_email: string
  cliente_whatsapp: string | null
  receivable_id: string | null
  total_centavos: number
  subtotal_centavos: number
  desconto_centavos: number
  itens: PedidoItem[]
  cupom_id: string | null
  mp_payment_id: string | null
  mp_card_id: string | null
  plano_code: string | null
}

/** Mesmo mapeamento da checkout-pagar — um pagamento, uma leitura de status. */
function statusDoPedido(mpStatus: unknown): string {
  switch (mpStatus) {
    case 'approved':
      return 'pago'
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'aguardando'
    case 'refunded':
    case 'charged_back':
      return 'reembolsado'
    default:
      return 'recusado'
  }
}

/** Projeção devolvida à página: nada de dado pessoal do comprador. */
function respostaPedido(
  pedido: PedidoRow,
  status: string,
  planoCode: string | null = null
): Record<string, unknown> {
  return {
    pedido_id: pedido.id,
    status,
    plano_code: planoCode ?? pedido.plano_code,
    total_centavos: pedido.total_centavos,
    subtotal_centavos: pedido.subtotal_centavos,
    desconto_centavos: pedido.desconto_centavos,
    itens: (pedido.itens ?? []).map((item) => ({
      produto_id: item.produto_id,
      nome: item.nome,
      tipo: item.tipo,
      preco_centavos: item.preco_centavos,
      pago: item.pago,
    })),
    // O front precisa disto para o upsell de um clique: sem card_id não há
    // como gerar o token do cartão salvo. É um id opaco, inútil sem o CVV.
    tem_cartao_salvo: Boolean(pedido.mp_card_id),
    card_id: pedido.mp_card_id,
  }
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

    const pedidoId = body.pedido_id
    if (!pedidoId || !UUID_RE.test(pedidoId)) {
      return jsonResponse({ erro: 'pedido_id_invalido' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[checkout-info] Env do Supabase ausente.')
      return jsonResponse({ erro: 'config_ausente' }, 500)
    }

    const db: Db = criarDb(supabaseUrl, serviceRoleKey)

    let pedido: PedidoRow | undefined
    try {
      const linhas = await db.select<PedidoRow>(
        `pedidos?id=eq.${pedidoId}` +
          '&select=id,status,total_centavos,subtotal_centavos,desconto_centavos,' +
          'itens,cupom_id,mp_payment_id,mp_card_id,plano_code,' +
          // Só para o pós-venda. A projeção da resposta continua sem eles.
          'cliente_nome,cliente_email,cliente_whatsapp,receivable_id&limit=1'
      )
      pedido = linhas[0]
    } catch {
      return jsonResponse({ erro: 'falha_ao_ler_pedido' }, 502)
    }
    if (!pedido) {
      return jsonResponse({ erro: 'pedido_nao_encontrado' }, 404)
    }

    // Pedido já resolvido, ou sem pagamento no MP para consultar: devolve como
    // está. Não há por que bater no gateway a cada refresh da tela de obrigado.
    if (pedido.status !== 'aguardando' || !pedido.mp_payment_id || !mpAccessToken) {
      return jsonResponse(respostaPedido(pedido, pedido.status))
    }

    // ----------------------------------------------------------------------
    // Reconciliação com o Mercado Pago
    // ----------------------------------------------------------------------

    let mpBody: Record<string, unknown>
    try {
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(pedido.mp_payment_id)}`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
      )
      if (!mpRes.ok) {
        console.error(
          '[checkout-info] MP recusou a consulta:',
          mpRes.status,
          'pedido:',
          pedido.id
        )
        return jsonResponse(respostaPedido(pedido, pedido.status))
      }
      mpBody = (await mpRes.json()) as Record<string, unknown>
    } catch {
      // Gateway fora do ar não pode virar erro na tela de quem já pagou.
      return jsonResponse(respostaPedido(pedido, pedido.status))
    }

    const novoStatus = statusDoPedido(mpBody.status)
    if (novoStatus === 'aguardando') {
      return jsonResponse(respostaPedido(pedido, 'aguardando'))
    }

    const aprovado = novoStatus === 'pago'

    // UPDATE condicionado ao status atual: quem chegar segundo não encontra a
    // linha 'aguardando' e, portanto, não repete o efeito colateral do cupom.
    // Código do plano só na confirmação, e só se ainda não houver um: uma
    // segunda passagem por aqui não pode trocar o link que o cliente já
    // recebeu por e-mail.
    const planoCode =
      aprovado && !pedido.plano_code && entregaPlanoScan(pedido.itens ?? [])
        ? gerarPlanoCode()
        : null

    let mudou = false
    try {
      const atualizadas = await db.update<{ id: string }>(
        'pedidos',
        `id=eq.${pedido.id}&status=eq.aguardando`,
        {
          status: novoStatus,
          ...(planoCode && { plano_code: planoCode }),
          itens: (pedido.itens ?? []).map((item) => ({
            ...item,
            pago: aprovado,
            mp_payment_id: aprovado ? pedido!.mp_payment_id : null,
          })),
        }
      )
      mudou = atualizadas.length > 0
    } catch {
      console.error(
        '[checkout-info] Falha ao atualizar pedido:',
        pedido.id,
        'status pretendido:',
        novoStatus
      )
      return jsonResponse(respostaPedido(pedido, pedido.status))
    }

    if (mudou && aprovado && pedido.cupom_id) {
      try {
        const ok = await db.rpc<boolean>('cupom_registrar_uso', {
          p_cupom_id: pedido.cupom_id,
        })
        if (ok === false) {
          // O cupom esgotou entre a geração do Pix e o pagamento. O dinheiro
          // entrou: honramos o desconto e registramos, em vez de recusar uma
          // venda já paga por causa de uma corrida de contador.
          console.error(
            '[checkout-info] Cupom esgotou antes da confirmação. Pedido:',
            pedido.id
          )
        }
      } catch {
        console.error(
          '[checkout-info] Falha ao registrar uso do cupom. Pedido:',
          pedido.id
        )
      }
    }

    // Pós-venda: Financeiro e entrega. Dentro do `mudou` de propósito — quem
    // perdeu a corrida do UPDATE não repete o efeito colateral, exatamente
    // como no cupom acima. `receivable_id` vai junto porque um Pix reconciliado
    // duas vezes (aba antiga + varredura) não pode virar dois recebíveis.
    // Não lança e não altera a resposta: o dinheiro já entrou.
    if (mudou && aprovado) {
      await concluirPedidoPago(
        db,
        {
          id: pedido.id,
          cliente_nome: pedido.cliente_nome,
          cliente_email: pedido.cliente_email,
          cliente_whatsapp: pedido.cliente_whatsapp,
          total_centavos: pedido.total_centavos,
          itens: pedido.itens ?? [],
          receivable_id: pedido.receivable_id,
        },
        'checkout-info'
      )
    }

    // Se `mudou` for false, outra aba já gravou: o plano_code dela é o que
    // vale, e o nosso sorteio foi descartado sem nunca ter ido ao banco.
    return jsonResponse(
      respostaPedido(pedido, novoStatus, mudou ? planoCode : null)
    )
  })
)
