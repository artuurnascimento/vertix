/**
 * shopify-order-webhook
 *
 * Endpoint público (sem JWT) para o webhook orders/paid da Shopify.
 * Valida o HMAC-SHA256 (header X-Shopify-Hmac-Sha256, base64 do raw body
 * com SHOPIFY_WEBHOOK_SECRET) antes de processar. Extrai UTMs do
 * landing_site do pedido (primeira página visitada, com query string) e
 * registra sessão + conversão purchase via RPCs do rastreador UTM —
 * atribuição server-side, sem depender do browser.
 *
 * Dedupe: pedido_ref = shopify-<order.id> (índice único ignora repetição).
 * Sem SHOPIFY_WEBHOOK_SECRET, responde 500 (config ausente).
 * Nunca loga o valor de SHOPIFY_WEBHOOK_SECRET.
 */

interface ShopifyOrder {
  id?: number | string
  total_price?: string
  landing_site?: string | null
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  )
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

/** Comparação em tempo constante (evita timing attack no HMAC). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function extractUtms(landingSite: string | null | undefined) {
  const vazio = {
    source: null as string | null,
    medium: null as string | null,
    campaign: null as string | null,
    content: null as string | null,
    term: null as string | null,
  }
  if (!landingSite) return vazio
  try {
    const url = new URL(landingSite, 'https://loja.shopify.com')
    const q = url.searchParams
    return {
      source: q.get('utm_source'),
      medium: q.get('utm_medium'),
      campaign: q.get('utm_campaign'),
      content: q.get('utm_content'),
      term: q.get('utm_term'),
    }
  } catch {
    return vazio
  }
}

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error(
      '[shopify-order-webhook] SHOPIFY_WEBHOOK_SECRET não configurado.'
    )
    return jsonResponse({ error: 'config_ausente' }, 500)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[shopify-order-webhook] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: true, skipped: 'method_not_allowed' })
  }

  const rawBody = await req.text()
  const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256') ?? ''
  const esperado = await hmacBase64(webhookSecret, rawBody)
  if (!safeEqual(hmacHeader, esperado)) {
    return jsonResponse({ error: 'hmac_invalido' }, 401)
  }

  let order: ShopifyOrder
  try {
    order = JSON.parse(rawBody) as ShopifyOrder
  } catch {
    return jsonResponse({ ok: false, reason: 'payload_invalido' }, 400)
  }

  if (order.id === undefined || order.id === null) {
    return jsonResponse({ ok: false, reason: 'pedido_sem_id' }, 400)
  }

  const sessionKey = `shopify-${order.id}`
  const valor = Number(order.total_price)
  const utms = extractUtms(order.landing_site)

  const rpcHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }

  const visitRes = await fetch(`${supabaseUrl}/rest/v1/rpc/track_utm_visit`, {
    method: 'POST',
    headers: rpcHeaders,
    body: JSON.stringify({
      p_session_key: sessionKey,
      p_source: utms.source,
      p_medium: utms.medium,
      p_campaign: utms.campaign,
      p_content: utms.content,
      p_term: utms.term,
      p_landing_url: order.landing_site?.slice(0, 500) ?? null,
      p_referrer: null,
    }),
  })
  if (!visitRes.ok) {
    console.error('[shopify-order-webhook] Falha ao registrar sessão.')
    return jsonResponse({ error: 'falha_sessao' }, 502)
  }

  const convRes = await fetch(
    `${supabaseUrl}/rest/v1/rpc/track_utm_conversion`,
    {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({
        p_session_key: sessionKey,
        p_tipo: 'purchase',
        p_valor: Number.isFinite(valor) ? valor : 0,
        p_pedido_ref: sessionKey,
      }),
    }
  )
  if (!convRes.ok) {
    console.error('[shopify-order-webhook] Falha ao registrar conversão.')
    return jsonResponse({ error: 'falha_conversao' }, 502)
  }

  return jsonResponse({ ok: true })
})
