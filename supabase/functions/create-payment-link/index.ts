/**
 * create-payment-link
 *
 * Recebe { receivable_id }, exige JWT de usuário autenticado (via header
 * Authorization) que seja membro do time (checado em public.profiles com
 * service role), cria uma preferência de pagamento no Mercado Pago para a
 * parcela informada e grava payment_link (init_point) + gateway_payment_id
 * na receivable via service role.
 *
 * Sem MP_ACCESS_TOKEN configurada, responde 400 (config ausente).
 * Nunca loga o valor de MP_ACCESS_TOKEN nem do JWT recebido.
 */

interface RequestBody {
  receivable_id?: string
}

interface ReceivableRecord {
  id: string
  descricao: string
  valor: number
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const jwt = authHeader.slice('Bearer '.length)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'payload_invalido' }, 400)
  }

  const receivableId = body.receivable_id
  if (!receivableId) {
    return jsonResponse({ error: 'receivable_id é obrigatório.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[create-payment-link] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  // Valida o JWT e resolve o usuário autenticado.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${jwt}`,
    },
  })
  if (!userRes.ok) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }
  const user = (await userRes.json()) as { id?: string }
  if (!user.id) {
    return jsonResponse({ error: 'Não autenticado.' }, 401)
  }

  // is_team_member: existe profile para esse uid.
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!profileRes.ok) {
    console.error('[create-payment-link] Falha ao checar profile:', profileRes.status)
    return jsonResponse({ error: 'Falha ao validar permissão.' }, 502)
  }
  const profiles = (await profileRes.json()) as Array<{ id: string }>
  if (profiles.length === 0) {
    return jsonResponse({ error: 'Acesso negado.' }, 403)
  }

  const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!mpAccessToken) {
    return jsonResponse({ error: 'MP_ACCESS_TOKEN não configurado' }, 400)
  }

  // Busca a parcela com service role.
  const receivableRes = await fetch(
    `${supabaseUrl}/rest/v1/receivables?id=eq.${receivableId}` +
      '&select=id,descricao,valor',
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!receivableRes.ok) {
    console.error(
      '[create-payment-link] Falha ao buscar receivable:',
      receivableRes.status
    )
    return jsonResponse({ error: 'Falha ao buscar parcela.' }, 502)
  }
  const receivables = (await receivableRes.json()) as ReceivableRecord[]
  const receivable = receivables[0]
  if (!receivable) {
    return jsonResponse({ error: 'Parcela não encontrada.' }, 404)
  }

  // Cria a preferência de pagamento no Mercado Pago.
  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          title: receivable.descricao,
          quantity: 1,
          unit_price: receivable.valor,
          currency_id: 'BRL',
        },
      ],
      external_reference: receivable.id,
    }),
  })

  const mpBody = (await mpRes.json()) as Record<string, unknown>
  if (!mpRes.ok) {
    console.error(
      '[create-payment-link] Erro do Mercado Pago:',
      mpRes.status,
      JSON.stringify(mpBody)
    )
    return jsonResponse(
      { error: 'Falha ao criar preferência de pagamento.' },
      502
    )
  }

  const initPoint = mpBody.init_point as string | undefined
  const preferenceId = mpBody.id as string | undefined
  if (!initPoint || !preferenceId) {
    console.error('[create-payment-link] Resposta do MP sem init_point/id.')
    return jsonResponse({ error: 'Resposta inválida do gateway.' }, 502)
  }

  // Grava payment_link + gateway_payment_id na parcela via service role.
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
        payment_link: initPoint,
        gateway_payment_id: preferenceId,
      }),
    }
  )
  if (!updateRes.ok) {
    console.error(
      '[create-payment-link] Falha ao atualizar receivable:',
      updateRes.status
    )
    return jsonResponse({ error: 'Falha ao salvar link de pagamento.' }, 502)
  }

  return jsonResponse({ ok: true, payment_link: initPoint })
})
