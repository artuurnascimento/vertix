/**
 * payment-webhook
 *
 * Endpoint público (sem JWT) chamado pelo Mercado Pago. Valida a query
 * `?token=` contra WEBHOOK_SECRET antes de processar qualquer coisa.
 * Ao confirmar um pagamento aprovado (consulta a API do MP pelo payment_id
 * recebido, valida status === 'approved' e resolve external_reference =
 * receivable_id), marca a parcela como paga + activity_log tipo 'financeiro'.
 *
 * Sem WEBHOOK_SECRET configurado, responde 500 (config ausente).
 * Nunca loga o valor de WEBHOOK_SECRET, MP_ACCESS_TOKEN nem VERTIX_SERVICE_TOKEN.
 *
 * ENTREGA DO VERTIX SCAN (2026-09-07): quando a parcela paga corresponde a uma
 * linha de raiox_compras (venda do Plano de Correção), a compra é marcada como
 * paga, a reanálise fica agendada para 30 dias e o worker do Scan é avisado
 * para gerar o plano, o recibo e mandar por e-mail.
 *
 * Esse trecho é DELIBERADAMENTE incapaz de derrubar o fluxo financeiro acima:
 * roda depois da baixa da parcela, engole qualquer erro e nunca muda o status
 * da resposta. Se ele falhasse (ou respondesse != 2xx), o Mercado Pago
 * reenviaria a notificação para sempre e a parcela já paga seria reprocessada.
 * Env faltando, tabela ausente ou worker fora do ar: loga e segue — a compra
 * fica registrada como paga e a entrega é recuperável depois.
 */

interface MpNotification {
  type?: string
  action?: string
  data?: { id?: string }
}

interface MpPayment {
  id: number | string
  status: string
  external_reference?: string | null
}

interface ReceivableRecord {
  id: string
  project_id: string
  status: string
}

interface CompraRecord {
  id: string
  analysis_id: string
  plano_code: string | null
  status: string
}

/** Prazo até a reanálise cortesia que o Plano de Correção promete. */
const REANALISE_DIAS = 30
const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Teto de espera pelo worker do Scan — a entrega não pode segurar o webhook. */
const WORKER_TIMEOUT_MS = 10_000

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Entrega do Plano de Correção. Nunca lança: todo caminho de erro é log.
 * Parcela de agência simplesmente não acha compra e sai na primeira consulta.
 */
