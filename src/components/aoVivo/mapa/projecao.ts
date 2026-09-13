/**
 * A projeção do mapa pontilhado — a MESMA que o `dotted-map` usa para
 * espalhar os pontos (Web Mercator, região lat −56..71 / lng −179..179,
 * altura 100), refeita aqui em matemática pura para que os marcadores do
 * painel caiam exatamente em cima dos pontos do SVG gerado em build
 * (scripts/gerar-mapa-pontilhado.mjs confere as duas contra a biblioteca).
 *
 * O componente de referência projetava com equirretangular sobre um mapa
 * Mercator: no Brasil o erro passava de 200 km. Aqui não.
 */

export const REGIAO_DO_MAPA = {
  lat: { min: -56, max: 71 },
  lng: { min: -179, max: 179 },
} as const

export const ALTURA_MAPA = 100

const RAIO_TERRA = 6378137

/** Web Mercator (EPSG:3857), em metros. */
export function mercator(lng: number, lat: number): { x: number; y: number } {
  const rad = Math.PI / 180
  return {
    x: RAIO_TERRA * lng * rad,
    y: RAIO_TERRA * Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2)),
  }
}

const MIN = mercator(REGIAO_DO_MAPA.lng.min, REGIAO_DO_MAPA.lat.min)
const MAX = mercator(REGIAO_DO_MAPA.lng.max, REGIAO_DO_MAPA.lat.max)
const X_RANGE = MAX.x - MIN.x
const Y_RANGE = MAX.y - MIN.y

/** Largura do viewBox, como o dotted-map calcula a partir da altura. */
export const LARGURA_MAPA = Math.round((ALTURA_MAPA * X_RANGE) / Y_RANGE)

export interface PontoNoMapa {
  x: number
  y: number
  /** Dentro da região desenhada (fora dela o mapa não existe). */
  dentro: boolean
}

export function projetarNoMapa(lat: number, lng: number): PontoNoMapa {
  const p = mercator(lng, lat)
  const x = (LARGURA_MAPA * (p.x - MIN.x)) / X_RANGE
  const y = (ALTURA_MAPA * (MAX.y - p.y)) / Y_RANGE
  const dentro =
    lat >= REGIAO_DO_MAPA.lat.min &&
    lat <= REGIAO_DO_MAPA.lat.max &&
    lng >= REGIAO_DO_MAPA.lng.min &&
    lng <= REGIAO_DO_MAPA.lng.max
  return { x, y, dentro }
}

/** Arco quadrático entre dois pontos, arqueado para cima (como no modelo). */
export function caminhoDoArco(
  de: { x: number; y: number },
  ate: { x: number; y: number }
): string {
  const meioX = (de.x + ate.x) / 2
  const distancia = Math.hypot(ate.x - de.x, ate.y - de.y)
  const meioY = Math.min(de.y, ate.y) - Math.max(4, distancia * 0.35)
  const f = (n: number) => Number(n.toFixed(2))
  return `M ${f(de.x)} ${f(de.y)} Q ${f(meioX)} ${f(meioY)} ${f(ate.x)} ${f(ate.y)}`
}
