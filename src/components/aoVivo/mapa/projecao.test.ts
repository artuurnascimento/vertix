import { describe, expect, test } from 'vitest'
import {
  ALTURA_MAPA,
  LARGURA_MAPA,
  caminhoDoArco,
  mercator,
  projetarNoMapa,
} from './projecao'

/**
 * Testes da projeção do mapa (projecao.ts). Os valores de referência vêm
 * do próprio dotted-map (scripts/gerar-mapa-pontilhado.mjs imprime o pino
 * da biblioteca ao lado do nosso): Curitiba (76.0, 75.3), Lisboa (100.0,
 * 35.5), Tóquio (186.5, 38.1), Nova York (62.0, 33.8) — encaixados na grade.
 */

describe('projetarNoMapa', () => {
  test('o viewBox tem a largura que o dotted-map calcula para altura 100', () => {
    expect(ALTURA_MAPA).toBe(100)
    expect(LARGURA_MAPA).toBe(210)
  })

  test('cai em cima dos pontos da biblioteca (tolerância do encaixe na grade)', () => {
    const perto = (lat: number, lng: number, x: number, y: number) => {
      const p = projetarNoMapa(lat, lng)
      expect(Math.hypot(p.x - x, p.y - y)).toBeLessThan(0.75)
      expect(p.dentro).toBe(true)
    }
    perto(-25.43, -49.27, 76.0, 75.34) // Curitiba
    perto(38.72, -9.14, 100.0, 35.51) // Lisboa
    perto(35.68, 139.69, 186.5, 38.11) // Tóquio
    perto(40.71, -74.01, 62.0, 33.77) // Nova York
  })

  test('fora da região desenhada (Svalbard ao norte, Antártida ao sul) não entra', () => {
    expect(projetarNoMapa(64.1, -21.9).dentro).toBe(true) // Reykjavík ainda cabe
    expect(projetarNoMapa(78.2, 15.6).dentro).toBe(false) // Svalbard não
    expect(projetarNoMapa(-64.8, -62.9).dentro).toBe(false)
  })

  test('Mercator: equador em y = 0, longitude linear', () => {
    expect(mercator(0, 0).x).toBe(0)
    expect(mercator(0, 0).y).toBeCloseTo(0, 6)
    expect(mercator(90, 0).x).toBeCloseTo(mercator(180, 0).x / 2, 6)
    expect(mercator(0, 60).y).toBeGreaterThan(mercator(0, 30).y * 2)
  })
})

describe('caminhoDoArco', () => {
  test('curva quadrática arqueada para cima entre os dois pontos', () => {
    const d = caminhoDoArco({ x: 10, y: 50 }, { x: 110, y: 70 })
    expect(d).toMatch(/^M 10 50 Q 60 (-?[\d.]+) 110 70$/)
    const meioY = Number(/Q 60 (-?[\d.]+)/.exec(d)?.[1])
    expect(meioY).toBeLessThan(50)
  })

  test('arcos curtos ainda sobem um mínimo, para não virarem reta', () => {
    const d = caminhoDoArco({ x: 10, y: 50 }, { x: 12, y: 50 })
    expect(Number(/Q 11 (-?[\d.]+)/.exec(d)?.[1])).toBe(46)
  })
})
