/**
 * apps-proxy
 *
 * Proxy autenticado entre o painel e as APIs de serviço dos apps próprios
 * ("Vertix Recover", "Vertix Reviews" e "Vertix Scan"). O navegador NUNCA
 * conhece os tokens de serviço — eles vivem apenas nos secrets desta function
 * (RECOVER_API_URL/RECOVER_SERVICE_TOKEN, REVIEWS_API_URL/REVIEWS_SERVICE_TOKEN,
 * SCAN_API_URL/SCAN_SERVICE_TOKEN).
 *
 * Request: POST JSON { app: 'recover'|'reviews'|'scan',
 *                      method: 'GET'|'PATCH'|'POST',
 *                      path: string, body?: unknown }.
 * Exige JWT de usuário autenticado que seja membro do time (checado em
 * public.profiles com service role — mesmo mecanismo do sync-ad-metrics).
 *
 * Whitelist estrita de paths POR APP (qualquer outro → 400):
 *
 * recover/reviews (apps por loja):
 *   GET   /api/vertix/health
 *   GET   /api/vertix/shops
 *   GET   /api/vertix/shops/<shop>/stats        (query from/to permitida)
 *   GET   /api/vertix/shops/<shop>/settings
 *   PATCH /api/vertix/shops/<shop>/settings
 *   POST  /api/vertix/provision
 *
 * scan (captação de leads — sem conceito de loja provisionada):
 *   GET   /api/vertix/health
 *   GET   /api/vertix/stats
 *   GET   /api/vertix/leads                     (query limit/offset permitida)
 *
 * App sem URL/token configurado → 503 com mensagem clara. A resposta do
 * backend (status + JSON) é devolvida como veio — o front decide como
 * exibir. NUNCA loga o valor dos tokens de serviço nem do JWT recebido.
 */

import { withCors } from '../_shared/cors.ts'

type AppProduto = 'recover' | 'reviews' | 'scan'
type ProxyMethod = 'GET' | 'PATCH' | 'POST'

interface RequestBody {
  app?: string
  method?: string
  path?: string
  body?: unknown
}

interface AppConfig {
  label: string
  urlEnv: string
  tokenEnv: string
}

const APPS: Record<AppProduto, AppConfig> = {
  recover: {
    label: 'Recover',
    urlEnv: 'RECOVER_API_URL',
    tokenEnv: 'RECOVER_SERVICE_TOKEN',
  },
  reviews: {
    label: 'Reviews',
    urlEnv: 'REVIEWS_API_URL',
    tokenEnv: 'REVIEWS_SERVICE_TOKEN',
  },
  scan: {
    label: 'Scan',
    urlEnv: 'SCAN_API_URL',
    tokenEnv: 'SCAN_SERVICE_TOKEN',
  },
}

/** Timeout do backend do app — evita segurar a function em backend travado. */
const UPSTREAM_TIMEOUT_MS = 15_000

// Domínio de loja: rótulos a-z/0-9/hífen separados por ponto — sem barra,
// sem "..", sem caracteres de escape. Bloqueia path traversal no template.
const SHOP_RE = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/

// Query string: só chaves/valores simples (from/to ISO com : e %3A etc.).
const QUERY_RE = /^\?[A-Za-z0-9=&_.:%+-]*$/

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface AllowedRoute {
  methods: ProxyMethod[]
  allowQuery: boolean
}

/**
 * Resolve o path pedido contra a whitelist DO APP. Devolve a rota permitida
 * ou null (path fora da lista do app, shop inválido ou query onde não é
 * permitida). A whitelist é por app: rotas do Scan não chegam ao Recover/
 * Reviews e vice-versa.
 */
