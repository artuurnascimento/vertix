/**
 * checkout-reembolsar
 *
 * Reembolso TOTAL de um pedido do checkout próprio, pedido pelo painel.
 *
 * Recebe `{ pedido_id }`, devolve o dinheiro pelo Mercado Pago, marca o pedido
 * como 'reembolsado' (o que REVOGA o acesso ao Plano de Correção) e tira a
 * venda da receita no Financeiro.
 *
 * AUTENTICADA. Não há entrada em `config.toml` para esta function, e isso é
 * deliberado: sem entrada, `verify_jwt` fica no padrão `true` e a plataforma
 * recusa a chamada antes do nosso código rodar. As checkout-* públicas
 * (pagar, info, upsell, cupom-validar) aparecem no config JUSTAMENTE porque
 * precisam desligar isso; esta é a única do grupo que não é pública, e
 * acrescentá-la ao arquivo com verify_jwt = false abriria o reembolso para a
 * internet inteira. O JWT ainda é revalidado aqui, e o chamador precisa ter
 * perfil em `profiles` — mesmo critério da create-payment-link, que é a outra
 * function do painel que mexe em dinheiro.
 *
 * SÓ REEMBOLSO TOTAL. Não existe campo de valor no corpo, e acrescentar um
 * seria um bug: o valor devolvido é o que o Mercado Pago confirmar, e o
 * pedido é binário entre 'pago' e 'reembolsado'.
 *
 * A ORDEM É A REGRA MAIS IMPORTANTE DESTE ARQUIVO
 *   1. RESERVA no banco (pedido_reembolso_iniciar) — antes de tocar no
 *      gateway.
 *   2. Chama o Mercado Pago.
 *   3. Só depois de o MP confirmar, grava o desfecho
 *      (pedido_reembolso_concluir).
 *
 *   Gravar antes de o MP confirmar diria ao cliente que o dinheiro voltou sem
 *   ele ter voltado. Reservar depois deixaria dois cliques chamarem o gateway
 *   duas vezes.
 *
 * IDEMPOTÊNCIA — DUAS TRAVAS, PORQUE UMA SÓ MORA DO OUTRO LADO DA REDE
 *   • No BANCO: a reserva da etapa 1 é um lock de linha. O segundo clique não
 *     reserva e recebe 409, sem nunca chegar ao Mercado Pago.
 *   • No MERCADO PAGO: `X-Idempotency-Key` derivada do pedido (sempre a mesma
 *     string para o mesmo pedido). Se a chamada escapar da primeira trava —
 *     retry de rede, reserva vencida sendo retomada —, o MP devolve o
 *     reembolso que já existe em vez de devolver o dinheiro outra vez.
 *
 * O CASO PERIGOSO: MP REEMBOLSOU E A GRAVAÇÃO FALHOU
 *   Aí o dinheiro voltou e o sistema acha que não. O tratamento é explícito:
 *     • a RESERVA fica no banco (`pedidos.reembolso_iniciado_em` preenchido
 *       com `reembolsado_em` ainda nulo). Esse par é o marcador de
 *       reconciliação, e o índice parcial `pedidos_reembolso_em_aberto_idx`
 *       existe só para achá-lo;
 *     • o log sai com o id do pedido, o id do pagamento e o id do reembolso no
 *       MP — os três que permitem casar a linha com o extrato à mão;
 *     • a resposta é 502 com `erro: 'reembolsado_sem_registro'`, para a tela
 *       NÃO dizer "não deu, tente de novo" sobre dinheiro que já saiu;
 *     • passada a janela da reserva, a próxima tentativa RETOMA e chama o MP
 *       com a MESMA chave. O MP não reembolsa de novo, e o desfecho é gravado.
 *       Convergir é o objetivo — não reembolsar exatamente uma vez por acaso.
 *
 * RECONCILIAÇÃO NO ERRO DO GATEWAY
 *   Um 4xx do MP não significa "não reembolsou". O caso mais comum é
 *   justamente o oposto: o pagamento JÁ estava reembolsado (por este sistema,
 *   pelo painel do MP ou por contestação do titular). Por isso todo erro passa
 *   por uma consulta de GET /v1/payments/{id}: se o pagamento está `refunded`,
 *   isso é SUCESSO e o estado é reconciliado, não um erro na tela.
 *
 * NUNCA loga MP_ACCESS_TOKEN, JWT do chamador, dado de cartão nem documento
 * do cliente.
 *
 * Referências (documentação oficial do Mercado Pago):
 *   POST /v1/payments/{payment_id}/refunds — corpo vazio = reembolso total;
 *   resposta 201 { id, payment_id, amount, status }. O header
 *   `X-Render-In-Process-Refunds: true` faz o reembolso em contingência voltar
 *   como 201 com status 'in_process' em vez de 400.
 *   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/payment-management/cancellations-and-refunds/refund-pix
 *   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-model
 *   `X-Idempotency-Key` em operações de reembolso:
 *   https://www.mercadopago.com.br/developers/pt/docs/qr-code/migrate-dynamic-qr-model-to-orders
 */

