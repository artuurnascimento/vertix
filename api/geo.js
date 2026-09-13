/**
 * GET /api/geo — cidade, UF e país de quem chamou, pelos cabeçalhos de
 * geolocalização que a Vercel põe em toda requisição (`x-vercel-ip-city`,
 * `-country`, `-country-region`, `-latitude`, `-longitude`). Usado pelo
 * rastreio ao vivo do checkout (src/components/checkout/rastreio/useRastreio.ts).
 *
 * Fica FORA do catch-all do vercel.json porque funções em `api/` têm
 * prioridade sobre os rewrites. Não lê nem devolve o IP; a resposta é
 * privada e sem cache — cada visitante recebe a própria.
 *
 * JavaScript puro e sem imports de propósito: a função roda no Node da
 * Vercel como ESM (package.json tem "type": "module"), e um import relativo
 * de TypeScript sem extensão não resolve lá — foi o que derrubou a primeira
 * versão com FUNCTION_INVOCATION_FAILED. Testada em src/lib/geoVercel.test.ts.
 */

/**
 * @param {string | string[] | undefined} valor
 * @param {number} maximo
 * @returns {string | null}
 */
function texto(valor, maximo) {
  const cru = Array.isArray(valor) ? valor[0] : valor
  if (!cru) return null
  let limpo = cru
  try {
    limpo = decodeURIComponent(cru)
  } catch {
    // percent-encoding quebrado: fica o valor cru
  }
  limpo = limpo.trim()
  return limpo ? limpo.slice(0, maximo) : null
}

/**
 * @param {string | string[] | undefined} valor
 * @returns {number | null}
 */
function numero(valor) {
  const cru = Array.isArray(valor) ? valor[0] : valor
  if (!cru) return null
  const n = Number.parseFloat(cru)
  return Number.isFinite(n) ? n : null
}

/**
 * Lê os cabeçalhos da Vercel. `ler` recebe o nome em minúsculas.
 * @param {(nome: string) => string | string[] | null | undefined} ler
 */
export function geoDosCabecalhos(ler) {
  const pais = texto(ler('x-vercel-ip-country'), 4)
  return {
    cidade: texto(ler('x-vercel-ip-city'), 80),
    estado: texto(ler('x-vercel-ip-country-region'), 40),
    pais: pais ? pais.toUpperCase() : null,
    latitude: numero(ler('x-vercel-ip-latitude')),
    longitude: numero(ler('x-vercel-ip-longitude')),
  }
}

/**
 * Assinatura clássica da Vercel (req, res) do Node.
 * @param {{ headers: Record<string, string | string[] | undefined> }} req
 * @param {{ setHeader: (n: string, v: string) => unknown, status: (c: number) => { json: (b: unknown) => unknown } }} res
 */
export default function handler(req, res) {
  const geo = geoDosCabecalhos((nome) => req.headers[nome])
  res.setHeader('Cache-Control', 'private, no-store')
  res.status(200).json(geo)
}