function matchRoute(
  app: AppProduto,
  pathname: string,
  search: string
): AllowedRoute | null {
  if (search !== '' && !QUERY_RE.test(search)) return null

  // Health é o único path comum a todos os backends.
  if (pathname === '/api/vertix/health') {
    return search === '' ? { methods: ['GET'], allowQuery: false } : null
  }

  // Scan (captação de leads): só stats + leads, ambos GET.
  if (app === 'scan') {
    if (pathname === '/api/vertix/stats') {
      return search === '' ? { methods: ['GET'], allowQuery: false } : null
    }
    if (pathname === '/api/vertix/leads') {
      return { methods: ['GET'], allowQuery: true }
    }
    return null
  }

  if (pathname === '/api/vertix/shops') {
    return search === '' ? { methods: ['GET'], allowQuery: false } : null
  }

  if (pathname === '/api/vertix/provision') {
    return search === '' ? { methods: ['POST'], allowQuery: false } : null
  }

  const shopMatch = pathname.match(
    /^\/api\/vertix\/shops\/([^/]+)\/(stats|settings)$/
  )
  if (shopMatch) {
    const [, shop, recurso] = shopMatch
    if (!SHOP_RE.test(shop)) return null
    if (recurso === 'stats') {
      return { methods: ['GET'], allowQuery: true }
    }
    return search === ''
      ? { methods: ['GET', 'PATCH'], allowQuery: false }
      : null
  }

  return null
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
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[apps-proxy] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }

  // Valida o JWT e resolve o usuário autenticado (rejeita anon).
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
    console.error('[apps-proxy] Falha ao checar profile:', profileRes.status)
    return jsonResponse({ error: 'Falha ao validar permissão.' }, 502)
  }
  const profiles = (await profileRes.json()) as Array<{ id: string }>
  if (profiles.length === 0) {
    return jsonResponse({ error: 'Acesso negado.' }, 403)
  }

  // -- Validação do payload do proxy ----------------------------------------

  const app = body.app as AppProduto
  if (app !== 'recover' && app !== 'reviews' && app !== 'scan') {
    return jsonResponse(
      { error: "app inválido — use 'recover', 'reviews' ou 'scan'." },
      400
    )
  }

  const method = body.method as ProxyMethod
  if (method !== 'GET' && method !== 'PATCH' && method !== 'POST') {
    return jsonResponse({ error: 'method inválido — use GET, PATCH ou POST.' }, 400)
  }

  if (typeof body.path !== 'string' || body.path === '') {
    return jsonResponse({ error: 'path ausente.' }, 400)
  }

  // Separa pathname/query sem depender de URL absoluta.
  const queryIndex = body.path.indexOf('?')
  const pathname = queryIndex === -1 ? body.path : body.path.slice(0, queryIndex)
  const search = queryIndex === -1 ? '' : body.path.slice(queryIndex)

  const route = matchRoute(app, pathname, search)
  if (!route || !route.methods.includes(method)) {
    return jsonResponse({ error: 'Path não permitido.' }, 400)
  }

  // -- Config do app (secrets) ----------------------------------------------

  const config = APPS[app]
  const baseUrl = Deno.env.get(config.urlEnv)
  const serviceToken = Deno.env.get(config.tokenEnv)
  if (!baseUrl || !serviceToken) {
    return jsonResponse(
      {
        error: `${config.label} ainda não configurado — defina ${config.urlEnv} e ${config.tokenEnv} nos secrets.`,
      },
      503
    )
  }

  // -- Encaminha ao backend do app ------------------------------------------

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}${pathname}${search}`
  const hasBody = method !== 'GET' && body.body !== undefined

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(targetUrl, {
      method,
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body.body) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'falha desconhecida'
    console.error(`[apps-proxy] Backend ${app} inacessível:`, msg)
    return jsonResponse(
      { error: `Backend do ${config.label} não respondeu.` },
      502
    )
  }

  let upstreamJson: unknown
  try {
    upstreamJson = await upstreamRes.json()
  } catch {
    console.error(
      `[apps-proxy] Resposta não-JSON do backend ${app}:`,
      upstreamRes.status
    )
    return jsonResponse(
      { error: `Resposta inválida do backend do ${config.label}.` },
      502
    )
  }

  // Devolve status + JSON do backend como vieram.
  return new Response(JSON.stringify(upstreamJson), {
    status: upstreamRes.status,
    headers: { 'Content-Type': 'application/json' },
  })
}))
