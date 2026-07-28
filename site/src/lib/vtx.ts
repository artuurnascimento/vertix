/**
 * Rastreador UTM first-party da Vertix (mesma lógica do snippet vtx do
 * vertix-admin, em TypeScript). Identidade por browser em localStorage,
 * sid rotacionado quando chega clique novo com UTM (atribuição last-click),
 * visita enviada 1× por sid. Falha sempre silenciosa — tracking nunca
 * quebra o site.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const SID_KEY = 'vtx_sid'
const SENT_KEY = 'vtx_sent'

function post(fn: string, body: Record<string, unknown>): void {
  if (!SUPABASE_URL || !ANON_KEY) return
  try {
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Tracking jamais derruba o site.
  }
}

function novoSid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function lerStorage(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

function gravarStorage(chave: string, valor: string): void {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // Storage indisponível (modo privado) — segue sem persistir.
  }
}

function sidAtual(): string {
  return lerStorage(SID_KEY) ?? novoSid()
}

/** Registra a visita da sessão atual. Chamar 1× no boot do site. */
export function initVtx(): void {
  const query = new URLSearchParams(window.location.search)
  const temUtm = query.get('utm_source') || query.get('utm_campaign')

  let sid = lerStorage(SID_KEY)
  if (!sid || temUtm) {
    sid = novoSid()
    gravarStorage(SID_KEY, sid)
  }

  if (lerStorage(SENT_KEY) === sid) return
  gravarStorage(SENT_KEY, sid)

  post('track_utm_visit', {
    p_session_key: sid,
    p_source: query.get('utm_source'),
    p_medium: query.get('utm_medium'),
    p_campaign: query.get('utm_campaign'),
    p_content: query.get('utm_content'),
    p_term: query.get('utm_term'),
    p_landing_url: window.location.href.slice(0, 500),
    p_referrer: document.referrer.slice(0, 500),
  })
}

export interface VtxConversion {
  tipo?: 'lead' | 'purchase'
  valor?: number
  ref?: string
}

/** Registra conversão atribuída à sessão atual (ex.: lead do formulário). */
export function trackConversion(conversao: VtxConversion = {}): void {
  post('track_utm_conversion', {
    p_session_key: sidAtual(),
    p_tipo: conversao.tipo ?? 'lead',
    p_valor: conversao.valor ?? 0,
    p_pedido_ref: conversao.ref ?? null,
  })
}
