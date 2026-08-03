/**
 * CORS compartilhado para as edge functions chamadas pelo navegador.
 *
 * Sem isso, o preflight OPTIONS que o browser dispara antes de todo POST
 * com header Authorization cai no guard `req.method !== 'POST'`, recebe 405
 * sem nenhum cabeçalho CORS, e o POST real nunca chega a sair. O sintoma na
 * tela é um erro genérico da aplicação, o que faz parecer problema de
 * credencial quando na verdade a requisição nem saiu do navegador.
 *
 * Sobre a origem permitida: o padrão é '*'. Isso é aceitável aqui porque a
 * sessão do usuário vive em localStorage — isolado por origem — e não em
 * cookie. Não existe credencial ambiente que outro site consiga fazer o
 * navegador anexar automaticamente, então liberar a origem não dá a
 * terceiros nenhum acesso que eles já não tivessem. Ainda assim, para
 * restringir, basta definir ALLOWED_ORIGINS com as origens separadas por
 * vírgula:
 *
 *   supabase secrets set ALLOWED_ORIGINS="https://admin.exemplo.com"
 */

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '')

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')

  // Sem allowlist configurada, libera geral (ver justificativa acima).
  // Com allowlist, devolve a origem pedida só se ela constar da lista;
  // caso contrário devolve a primeira, que o navegador vai rejeitar.
  const allowOrigin =
    ALLOWED_ORIGINS.length === 0
      ? '*'
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0]

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  // Só faz sentido variar por origem quando a resposta realmente depende dela.
  if (ALLOWED_ORIGINS.length > 0) {
    headers.Vary = 'Origin'
  }

  return headers
}

/**
 * Envolve o handler existente: responde ao preflight e injeta os cabeçalhos
 * CORS em toda resposta, inclusive nas de erro — um 401 sem CORS chega ao
 * navegador como "CORS error" e esconde o motivo real da falha.
 */
export function withCors(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) })
    }

    const response = await handler(req)
    const headers = new Headers(response.headers)
    for (const [key, value] of Object.entries(corsHeaders(req))) {
      headers.set(key, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