import { withCors } from '../_shared/cors.ts'
import { criarDb, jsonResponse, UUID_RE, type Db } from '../_shared/checkout.ts'

interface RequestBody {
  pedido_id?: string
}

/** Resposta das duas RPCs de reembolso (ver migration 20260908220000). */
interface ReembolsoRpc {
  resultado: string
  pedido_id?: string
  mp_payment_id?: string | null
  total_centavos?: number
  receivable_id?: string | null
  plano_code?: string | null
  reembolso_mp_id?: string | null
  reembolsado_em?: string | null
  receivable_cancelado?: boolean
  reembolso_iniciado_em?: string | null
  retomada?: boolean
  status?: string
}

/** Reembolso criado (ou já existente) no Mercado Pago. */
interface RefundMp {
  id: string | null
  /** Centavos confirmados pelo MP, quando ele informa o valor. */
  valor_centavos: number | null
  /** 'approved' | 'in_process' — ver o cabeçalho sobre contingência. */
  status: string | null
}

/**
 * Teto de espera pelo Mercado Pago. Generoso de propósito, ao contrário do
 * timeout do worker em _shared/entrega.ts: aqui não há alternativa recuperável
 * do outro lado, e desistir cedo produz exatamente o estado perigoso — um
 * reembolso que talvez tenha acontecido, sem resposta para gravar.
 */
const MP_TIMEOUT_MS = 20_000

/**
 * Chave de idempotência do reembolso deste pedido. DETERMINÍSTICA: sempre a
 * mesma string para o mesmo pedido, que é o que faz o Mercado Pago devolver o
 * reembolso existente em vez de criar um segundo numa rechamada.
 *
 * O prefixo separa esta chave da usada na COBRANÇA, que é o `pedido.id` puro
 * (checkout-pagar). Reaproveitar a mesma string para duas operações diferentes
 * é o erro que a documentação do MP avisa: mesma chave com corpo diferente é
 * recusada.
 */
function chaveIdempotencia(pedidoId: string): string {
  return `reembolso-${pedidoId}`
}

/**
 * Reais (como o MP devolve em `amount`) → centavos.
 * `Math.round` e não `Math.trunc`: 238.14 * 100 dá 23813.999... em ponto
 * flutuante, e truncar produziria um centavo a menos no registro do que
 * voltou para o cliente.
 */
function reaisParaCentavos(valor: unknown): number | null {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100)
}

/**
 * O pagamento está reembolsado no Mercado Pago, independentemente do que a
 * nossa chamada respondeu?
 *
 * É a pergunta que transforma um erro do gateway em sucesso reconciliado. Só
 * `refunded` conta: 'charged_back' é contestação do titular — dinheiro que
 * saiu por outro caminho, com outra disputa em andamento —, e tratá-lo como
 * reembolso pedido por nós esconderia um chargeback dentro de um fluxo de
 * atendimento.
 *
 * Devolve null quando não deu para saber. Null NÃO é "não reembolsou": quem
 * chama trata a dúvida como dúvida.
 * Docs: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get
 */
