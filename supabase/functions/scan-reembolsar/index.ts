/**
 * scan-reembolsar
 *
 * Reembolso TOTAL de uma compra do Vertix Scan (public.raiox_compras), pedido
 * pelo painel em Captação → Vertix Scan → Vendas.
 *
 * Recebe `{ compra_id }`, devolve o dinheiro pelo Mercado Pago, marca a compra
 * como 'reembolsado' (o que REVOGA o acesso ao Plano de Correção, porque o
 * worker do Scan recusa compra cujo status não seja 'pago') e tira a venda da
 * receita cancelando o recebível.
 *
 * IRMÃ DA `checkout-reembolsar`, E DE PROPÓSITO SEPARADA
 *   As duas devolvem dinheiro, mas sobre tabelas diferentes: `pedidos` (o
 *   checkout novo) e `raiox_compras` (o funil do Scan). RPCs diferentes,
 *   vocabulário de status diferente ('aguardando' × 'aguardando_pagamento'),
 *   e — o que decide — uma diferença que nenhuma bifurcação disfarçaria: o
 *   pedido guarda `mp_payment_id` na própria linha, e a compra do Scan NÃO
 *   guarda o id do pagamento em lugar nenhum. Aqui existe uma etapa a mais,
 *   inteira, que lá não faz sentido (seção 4). Uma function com dois caminhos
 *   teria dois "se é pedido / se é compra" em cada uma das cinco etapas.
 *
 *   O que as duas fazem NO GATEWAY, que é a parte cara de errar, é o mesmo
 *   código de verdade: `_shared/reembolso.ts`. É lá que moram a chave de
 *   idempotência, o header de contingência, a distinção entre "recusou" e "não
 *   sei" e a reconciliação por GET do pagamento.
 *
 * AUTENTICADA. Não há entrada em `config.toml` para esta function, e isso é
 * deliberado: sem entrada, `verify_jwt` fica no padrão `true` e a plataforma
 * recusa a chamada antes do nosso código rodar. Acrescentá-la com
 * `verify_jwt = false` abriria o reembolso para a internet inteira. O JWT ainda
 * é revalidado em autenticarPainel(), e o chamador precisa ter perfil em
 * `profiles`.
 *
 * SÓ REEMBOLSO TOTAL. Não existe campo de valor no corpo, e acrescentar um
 * seria um bug: o valor devolvido é o que o Mercado Pago confirmar, e a compra
 * é binária entre 'pago' e 'reembolsado'.
 *
 * A ORDEM É A REGRA MAIS IMPORTANTE DESTE ARQUIVO
 *   1. RESERVA no banco (scan_compra_reembolso_iniciar) — antes de tocar no
 *      gateway.
 *   2. Resolve QUAL pagamento estornar (seção 4).
 *   3. Chama o Mercado Pago.
 *   4. Só depois de o MP confirmar, grava o desfecho
 *      (scan_compra_reembolso_concluir).
 *
 *   Gravar antes de o MP confirmar diria ao cliente que o dinheiro voltou sem
 *   ele ter voltado. Reservar depois deixaria dois cliques chamarem o gateway
 *   duas vezes.
 *
 * IDEMPOTÊNCIA — DUAS TRAVAS, PORQUE UMA SÓ MORA DO OUTRO LADO DA REDE
 *   • No BANCO: a reserva da etapa 1 é um lock de linha. O segundo clique não
 *     reserva e recebe 409, sem nunca chegar ao Mercado Pago.
 *   • No MERCADO PAGO: `X-Idempotency-Key` derivada da compra (sempre a mesma
 *     string para a mesma compra). Se a chamada escapar da primeira trava —
 *     retry de rede, reserva vencida sendo retomada —, o MP devolve o
 *     reembolso que já existe em vez de devolver o dinheiro outra vez.
 *
 * O CASO PERIGOSO: MP REEMBOLSOU E A GRAVAÇÃO FALHOU
 *   Aí o dinheiro voltou e o sistema acha que não. O tratamento é o mesmo da
 *   checkout-reembolsar: a RESERVA fica no banco (`reembolso_iniciado_em`
 *   preenchido com `reembolsado_em` nulo — o par que o índice parcial
 *   `raiox_compras_reembolso_em_aberto_idx` existe para achar), o log sai com
 *   os três ids que permitem casar a linha com o extrato, e a resposta é 502
 *   com `erro: 'reembolsado_sem_registro'` para a tela NÃO dizer "não deu,
 *   tente de novo" sobre dinheiro que já saiu.
 *
 * NUNCA loga MP_ACCESS_TOKEN, JWT do chamador, dado de cartão nem documento
 * do cliente.
 */

