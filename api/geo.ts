import { geoDosCabecalhos } from '../src/lib/geoVercel'

/**
 * GET /api/geo — cidade, UF e país de quem chamou, pelos cabeçalhos de
 * geolocalização que a Vercel põe em toda requisição. Usado pelo rastreio
 * ao vivo do checkout (src/components/checkout/rastreio/useRastreio.ts).
 *
 * Fica FORA do catch-all do vercel.json porque funções em `api/` têm
 * prioridade sobre os rewrites. Não lê nem devolve o IP; a resposta é
 * privada e sem cache — cada visitante recebe a própria.
 */
export function GET(request: Request): Response {
  const geo = geoDosCabecalhos((nome) => request.headers.get(nome))
  return Response.json(geo, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