async function pagamentoJaReembolsado(
  mpToken: string,
  paymentId: string
): Promise<{ reembolsado: boolean; refund: RefundMp } | null> {
  let res: Response
  try {
    res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
      signal: AbortSignal.timeout(MP_TIMEOUT_MS),
    })
  } catch (erro) {
    console.error('[checkout-reembolsar] Consulta do pagamento falhou:', erro)
    return null
  }
  if (!res.ok) {
    console.error(
      '[checkout-reembolsar] Consulta do pagamento recusada:',
      res.status
    )
    return null
  }

  const corpo = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!corpo) return null

  if (corpo.status !== 'refunded') {
    return {
      reembolsado: false,
      refund: { id: null, valor_centavos: null, status: null },
    }
  }

  // O pagamento reembolsado traz a lista de reembolsos. Pegamos o primeiro
  // porque só existe reembolso total aqui; a ausência da lista não invalida o
  // fato de o pagamento estar `refunded`.
  const lista = Array.isArray(corpo.refunds)
    ? (corpo.refunds as Array<Record<string, unknown>>)
    : []
  const primeiro = lista[0]

  return {
    reembolsado: true,
    refund: {
      id: primeiro?.id != null ? String(primeiro.id) : null,
      valor_centavos:
        reaisParaCentavos(primeiro?.amount) ??
        reaisParaCentavos(corpo.transaction_amount_refunded),
      status: primeiro?.status != null ? String(primeiro.status) : 'approved',
    },
  }
}

/**
 * POST /v1/payments/{id}/refunds — reembolso TOTAL (corpo vazio).
 *
 * Devolve o reembolso quando o MP confirma, `null` quando ele recusa de forma
 * definitiva, e lança quando não foi possível saber (rede, timeout, 5xx) —
 * porque essas três situações exigem tratamentos diferentes de quem chama, e
 * colapsar "recusou" com "não sei" é o que produziria um reembolso duplicado.
 */
async function reembolsarNoMp(
  mpToken: string,
  paymentId: string,
  pedidoId: string
): Promise<RefundMp | null> {
  let res: Response
  try {
    res = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': chaveIdempotencia(pedidoId),
          // Reembolso em contingência volta como 201 'in_process' em vez de
          // 400. Sem este header, uma contingência (que É um reembolso a
          // caminho) chegaria aqui como erro, e o dinheiro estaria voltando
          // com o sistema achando que a operação falhou.
          'X-Render-In-Process-Refunds': 'true',
        },
        // Corpo vazio = reembolso total. Mandar `amount` faria dele parcial.
        body: '{}',
        signal: AbortSignal.timeout(MP_TIMEOUT_MS),
      }
    )
  } catch (erro) {
    // Rede ou timeout: NÃO se sabe se o reembolso aconteceu.
    console.error('[checkout-reembolsar] MP indisponível. Pedido:', pedidoId, erro)
    throw new Error('mp_indisponivel')
  }

  const corpo = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    // O corpo do erro do MP não carrega access token nem dado de cartão.
    console.error(
      '[checkout-reembolsar] MP recusou o reembolso:',
      res.status,
      'pedido:',
      pedidoId,
      JSON.stringify(corpo).slice(0, 500)
    )
    // 5xx é falha do lado deles, não recusa: pode ter reembolsado assim mesmo.
    if (res.status >= 500) throw new Error('mp_indisponivel')
    return null
  }

  return {
    id: corpo.id != null ? String(corpo.id) : null,
    valor_centavos: reaisParaCentavos(corpo.amount),
    status: corpo.status != null ? String(corpo.status) : null,
  }
}

/**
 * Grava o desfecho. Separada porque o tratamento da falha AQUI é o coração do
 * caso perigoso: o dinheiro já voltou, então não existe resposta boa — existe
 * a resposta que deixa alguém reconciliar.
 */