import { withCors } from '../_shared/cors.ts'
import { criarDb, jsonResponse, UUID_RE, type Db } from '../_shared/checkout.ts'
import {
  autenticarPainel,
  buscarPagamentoPorReferencia,
  pagamentoJaReembolsado,
  reembolsarNoMp,
  type RefundMp,
} from '../_shared/reembolso.ts'

/** Prefixo de log e de erro; é o nome da function em toda mensagem. */
const ROTULO = 'scan-reembolsar'

interface RequestBody {
  compra_id?: string
}

/** Resposta das RPCs de reembolso do Scan (ver migration 20260908230000). */
interface ReembolsoRpc {
  resultado: string
  compra_id?: string
  receivable_id?: string | null
  gateway_payment_id?: string | null
  valor_centavos?: number
  plano_code?: string | null
  reembolso_mp_id?: string | null
  reembolsado_em?: string | null
  receivable_cancelado?: boolean
  reembolso_iniciado_em?: string | null
  retomada?: boolean
  status?: string
}

/**
 * Chave de idempotência do reembolso desta compra. DETERMINÍSTICA: sempre a
 * mesma string para a mesma compra, que é o que faz o Mercado Pago devolver o
 * reembolso existente em vez de criar um segundo numa rechamada.
 *
 * O sufixo `scan` separa esta chave da usada pela checkout-reembolsar. Os dois
 * ids são uuid de tabelas diferentes e uma colisão é improvável, mas a
 * documentação do MP avisa que mesma chave com corpo diferente é recusada —
 * e o custo de deixar isso ao acaso é uma recusa em cima de dinheiro real.
 */
function chaveIdempotencia(compraId: string): string {
  return `reembolso-scan-${compraId}`
}

/**
 * Solta a reserva. Só chamada quando se CONFIRMOU que nada saiu do gateway;
 * na dúvida a reserva fica e vence sozinha (ver a migration, seção 6).
 */
async function liberarReserva(db: Db, compraId: string): Promise<void> {
  try {
    await db.rpc('scan_compra_reembolso_liberar', { p_compra_id: compraId })
  } catch {
    console.error(
      `[${ROTULO}] Falha ao liberar a reserva da compra`,
      compraId,
      '— ela vence sozinha.'
    )
  }
}

/**
 * Grava o desfecho. Separada porque o tratamento da falha AQUI é o coração do
 * caso perigoso: o dinheiro já voltou, então não existe resposta boa — existe
 * a resposta que deixa alguém reconciliar.
 */
