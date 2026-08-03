/**
 * create-payment-link
 *
 * Recebe { receivable_id }, exige JWT de usuário autenticado que seja membro
 * do time (checado em public.profiles com service role) e grava em
 * payment_link a URL da NOSSA página de pagamento (/pagar/:payment_token) —
 * o checkout acontece no nosso domínio e o Mercado Pago só processa, via
 * edge function process-payment.
 *
 * A base da URL vem do header Origin da requisição (o navegador sempre envia
 * em POST cross-origin), com fallback em ADMIN_APP_URL. Função mantida por
 * compatibilidade: frontends antigos que ainda a chamam passam a gerar o
 * link novo automaticamente.
 */

import { withCors } from '../_shared/cors.ts'

interface RequestBody {
  receivable_id?: string
}

interface ReceivableRecord {
  id: string
  payment_token: string
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function resolveBaseUrl(req: Request): string | null {
  const origin = req.headers.get('Origin')
  if (origin) {
    try {
      const parsed = new URL(origin)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin
      }
    } catch {
      // cai no fallback
    }
  }
  return Deno.env.get('ADMIN_APP_URL') ?? null
}

Deno.serve(withCors(async (req) => {
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

  const baseUrl = resolveBaseUrl(req)
  if (!baseUrl) {
    return jsonResponse({ error: 'origem_desconhecida' }, 400)
  }

  // Busca o token público da parcela.
  const receivableRes = await fetch(
    `${supabaseUrl}/rest/v1/receivables?id=eq.${receivableId}` +
      '&select=id,payment_token',
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

  const paymentLink = `${baseUrl}/pagar/${receivable.payment_token}`

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
      body: JSON.stringify({ payment_link: paymentLink }),
    }
  )
  if (!updateRes.ok) {
    console.error(
      '[create-payment-link] Falha ao atualizar receivable:',
      updateRes.status
    )
    return jsonResponse({ error: 'Falha ao salvar link de pagamento.' }, 502)
  }

  return jsonResponse({ ok: true, payment_link: paymentLink })
}))