async function registrarDesfecho(
  db: Db,
  pedidoId: string,
  refund: RefundMp,
  mpPaymentId: string
): Promise<Response> {
  let conclusao: ReembolsoRpc | null
  try {
    conclusao = await db.rpc<ReembolsoRpc>('pedido_reembolso_concluir', {
      p_pedido_id: pedidoId,
      p_mp_refund_id: refund.id,
      p_valor_centavos: refund.valor_centavos,
    })
  } catch {
    // O DINHEIRO VOLTOU E O BANCO NÃO SABE. Log com os três ids que permitem
    // casar a linha com o extrato à mão. A reserva continua gravada, então o
    // índice de reconciliação encontra este pedido e a próxima tentativa
    // converge pela chave de idempotência (ver cabeçalho).
    console.error(
      '[checkout-reembolsar] REEMBOLSADO SEM REGISTRO — o Mercado Pago ' +
        `devolveu o dinheiro do pedido ${pedidoId} (pagamento ${mpPaymentId}, ` +
        `reembolso ${refund.id ?? 'sem id'}) e a gravação no banco falhou. ` +
        'O pedido continua PAGO no sistema e o acesso NÃO foi revogado. ' +
        'Conferir em pedidos_reembolso_em_aberto_idx.'
    )
    return jsonResponse(
      {
        erro: 'reembolsado_sem_registro',
        pedido_id: pedidoId,
        reembolso_mp_id: refund.id,
        mensagem:
          'O reembolso foi feito no Mercado Pago, mas o pedido não pôde ser ' +
          'atualizado. Não repita a operação: o registro será acertado na ' +
          'próxima tentativa.',
      },
      502
    )
  }

  if (!conclusao) {
    // Mesma situação da falha acima; só o formato da resposta do PostgREST
    // difere. O log precisa ser igualmente gritante.
    console.error(
      '[checkout-reembolsar] REEMBOLSADO SEM REGISTRO — resposta vazia da ' +
        `pedido_reembolso_concluir. Pedido ${pedidoId}, pagamento ` +
        `${mpPaymentId}, reembolso ${refund.id ?? 'sem id'}.`
    )
    return jsonResponse(
      { erro: 'reembolsado_sem_registro', pedido_id: pedidoId },
      502
    )
  }

  if (conclusao.receivable_id && conclusao.receivable_cancelado === false) {
    // Não é erro: ou outra passagem já cancelou, ou o recebível sumiu. Vale o
    // log porque é a única pista de recebível que ficou como receita.
    console.error(
      `[checkout-reembolsar] Recebível ${conclusao.receivable_id} do pedido ` +
        `${pedidoId} não foi cancelado nesta passagem. Conferir no Financeiro.`
    )
  }

  return jsonResponse({
    pedido_id: pedidoId,
    status: 'reembolsado',
    // 'reembolsado' = esta chamada virou o pedido; 'ja_reembolsado' = já
    // estava. A tela pode diferenciar; ambos são sucesso.
    resultado: conclusao.resultado,
    reembolso_mp_id: conclusao.reembolso_mp_id ?? refund.id,
    reembolsado_em: conclusao.reembolsado_em ?? null,
    valor_centavos: refund.valor_centavos,
    // 'in_process' = reembolso em contingência no MP: já saiu daqui, mas o
    // crédito ao cliente ainda está a caminho. A tela precisa saber para não
    // prometer "já está na conta dele".
    mp_status: refund.status,
    // O acesso ao Plano de Correção morre junto: o worker do Scan recusa
    // pedido cujo status não seja 'pago'.
    plano_code_revogado: conclusao.plano_code ?? null,
    receivable_id: conclusao.receivable_id ?? null,
    receivable_cancelado: conclusao.receivable_cancelado ?? false,
  })
}