async function registrarDesfecho(
  db: Db,
  compraId: string,
  refund: RefundMp,
  mpPaymentId: string
): Promise<Response> {
  let conclusao: ReembolsoRpc | null
  try {
    conclusao = await db.rpc<ReembolsoRpc>('scan_compra_reembolso_concluir', {
      p_compra_id: compraId,
      p_mp_refund_id: refund.id,
      p_valor_centavos: refund.valor_centavos,
    })
  } catch {
    // O DINHEIRO VOLTOU E O BANCO NÃO SABE. Log com os três ids que permitem
    // casar a linha com o extrato à mão. A reserva continua gravada, então o
    // índice de reconciliação encontra esta compra e a próxima tentativa
    // converge pela chave de idempotência (ver cabeçalho).
    console.error(
      `[${ROTULO}] REEMBOLSADO SEM REGISTRO — o Mercado Pago devolveu o ` +
        `dinheiro da compra ${compraId} (pagamento ${mpPaymentId}, reembolso ` +
        `${refund.id ?? 'sem id'}) e a gravação no banco falhou. A compra ` +
        'continua PAGA no sistema e o acesso ao plano NÃO foi revogado. ' +
        'Conferir em raiox_compras_reembolso_em_aberto_idx.'
    )
    return jsonResponse(
      {
        erro: 'reembolsado_sem_registro',
        compra_id: compraId,
        reembolso_mp_id: refund.id,
        mensagem:
          'O reembolso foi feito no Mercado Pago, mas a compra não pôde ser ' +
          'atualizada. Não repita a operação: o registro será acertado na ' +
          'próxima tentativa.',
      },
      502
    )
  }

  if (!conclusao) {
    // Mesma situação da falha acima; só o formato da resposta do PostgREST
    // difere. O log precisa ser igualmente gritante.
    console.error(
      `[${ROTULO}] REEMBOLSADO SEM REGISTRO — resposta vazia da ` +
        `scan_compra_reembolso_concluir. Compra ${compraId}, pagamento ` +
        `${mpPaymentId}, reembolso ${refund.id ?? 'sem id'}.`
    )
    return jsonResponse(
      { erro: 'reembolsado_sem_registro', compra_id: compraId },
      502
    )
  }

  if (conclusao.receivable_id && conclusao.receivable_cancelado === false) {
    // Não é erro: ou outra passagem já cancelou, ou o recebível sumiu. Vale o
    // log porque é a única pista de recebível que ficou como receita.
    console.error(
      `[${ROTULO}] Recebível ${conclusao.receivable_id} da compra ${compraId} ` +
        'não foi cancelado nesta passagem. Conferir no Financeiro.'
    )
  }

  return jsonResponse({
    compra_id: compraId,
    status: 'reembolsado',
    // 'reembolsado' = esta chamada virou a compra; 'ja_reembolsado' = já
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
    // compra cujo status não seja 'pago'.
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
    // 1. Autenticação e ambiente
    // ----------------------------------------------------------------------

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) {
      console.error(`[${ROTULO}] Env ausente.`)
      return jsonResponse({ erro: 'config_ausente' }, 500)
    }

    const auth = await autenticarPainel(
      ROTULO,
      req,
      supabaseUrl,
      serviceRoleKey
    )
    if (!auth.ok) {
      return jsonResponse({ erro: auth.erro }, auth.status)
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

    const compraId = (body.compra_id ?? '').trim()
    if (!UUID_RE.test(compraId)) {
      return jsonResponse({ erro: 'compra_id_invalido' }, 400)
    }

    const db: Db = criarDb(supabaseUrl, serviceRoleKey)

    // ----------------------------------------------------------------------
    // 3. Reserva — a trava do banco, ANTES do gateway
    // ----------------------------------------------------------------------

    let reserva: ReembolsoRpc | null
    try {
      reserva = await db.rpc<ReembolsoRpc>('scan_compra_reembolso_iniciar', {
        p_compra_id: compraId,
        p_usuario_id: auth.usuarioId,
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
        // SUCESSO, não erro. Duas abas, um reembolso já feito ontem e um retry
        // de rede caem todos aqui, e a tela deve mostrar "reembolsado", não
        // uma falha.
        return jsonResponse({
          compra_id: compraId,
          status: 'reembolsado',
          resultado: 'ja_reembolsado',
          reembolso_mp_id: reserva.reembolso_mp_id ?? null,
          reembolsado_em: reserva.reembolsado_em ?? null,
          receivable_id: reserva.receivable_id ?? null,
        })

      case 'em_andamento':
        // Outro clique está com a reserva. 409 e não 500: a compra está sendo
        // reembolsada agora, e a tela precisa dizer isso em vez de convidar a
        // pessoa a tentar de novo.
        return jsonResponse(
          {
            erro: 'reembolso_em_andamento',
            compra_id: compraId,
            mensagem: 'Este reembolso já está sendo processado.',
          },
          409
        )

      case 'nao_encontrado':
        return jsonResponse({ erro: 'compra_nao_encontrada' }, 404)

      case 'status_invalido':
        return jsonResponse(
          {
            erro: 'compra_nao_esta_paga',
            status: reserva.status ?? null,
            mensagem: 'Só compra paga pode ser reembolsada.',
          },
          422
        )

      case 'sem_recebivel':
        return jsonResponse(
          {
            erro: 'compra_sem_recebivel',
            mensagem:
              'Esta compra não tem cobrança ligada a ela, então não há como ' +
              'achar o pagamento no Mercado Pago. O estorno tem de ser feito ' +
              'à mão pelo painel do gateway.',
          },
          422
        )

      default:
        console.error(
          `[${ROTULO}] Resultado inesperado da reserva:`,
          reserva.resultado,
          'compra:',
          compraId
        )
        return jsonResponse({ erro: 'falha_ao_reservar_reembolso' }, 502)
    }

    const receivableId = reserva.receivable_id
    const valorCentavos = reserva.valor_centavos
    if (!receivableId || typeof valorCentavos !== 'number') {
      // A RPC só devolve 'reservado' com os dois, mas confiar nisso aqui
      // significaria buscar por "undefined" se aquilo mudasse.
      console.error(
        `[${ROTULO}] Reserva incompleta (recebível ou valor ausente). Compra:`,
        compraId
      )
      await liberarReserva(db, compraId)
      return jsonResponse({ erro: 'falha_ao_reservar_reembolso' }, 502)
    }

    if (reserva.retomada === true) {
      // Reserva anterior venceu sem desfecho: pode haver um reembolso já feito
      // do outro lado. A chave de idempotência cuida disso, mas o log marca a
      // ocorrência — é o rastro de que algo falhou no meio antes.
      console.error(
        `[${ROTULO}] Retomando reserva vencida da compra ${compraId}. ` +
          'Houve tentativa anterior sem desfecho.'
      )
    }

    // ----------------------------------------------------------------------
    // 4. QUAL pagamento estornar — a etapa que a checkout-reembolsar não tem
    // ----------------------------------------------------------------------
    // `raiox_compras` nunca guardou o id do pagamento. Ele mora em
    // `receivables.gateway_payment_id`, e essa coluna ficou NULA em todas as
    // vendas até 2026-09-08, porque nenhum código a escrevia — a
    // payment-webhook passou a gravá-la só a partir dali. Ou seja: as vendas
    // que existem hoje chegam aqui SEM id.
    //
    // A saída é o `external_reference`. Quem monta a cobrança grava nele o id
    // do recebível (process-payment) e quem confirma o pagamento lê dele para
    // achar a parcela (payment-webhook); a busca faz o caminho de volta. O que
    // for encontrado é GRAVADO, então cada venda antiga paga esse custo uma
    // vez só — e nenhuma migration precisa chutar ids em massa.
    //
    // Os filtros da busca (referência exata, status que cobrou, valor ao
    // centavo) e a recusa em desempatar dois candidatos estão em
    // _shared/reembolso.ts. Aqui só se traduz o desfecho em HTTP.

    let mpPaymentId = reserva.gateway_payment_id ?? null

    if (!mpPaymentId) {
      const busca = await buscarPagamentoPorReferencia(
        ROTULO,
        mpAccessToken,
        receivableId,
        valorCentavos
      )

      if (busca.resultado === 'indisponivel') {
        // Dúvida, não ausência. A reserva FICA: soltá-la aqui não seria
        // perigoso (nada foi estornado), mas seria inconsistente com o resto
        // do arquivo — e a janela de 2 minutos custa pouco perto de um
        // gateway instável recebendo cliques repetidos.
        return jsonResponse(
          {
            erro: 'gateway_indisponivel',
            compra_id: compraId,
            mensagem:
              'Não foi possível consultar o Mercado Pago para achar o ' +
              'pagamento desta venda. Nada foi estornado — tente de novo.',
          },
          502
        )
      }

      if (busca.resultado === 'nao_encontrado') {
        // Confirmado que não há pagamento a estornar. Nada saiu, e aqui — só
        // aqui e no ramo do gateway_recusou — soltar a reserva é seguro.
        await liberarReserva(db, compraId)
        return jsonResponse(
          {
            erro: 'pagamento_nao_encontrado',
            compra_id: compraId,
            mensagem:
              'O Mercado Pago não tem nenhum pagamento aprovado desta venda ' +
              'com o valor cobrado. Nada foi estornado — confira a cobrança ' +
              'no painel do gateway.',
          },
          422
        )
      }

      if (busca.resultado === 'ambiguo') {
        // Mais de um pagamento cobrou o valor desta venda: o cliente foi
        // cobrado duas vezes. Escolher um por data seria adivinhar de qual
        // conta o dinheiro sai. Recusa explícita, com os ids na resposta.
        await liberarReserva(db, compraId)
        return jsonResponse(
          {
            erro: 'pagamento_ambiguo',
            compra_id: compraId,
            pagamentos: busca.candidatos.map((c) => c.id),
            mensagem:
              'Esta venda tem mais de um pagamento do mesmo valor no Mercado ' +
              'Pago. Nada foi estornado: escolher um por conta própria seria ' +
              'devolver da cobrança errada. Resolva no painel do gateway.',
          },
          409
        )
      }

      // Achou um só. Grava ANTES de estornar: se o estorno falhar no meio, a
      // próxima tentativa já encontra o id no banco e nem repete a busca.
      let gravado: { resultado?: string; gateway_payment_id?: string } | null
      try {
        gravado = await db.rpc('scan_compra_reembolso_pagamento', {
          p_receivable_id: receivableId,
          p_gateway_payment_id: busca.pagamento.id,
        })
      } catch {
        // Falhar em gravar não impede estornar — o id que a busca achou é o
        // mesmo, gravado ou não. Vale o log porque a próxima tentativa vai
        // pagar o custo da busca de novo.
        console.error(
          `[${ROTULO}] Não deu para gravar o pagamento ${busca.pagamento.id} ` +
            `no recebível ${receivableId}. Seguindo com o estorno.`
        )
        gravado = null
      }

      // Se a coluna já tinha um id (uma corrida com o webhook), é ELE que
      // manda: veio da confirmação do MP, e o da busca é inferência.
      mpPaymentId = gravado?.gateway_payment_id ?? busca.pagamento.id

      console.error(
        `[${ROTULO}] Compra ${compraId}: pagamento ${mpPaymentId} resolvido ` +
          `pelo external_reference ${receivableId} (${gravado?.resultado ?? 'sem gravação'}).`
      )
    }

    // ----------------------------------------------------------------------
    // 5. Mercado Pago
    // ----------------------------------------------------------------------

    let refund: RefundMp | null
    try {
      refund = await reembolsarNoMp(
        ROTULO,
        mpAccessToken,
        mpPaymentId,
        chaveIdempotencia(compraId)
      )
    } catch {
      // Não se sabe se reembolsou. A reserva FICA de propósito: soltá-la aqui
      // convidaria um segundo clique a chamar o gateway enquanto o primeiro
      // talvez esteja devolvendo o dinheiro. Passada a janela, a próxima
      // tentativa retoma e converge pela chave de idempotência.
      return jsonResponse(
        {
          erro: 'gateway_indisponivel',
          compra_id: compraId,
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
      // real: se está `refunded`, isso é SUCESSO reconciliado, não erro na
      // tela. É também o caminho por onde passa a venda cujo pagamento a busca
      // encontrou já estornado por fora.
      const consulta = await pagamentoJaReembolsado(
        ROTULO,
        mpAccessToken,
        mpPaymentId
      )

      if (consulta?.reembolsado) {
        console.error(
          `[${ROTULO}] Pagamento ${mpPaymentId} da compra ${compraId} já ` +
            'estava reembolsado no Mercado Pago; reconciliando o estado.'
        )
        return await registrarDesfecho(
          db,
          compraId,
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
            compra_id: compraId,
            mensagem:
              'O Mercado Pago recusou o reembolso e não foi possível ' +
              'confirmar a situação do pagamento. Tente novamente.',
          },
          502
        )
      }

      // Recusa confirmada com o pagamento NÃO reembolsado: nada saiu. Aqui é
      // seguro soltar a reserva, e é o que permite ao operador corrigir e
      // tentar de novo sem esperar a janela vencer.
      await liberarReserva(db, compraId)

      return jsonResponse(
        {
          erro: 'gateway_recusou',
          compra_id: compraId,
          mensagem: 'O Mercado Pago recusou o reembolso.',
        },
        502
      )
    }

    // ----------------------------------------------------------------------
    // 6. Desfecho — só agora o banco muda
    // ----------------------------------------------------------------------

    return await registrarDesfecho(db, compraId, refund, mpPaymentId)
  })
)
