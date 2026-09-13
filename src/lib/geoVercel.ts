/**
 * Onde a pessoa está, segundo a Vercel.
 *
 * Toda requisição que chega a uma função da Vercel traz a geolocalização do
 * IP em cabeçalhos (`x-vercel-ip-city`, `-country`, `-country-region`,
 * `-latitude`, `-longitude`). É a única coisa que /api/geo faz: ler esses
 * cabeçalhos e devolver ao navegador, que os manda para a sessão do checkout.
 *
 * O IP em si nunca é lido nem gravado. A cidade vem percent-encoded
 * ("S%C3%A3o%20Paulo"); um valor malformado vira null, não erro.
 *
 * Puro e sem dependência de runtime: `api/geo.ts` só entrega o `Request`.
 */

export interface GeoDaVisita {
  cidade: string | null
  estado: string | null
  pais: string | null
  latitude: number | null
  longitude: number | null
}

type LerCabecalho = (nome: string) => string | null | undefined

function texto(valor: string | null | undefined, maximo: number): string | null {
  if (!valor) return null
  let limpo = valor
  try {
    limpo = decodeURIComponent(valor)
  } catch {
    // percent-encoding quebrado: fica o valor cru
  }
  limpo = limpo.trim()
  return limpo ? limpo.slice(0, maximo) : null
}

function numero(valor: string | null | undefined): number | null {
  if (!valor) return null
  const n = Number.parseFloat(valor)
  return Number.isFinite(n) ? n : null
}

export function geoDosCabecalhos(ler: LerCabecalho): GeoDaVisita {
  return {
    cidade: texto(ler('x-vercel-ip-city'), 80),
    estado: texto(ler('x-vercel-ip-country-region'), 40),
    pais: texto(ler('x-vercel-ip-country'), 4)?.toUpperCase() ?? null,
    latitude: numero(ler('x-vercel-ip-latitude')),
    longitude: numero(ler('x-vercel-ip-longitude')),
  }
}
