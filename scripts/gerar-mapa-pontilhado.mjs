#!/usr/bin/env node
// =============================================================================
// Gera public/ao-vivo/mapa.svg — o mapa-múndi pontilhado do "Ao vivo".
//
// Mesmo pacote e mesmos parâmetros do componente de referência (dotted-map,
// altura 100, grade diagonal, círculos), mas gerado UMA vez aqui em vez de a
// cada render: no navegador o dotted-map carrega 500 KB de GeoJSON e leva
// segundos testando ponto a ponto. O SVG commitado tem ~60 KB e é servido
// como imagem estática.
//
// Também confere que a projeção pura de src/components/aoVivo/mapa/projecao.ts
// (Web Mercator, refeita à mão) cai nos mesmos pontos que a biblioteca —
// é isso que garante que o marcador de Curitiba fica em cima de Curitiba.
//
//   node scripts/gerar-mapa-pontilhado.mjs
// =============================================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dottedMap from 'dotted-map'

// UMD: o default fica dentro do módulo CommonJS.
const DottedMap = dottedMap.default ?? dottedMap

const ALTURA = 100
const COR_DO_PONTO = 'rgba(110, 190, 228, 0.55)'

const mapa = new DottedMap({ height: ALTURA, grid: 'diagonal' })
const svg = mapa.getSVG({
  radius: 0.22,
  color: COR_DO_PONTO,
  shape: 'circle',
  backgroundColor: 'transparent',
})

// ---- confere a projeção pura contra a biblioteca ----------------------------
const RAIO_TERRA = 6378137
const REGIAO = { lat: { min: -56, max: 71 }, lng: { min: -179, max: 179 } }
const merc = (lng, lat) => ({
  x: (RAIO_TERRA * lng * Math.PI) / 180,
  y: RAIO_TERRA * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
})
const MIN = merc(REGIAO.lng.min, REGIAO.lat.min)
const MAX = merc(REGIAO.lng.max, REGIAO.lat.max)
const LARGURA = Math.round((ALTURA * (MAX.x - MIN.x)) / (MAX.y - MIN.y))
const projetar = (lat, lng) => {
  const p = merc(lng, lat)
  return {
    x: (LARGURA * (p.x - MIN.x)) / (MAX.x - MIN.x),
    y: (ALTURA * (MAX.y - p.y)) / (MAX.y - MIN.y),
  }
}

const amostras = [
  { nome: 'Curitiba', lat: -25.43, lng: -49.27 },
  { nome: 'Lisboa', lat: 38.72, lng: -9.14 },
  { nome: 'Tóquio', lat: 35.68, lng: 139.69 },
  { nome: 'Nova York', lat: 40.71, lng: -74.01 },
]
let maiorErro = 0
for (const a of amostras) {
  const pin = mapa.getPin({ lat: a.lat, lng: a.lng }) // já encaixado na grade
  const p = projetar(a.lat, a.lng)
  const erro = Math.hypot(pin.x - p.x, pin.y - p.y)
  maiorErro = Math.max(maiorErro, erro)
  console.log(
    `${a.nome.padEnd(10)} lib=(${pin.x.toFixed(2)}, ${pin.y.toFixed(2)}) pura=(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) Δ=${erro.toFixed(2)}`
  )
}
if (mapa.image.width !== LARGURA || maiorErro > 0.75) {
  console.error(
    `Projeção divergente: largura lib=${mapa.image.width} pura=${LARGURA}, erro máximo ${maiorErro.toFixed(2)} (o encaixe na grade vale até ~0,7)`
  )
  process.exit(1)
}

// ---- compacta: 8,5 mil <circle> (700 KB) viram UM <path> de pontos -------------
// Cada ponto é um segmento de comprimento zero ("M x y h0") desenhado com
// ponta redonda — o SVG manda renderizar isso como um círculo de diâmetro
// igual à espessura do traço. ~90 KB no disco, ~20 KB no ar (gzip).
const RAIO = 0.24
const pontos = mapa.getPoints().map((p) => `M${+p.x.toFixed(2)} ${+p.y.toFixed(2)}h0`)
const compacto =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapa.image.width} ${mapa.image.height}">` +
  `<path fill="none" stroke="${COR_DO_PONTO}" stroke-width="${RAIO * 2}" stroke-linecap="round" d="${pontos.join('')}"/>` +
  `</svg>\n`

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ao-vivo', 'mapa.svg')
mkdirSync(dirname(destino), { recursive: true })
writeFileSync(destino, compacto)
console.log(
  `mapa.svg: viewBox 0 0 ${mapa.image.width} ${mapa.image.height}, ${(compacto.length / 1024).toFixed(0)} KB (era ${(svg.length / 1024).toFixed(0)} KB em círculos), ${pontos.length} pontos`
)