async function entregarCompraDoScan(
  supabaseUrl: string,
  serviceRoleKey: string,
  receivableId: string
): Promise<void> {
  const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }

  let compra: CompraRecord | undefined
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/raiox_compras?receivable_id=eq.${receivableId}` +
        '&select=id,analysis_id,plano_code,status&limit=1',
      { headers: authHeaders }
    )
    if (!res.ok) {
      // Inclui o caso "migration ainda não aplicada" — não é erro fatal aqui.
      console.error('[payment-webhook] Falha ao buscar raiox_compras:', res.status)
      return
    }
    compra = ((await res.json()) as CompraRecord[])[0]
  } catch (erro) {
    console.error('[payment-webhook] Erro ao buscar raiox_compras:', erro)
    return
  }

  // Parcela normal da agência: nada a fazer.
  if (!compra) return
  // Reentrega do MP para uma compra já processada.
  if (compra.status === 'pago') return

  // Marca como paga ANTES de chamar o worker: se o worker não responder, o
  // dinheiro continua reconciliado e a entrega pode ser reprocessada.
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/raiox_compras?id=eq.${compra.id}`,
      {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'pago',
          pago_em: new Date().toISOString(),
          reanalise_agendada_em: new Date(
            Date.now() + REANALISE_DIAS * MS_POR_DIA
          ).toISOString(),
        }),
      }
    )
    if (!res.ok) {
      console.error('[payment-webhook] Falha ao marcar compra paga:', res.status)
      return
    }
  } catch (erro) {
    console.error('[payment-webhook] Erro ao marcar compra paga:', erro)
    return
  }

  const workerUrl = Deno.env.get('SCAN_WORKER_URL')
  // VERTIX_SERVICE_TOKEN é o nome certo desta direção (admin → rotas
  // /api/vertix/* do worker) e tem precedência. SCAN_SERVICE_TOKEN fica só
  // como alternativa, e NUNCA na frente: numa venda real ele estava ausente
  // aqui — o token saiu indefinido, a chamada ao worker nem foi tentada, e o
  // cliente ficou 18 minutos pago sem receber o plano.
  const vertixToken =
    Deno.env.get('VERTIX_SERVICE_TOKEN') ?? Deno.env.get('SCAN_SERVICE_TOKEN')
  if (!workerUrl || !vertixToken) {
    console.error(
      '[payment-webhook] SCAN_WORKER_URL/SCAN_SERVICE_TOKEN ausentes — ' +
        `compra ${compra.id} paga sem aviso ao worker.`
    )
    return
  }

  try {
    const res = await fetch(
      `${workerUrl.replace(/\/+$/, '')}/api/vertix/compra-paga`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${vertixToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compra_id: compra.id,
          analysis_id: compra.analysis_id,
          plano_code: compra.plano_code,
        }),
        signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
      }
    )
    if (!res.ok) {
      console.error(
        `[payment-webhook] Worker do Scan recusou a compra ${compra.id}:`,
        res.status
      )
    }
  } catch (erro) {
    console.error(
      `[payment-webhook] Worker do Scan indisponível (compra ${compra.id}):`,
      erro
    )
  }
}

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('[payment-webhook] WEBHOOK_SECRET não configurado.')
    return jsonResponse({ error: 'config_ausente' }, 500)
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (token !== webhookSecret) {
    return jsonResponse({ error: 'token_invalido' }, 401)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: true, skipped: 'method_not_allowed' })
  }

  let notification: MpNotification
  try {
    notification = await req.json()
  } catch {
    return jsonResponse({ ok: false, reason: 'payload_invalido' }, 400)
  }

  if (notification.type !== 'payment' || !notification.data?.id) {
    return jsonResponse({ ok: true, skipped: 'nao_e_pagamento' })
  }

  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!mpAccessToken || !supabaseUrl || !serviceRoleKey) {
    console.error('[payment-webhook] Env ausente (MP_ACCESS_TOKEN/Supabase).')
    return jsonResponse({ ok: false, reason: 'env_ausente' }, 500)
  }

  // Confirma o pagamento diretamente na API do MP (nunca confia só no payload).
  const paymentRes = await fetch(
    `https://api.mercadopago.com/v1/payments/${notification.data.id}`,
    {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    }
  )
  if (!paymentRes.ok) {
    console.error('[payment-webhook] Falha ao consultar pagamento no MP:', paymentRes.status)
    return jsonResponse({ ok: false, reason: 'pagamento_nao_confirmado' }, 502)
  }

  const payment = (await paymentRes.json()) as MpPayment
  if (payment.status !== 'approved') {
    return jsonResponse({ ok: true, skipped: 'status_nao_aprovado' })
  }

  const receivableId = payment.external_reference
  if (!receivableId) {
    return jsonResponse({ ok: true, skipped: 'sem_external_reference' })
  }

  const receivableRes = await fetch(
    `${supabaseUrl}/rest/v1/receivables?id=eq.${receivableId}` +
      '&select=id,project_id,status',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!receivableRes.ok) {
    console.error('[payment-webhook] Falha ao buscar receivable:', receivableRes.status)
    return jsonResponse({ ok: false, reason: 'receivable_nao_carregada' }, 502)
  }
  const receivables = (await receivableRes.json()) as ReceivableRecord[]
  const receivable = receivables[0]
  if (!receivable) {
    return jsonResponse({ ok: false, reason: 'receivable_nao_encontrada' }, 404)
  }

  if (receivable.status === 'pago') {
    return jsonResponse({ ok: true, skipped: 'ja_pago' })
  }

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/receivables?id=eq.${receivableId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        status: 'pago',
        pago_em: new Date().toISOString().slice(0, 10),
        forma_pagamento: 'mercado_pago',
      }),
    }
  )
  if (!updateRes.ok) {
    console.error('[payment-webhook] Falha ao atualizar receivable:', updateRes.status)
    return jsonResponse({ ok: false, reason: 'falha_ao_atualizar' }, 502)
  }

  const activityRes = await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      project_id: receivable.project_id,
      user_id: null,
      tipo: 'financeiro',
      descricao: 'Pagamento confirmado via Mercado Pago (parcela ' + receivable.id + ')',
    }),
  })
  if (!activityRes.ok) {
    console.error('[payment-webhook] Falha ao gravar activity_log:', activityRes.status)
  }

  // Entrega do Vertix Scan. Roda por último, não lança e não altera a resposta:
  // o Mercado Pago precisa receber OK mesmo quando a entrega falha.
  await entregarCompraDoScan(supabaseUrl, serviceRoleKey, receivable.id)

  return jsonResponse({ ok: true })
})