Deno.serve(
  withCors(async (req) => {
    if (req.method !== 'POST') {
      return jsonResponse({ erro: 'method_not_allowed' }, 405)
    }

    // ----------------------------------------------------------------------
    // 1. Autenticação — o chamador é gente do painel?
    // ----------------------------------------------------------------------
    // `verify_jwt` da plataforma já barrou quem não tem token. Aqui o JWT é
    // resolvido para saber QUEM é, porque o reembolso é gravado com autor, e
    // é conferido contra `profiles`: um JWT válido pode ser de qualquer conta
    // do projeto Supabase, inclusive de alguém que nunca foi da equipe.

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ erro: 'nao_autenticado' }, 401)
    }
    const jwt = authHeader.slice('Bearer '.length)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) {
      console.error('[checkout-reembolsar] Env ausente.')
      return jsonResponse({ erro: 'config_ausente' }, 500)
    }

    const usuarioRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${jwt}` },
    })
    if (!usuarioRes.ok) {
      return jsonResponse({ erro: 'nao_autenticado' }, 401)
    }
    const usuario = (await usuarioRes.json()) as { id?: string }
    if (!usuario.id) {
      return jsonResponse({ erro: 'nao_autenticado' }, 401)
    }

    const perfilRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${usuario.id}&select=id`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    )
    if (!perfilRes.ok) {
      console.error(
        '[checkout-reembolsar] Falha ao checar profile:',
        perfilRes.status
      )
      return jsonResponse({ erro: 'falha_ao_validar_permissao' }, 502)
    }
    const perfis = (await perfilRes.json()) as Array<{ id: string }>
    if (perfis.length === 0) {
      return jsonResponse({ erro: 'acesso_negado' }, 403)
    }

    // ----------------------------------------------------------------------
    // 2. Entrada
    // ----------------------------------------------------------------------

    let body: RequestBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ erro: 'payload_invalido' }, 400)
    }

    const pedidoId = (body.pedido_id ?? '').trim()
    if (!UUID_RE.test(pedidoId)) {
      return jsonResponse({ erro: 'pedido_id_invalido' }, 400)
    }

    const db: Db = criarDb(supabaseUrl, serviceRoleKey)

    // ----------------------------------------------------------------------
    // 3. Reserva — a trava do banco, ANTES do gateway
    // ----------------------------------------------------------------------

    let reserva: ReembolsoRpc | null
    try {
      reserva = await db.rpc<ReembolsoRpc>('pedido_reembolso_iniciar', {
        p_pedido_id: pedidoId,
        p_usuario_id: usuario.id,
      })
    } catch {
      return jsonResponse({ erro: 'falha_ao_reservar_reembolso' }, 502)
    }
    if (!reserva) {
      return jsonResponse({ erro: 'falha_ao_reservar_reembolso' }, 502)
    }

    switch (reserva.resultado) {
      case 'reservado':
        break

      case 'ja_reembolsado':
        // SUCESSO, não erro — a decisão está no cabeçalho. Duas abas, um
        // reembolso já feito ontem e um retry de rede caem todos aqui, e a
        // tela deve mostrar "reembolsado", não uma falha.
        return jsonResponse({
          pedido_id: pedidoId,
          status: 'reembolsado',
          resultado: 'ja_reembolsado',
          reembolso_mp_id: reserva.reembolso_mp_id ?? null,
          reembolsado_em: reserva.reembolsado_em ?? null,
          receivable_id: reserva.receivable_id ?? null,
        })

      case 'em_andamento':
        // Outro clique está com a reserva. 409 e não 500: o pedido está sendo
        // reembolsado agora, e a tela precisa dizer isso em vez de convidar a
        // pessoa a tentar de novo.
        return jsonResponse(
          {
            erro: 'reembolso_em_andamento',
            pedido_id: pedidoId,
            mensagem: 'Este reembolso já está sendo processado.',
          },
          409
        )

      case 'nao_encontrado':
        return jsonResponse({ erro: 'pedido_nao_encontrado' }, 404)

      case 'status_invalido':
        return jsonResponse(
          {
            erro: 'pedido_nao_esta_pago',
            status: reserva.status ?? null,
            mensagem: 'Só pedido pago pode ser reembolsado.',
          },
          422
        )

      case 'sem_pagamento':
        return jsonResponse(
          {
            erro: 'pedido_sem_pagamento',
            mensagem:
              'Este pedido não tem pagamento no Mercado Pago para reembolsar.',
          },
          422
        )

      default:
        console.error(
          '[checkout-reembolsar] Resultado inesperado da reserva:',
          reserva.resultado,
          'pedido:',
          pedidoId
        )
        return jsonResponse({ erro: 'falha_ao_reservar_reembolso' }, 502)
    }

    const mpPaymentId = reserva.mp_payment_id
    if (!mpPaymentId) {
      // A RPC só devolve 'reservado' com pagamento, mas confiar nisso aqui
      // significaria montar a URL com "undefined" se aquilo mudasse.
      console.error(
        '[checkout-reembolsar] Reserva sem mp_payment_id. Pedido:',
        pedidoId
      )
      return jsonResponse({ erro: 'pedido_sem_pagamento' }, 422)
    }

    if (reserva.retomada === true) {
      // Reserva anterior venceu sem desfecho: pode haver um reembolso já feito
      // do outro lado. A chave de idempotência cuida disso, mas o log marca a
      // ocorrência — é o rastro de que algo falhou no meio antes.
      console.error(
        `[checkout-reembolsar] Retomando reserva vencida do pedido ${pedidoId} ` +
          `(pagamento ${mpPaymentId}). Houve tentativa anterior sem desfecho.`
      )
    }

    // ----------------------------------------------------------------------
    // 4. Mercado Pago
    // ----------------------------------------------------------------------

    let refund: RefundMp | null
    try {
      refund = await reembolsarNoMp(mpAccessToken, mpPaymentId, pedidoId)
    } catch {
      // Não se sabe se reembolsou. A reserva FICA de propósito: soltá-la aqui
      // convidaria um segundo clique a chamar o gateway enquanto o primeiro
      // talvez esteja devolvendo o dinheiro. Passada a janela, a próxima
      // tentativa retoma e converge pela chave de idempotência.
      return jsonResponse(
        {
          erro: 'gateway_indisponivel',
          pedido_id: pedidoId,
          mensagem:
            'Não foi possível confirmar o reembolso com o Mercado Pago. ' +
            'Aguarde e tente novamente — a operação não será duplicada.',
        },
        502
      )
    }

    if (!refund) {
      // O MP recusou de forma definitiva. A recusa MAIS COMUM é o pagamento já
      // estar reembolsado, então antes de devolver erro consultamos o estado
      // real — ver o cabeçalho sobre reconciliação.
      const consulta = await pagamentoJaReembolsado(mpAccessToken, mpPaymentId)

      if (consulta?.reembolsado) {
        console.error(
          `[checkout-reembolsar] Pagamento ${mpPaymentId} do pedido ${pedidoId} ` +
            'já estava reembolsado no Mercado Pago; reconciliando o estado.'
        )
        return await registrarDesfecho(
          db,
          pedidoId,
          consulta.refund,
          mpPaymentId
        )
      }

      if (consulta === null) {
        // Recusou E não deu para confirmar o estado. Trata-se como dúvida, e
        // dúvida mantém a reserva: ver o ramo do catch acima.
        return jsonResponse(
          {
            erro: 'gateway_indisponivel',
            pedido_id: pedidoId,
            mensagem:
              'O Mercado Pago recusou o reembolso e não foi possível ' +
              'confirmar a situação do pagamento. Tente novamente.',
          },
          502
        )
      }

      // Recusa confirmada com o pagamento NÃO reembolsado: nada saiu. Aqui —
      // e só aqui — soltar a reserva é seguro, e é o que permite ao operador
      // corrigir e tentar de novo sem esperar a janela vencer.
      try {
        await db.rpc('pedido_reembolso_liberar', { p_pedido_id: pedidoId })
      } catch {
        console.error(
          '[checkout-reembolsar] Falha ao liberar a reserva do pedido',
          pedidoId,
          '— ela vence sozinha.'
        )
      }

      return jsonResponse(
        {
          erro: 'gateway_recusou',
          pedido_id: pedidoId,
          mensagem: 'O Mercado Pago recusou o reembolso.',
        },
        502
      )
    }

    // ----------------------------------------------------------------------
    // 5. Desfecho — só agora o banco muda
    // ----------------------------------------------------------------------

    return await registrarDesfecho(db, pedidoId, refund, mpPaymentId)
  })
)
