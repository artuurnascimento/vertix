import { describe, expect, test } from 'vitest'
import { geoDosCabecalhos } from './geoVercel'

/** Testes da leitura dos cabeçalhos de geolocalização da Vercel. Vitest. */

describe('geoDosCabecalhos', () => {
  test('decodifica a cidade, normaliza o país e converte as coordenadas', () => {
    const cabecalhos: Record<string, string> = {
      'x-vercel-ip-city': 'S%C3%A3o%20Paulo',
      'x-vercel-ip-country-region': 'SP',
      'x-vercel-ip-country': 'br',
      'x-vercel-ip-latitude': '-23.5505',
      'x-vercel-ip-longitude': '-46.6333',
    }
    expect(geoDosCabecalhos((n) => cabecalhos[n])).toEqual({
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'BR',
      latitude: -23.5505,
      longitude: -46.6333,
    })
  })

  test('sem cabeçalhos (preview local) tudo é null', () => {
    expect(geoDosCabecalhos(() => null)).toEqual({
      cidade: null,
      estado: null,
      pais: null,
      latitude: null,
      longitude: null,
    })
  })

  test('valores quebrados não derrubam a função', () => {
    const cabecalhos: Record<string, string> = {
      'x-vercel-ip-city': '%E0%A4%A',
      'x-vercel-ip-latitude': 'abc',
      'x-vercel-ip-country': '   ',
    }
    const geo = geoDosCabecalhos((n) => cabecalhos[n])
    expect(geo.cidade).toBe('%E0%A4%A')
    expect(geo.latitude).toBeNull()
    expect(geo.pais).toBeNull()
  })
})
