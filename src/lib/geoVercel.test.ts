import { describe, expect, test } from 'vitest'
// @ts-expect-error — a função da Vercel é JS puro e sem tipos de propósito (ver api/geo.js).
import handler, { geoDosCabecalhos } from '../../api/geo.js'

/** Testes da função GET /api/geo (api/geo.js): leitura dos cabeçalhos da Vercel. Vitest. */

type Geo = {
  cidade: string | null
  estado: string | null
  pais: string | null
  latitude: number | null
  longitude: number | null
}
const ler = (cabecalhos: Record<string, string>) => (nome: string) => cabecalhos[nome]
const geo = (cabecalhos: Record<string, string>): Geo => geoDosCabecalhos(ler(cabecalhos))

describe('geoDosCabecalhos', () => {
  test('decodifica a cidade, normaliza o país e converte as coordenadas', () => {
    expect(
      geo({
        'x-vercel-ip-city': 'S%C3%A3o%20Paulo',
        'x-vercel-ip-country-region': 'SP',
        'x-vercel-ip-country': 'br',
        'x-vercel-ip-latitude': '-23.5505',
        'x-vercel-ip-longitude': '-46.6333',
      })
    ).toEqual({
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'BR',
      latitude: -23.5505,
      longitude: -46.6333,
    })
  })

  test('sem cabeçalhos (preview local) tudo é null', () => {
    expect(geo({})).toEqual({
      cidade: null,
      estado: null,
      pais: null,
      latitude: null,
      longitude: null,
    })
  })

  test('valores quebrados não derrubam a função', () => {
    const g = geo({
      'x-vercel-ip-city': '%E0%A4%A',
      'x-vercel-ip-latitude': 'abc',
      'x-vercel-ip-country': '   ',
    })
    expect(g.cidade).toBe('%E0%A4%A')
    expect(g.latitude).toBeNull()
    expect(g.pais).toBeNull()
  })
})

describe('handler (req, res)', () => {
  test('responde JSON privado e sem cache a partir de req.headers', () => {
    const cabecalhos: Record<string, string> = {}
    let status = 0
    let corpo: unknown = null
    const req = { headers: { 'x-vercel-ip-city': 'Recife', 'x-vercel-ip-country-region': 'PE', 'x-vercel-ip-country': 'BR' } }
    const res = {
      setHeader: (n: string, v: string) => {
        cabecalhos[n] = v
      },
      status: (c: number) => {
        status = c
        return { json: (b: unknown) => (corpo = b) }
      },
    }
    handler(req, res)
    expect(status).toBe(200)
    expect(cabecalhos['Cache-Control']).toBe('private, no-store')
    expect(corpo).toEqual({ cidade: 'Recife', estado: 'PE', pais: 'BR', latitude: null, longitude: null })
  })
})
