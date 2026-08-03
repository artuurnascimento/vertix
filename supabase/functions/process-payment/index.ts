/**
 * process-payment
 *
 * Backend da página de pagamento própria (/pagar/:token). Recebe o token
 * público da parcela + o formData do Payment Brick e cria o pagamento na API
 * do Mercado Pago (/v1/payments).
 *
 * Segurança:
 *   • O valor, a descrição e o external_reference vêm SEMPRE do banco,
 *     resolvidos pelo payment_token — o navegador não dita quanto se paga.
 *   • Parcela já paga é recusada antes de qualquer chamada ao MP.
 *   • notification_url aponta para o payment-webhook com o WEBHOOK_SECRET,
 *     então a confirmação não depende da configuração de webhooks do painel.
 *   • Nunca loga MP_ACCESS_TOKEN nem dados de cartão.
 */

import { withCors } from '../_shared/cors.ts'

interface PayerIdentification {
  type?: string
  number?: string
}

interface BrickFormData {
  payment_method_id?: string
  token?: string
  installments?: number
  issuer_id?: string | number
  payer?: {
    email?: string
    first_name?: string
    last_name?: string
    identification?: PayerIdentification
  }
}

interface RequestBody {
  token?: string
  formData?: BrickFormData
}

interface ReceivableRecord {
  id: string
  descricao: string
  valor: number
  status: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PIX_EXPIRATION_MS = 60 * 60 * 1000

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'payload_invalido' }, 400)
  }

  const token = body.token
  if (!token || !UUID_RE.test(token)) {
    return jsonResponse({ error: 'token_invalido' }, 400)
  }

  const formData = body.formData
  if (!formData?.payment_method_id || !formData.payer?.email) {
    return jsonResponse({ error: 'dados_pagamento_incompletos' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) {
    console.error('[process-payment] Env ausente.')
    return jsonResponse({ error: 'config_ausente' }, 500)
  }

  // Resolve a parcela pelo token público — fonte única de valor/descrição.
  const receivableRes = await fetch(
    `${supabaseUrl}/rest/v1/receivables?payment_token=eq.${token}` +
      '&select=id,descricao,valor,status',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!receivableRes.ok) {
    console.error('[process-payment] Falha ao buscar parcela:', receivableRes.status)
    return jsonResponse({ error: 'falha_ao_buscar_cobranca' }, 502)
  }
  const receivables = (await receivableRes.json()) as ReceivableRecord[]
  const receivable = receivables[0]
  if (!receivable) {
    return jsonResponse({ error: 'cobranca_nao_encontrada' }, 404)
  }
  if (receivable.status === 'pago') {
    return jsonResponse({ error: 'ja_pago' }, 409)
  }

  const isPix = formData.payment_method_id === 'pix'

  // Monta o pagamento com whitelist explícita do formData do Brick.
  const payment: Record<string, unknown> = {
    transaction_amount: Math.round(Number(receivable.valor) * 100) / 100,
    description: receivable.descricao,
    external_reference: receivable.id,
    payment_method_id: formData.payment_method_id,
    statement_descriptor: 'VERTIX',
    payer: {
      email: formData.payer.email,
      ...(formData.payer.first_name && { first_name: formData.payer.first_name }),
      ...(formData.payer.last_name && { last_name: formData.payer.last_name }),
      ...(formData.payer.identification?.number && {
        identification: {
          type: formData.payer.identification.type,
          number: formData.payer.identification.number,
        },
      }),
    },
  }

  if (webhookSecret) {
    payment.notification_url =
      `${supabaseUrl}/functions/v1/payment-webhook?token=${webhookSecret}`
  }

  if (isPix) {
    payment.date_of_expiration = new Date(
      Date.now() + PIX_EXPIRATION_MS
    ).toISOString()
  } else {
    // Cartão: campos tokenizados pelo Brick no navegador.
    if (!formData.token) {
      return jsonResponse({ error: 'dados_pagamento_incompletos' }, 400)
    }
    payment.token = formData.token
    payment.installments = formData.installments ?? 1
    if (formData.issuer_id != null) payment.issuer_id = formData.issuer_id
  }

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payment),
  })

  const mpBody = (await mpRes.json()) as Record<string, unknown>
  if (!mpRes.ok) {
    // Loga o corpo do erro (não contém o access token nem número de cartão).
    console.error('[process-payment] Erro do MP:', mpRes.status, JSON.stringify(mpBody))
    return jsonResponse({ error: 'gateway_recusou', detail: mpBody.message ?? null }, 502)
  }

  const poi = mpBody.point_of_interaction as
    | { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } }
    | undefined

  return jsonResponse({
    ok: true,
    payment_id: mpBody.id,
    status: mpBody.status,
    status_detail: mpBody.status_detail,
    ...(isPix && poi?.transaction_data && {
      pix: {
        qr_code: poi.transaction_data.qr_code ?? null,
        qr_code_base64: poi.transaction_data.qr_code_base64 ?? null,
        ticket_url: poi.transaction_data.ticket_url ?? null,
      },
    }),
  })
}))
