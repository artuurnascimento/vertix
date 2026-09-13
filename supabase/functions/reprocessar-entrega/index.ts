/**
 * reprocessar-entrega — o botão "Reprocessar" do painel Automações.
 *
 * Quem pagou e não recebeu (view entregas_pendentes) já é retentado pela
 * varredura do worker a cada minuto; este endpoint existe para a equipe não
 * esperar: valida que quem chama é da equipe e repete, na hora, o mesmo
 * aviso que o webhook de pagamento faz — POST /api/vertix/pedido-pago ou
 * /api/vertix/compra-paga. As duas rotas são idempotentes: devolvem
 * `ja_entregue` ou `em_andamento` sem mandar um segundo e-mail.
 *
 * O navegador não pode falar com o worker direto porque o VERTIX_SERVICE_TOKEN
 * mora aqui, não no cliente.
 */
import { withCors } from '../_shared/cors.ts'

interface RequestBody {
  tipo?: unknown
  id?: unknown
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WORKER_TIMEOUT_MS = 10_000

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
  const tipo = body.tipo === 'pedido' || body.tipo === 'compra' ? body.tipo : null
  const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!tipo || !id) {
    return jsonResponse({ error: 'Informe tipo (pedido|compra) e id.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const workerUrl = Deno.env.get('SCAN_WORKER_URL')
  const vertixToken = Deno.env.get('VERTIX_SERVICE_TOKEN')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[reprocessar-entrega] Env do Supabase ausente.')
    return jsonResponse({ error: 'env_supabase_ausente' }, 500)
  }
  if (!workerUrl || !vertixToken) {
    console.error('[reprocessar-entrega] SCAN_WORKER_URL / VERTIX_SERVICE_TOKEN ausentes.')
    return jsonResponse({ error: 'worker_nao_configurado' }, 500)
  }

  // Quem chama precisa ser da equipe (qualquer papel): valida o JWT e o perfil.
  const callerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${jwt}` },
  })
  if (!callerRes.ok) return jsonResponse({ error: 'Não autenticado.' }, 401)
  const caller = (await callerRes.json()) as { id?: string }
  if (!caller.id) return jsonResponse({ error: 'Não autenticado.' }, 401)

  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${caller.id}&select=id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  if (!profileRes.ok) {
    console.error('[reprocessar-entrega] Falha ao checar profile:', profileRes.status)
    return jsonResponse({ error: 'Falha ao validar permissão.' }, 502)
  }
  const perfis = (await profileRes.json()) as Array<{ id: string }>
  if (perfis.length === 0) return jsonResponse({ error: 'Acesso negado.' }, 403)

  const rota = tipo === 'pedido' ? 'pedido-pago' : 'compra-paga'
  const corpo = tipo === 'pedido' ? { pedido_id: id } : { compra_id: id }
  try {
    const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/api/vertix/${rota}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vertixToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    })
    const resposta = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      estado?: string
      error?: { code?: string; message?: string }
    }
    if (!res.ok) {
      console.warn(`[reprocessar-entrega] Worker recusou ${tipo} ${id}: ${res.status}`, resposta.error?.code)
      return jsonResponse(
        { error: resposta.error?.message ?? `Worker respondeu ${res.status}.`, codigo: resposta.error?.code ?? null },
        res.status === 404 || res.status === 409 ? res.status : 502
      )
    }
    return jsonResponse({ ok: true, estado: resposta.estado ?? 'processando' })
  } catch (error) {
    console.error('[reprocessar-entrega] Worker inacessível:', error instanceof Error ? error.message : error)
    return jsonResponse({ error: 'O worker do Scan não respondeu. Tente de novo em instantes.' }, 504)
  }
}))
