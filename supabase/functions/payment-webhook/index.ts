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
 * Nunca loga o valor de WEBHOOK_SECRET nem de MP_ACCESS_TOKEN.
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

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

  return jsonResponse({ ok: true })
})
