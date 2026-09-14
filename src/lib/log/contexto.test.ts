import { describe, expect, test } from 'vitest'
import { montarContexto, redigirUrl, sessaoDeRastreioAtual } from './contexto'

describe('redigirUrl', () => {
  test('oculta os parâmetros que identificam ou pré-preenchem', () => {
    expect(redigirUrl('/c/plano-correcao?a=123&t=abc-token&utm_source=ig')).toBe('/c/plano-correcao?a=123&t=%5Boculto%5D&utm_source=ig')
    expect(redigirUrl('/login?email=x%40y.com')).toBe('/login?email=%5Boculto%5D')
  })
  test('oculta o token de pagamento no caminho (pay.vertix.studio/<token>)', () => {
    expect(redigirUrl('/c3cbeaf4-1111-4111-8111-111111111111')).toBe('/[uuid]')
    expect(redigirUrl('/p/c3cbeaf4-1111-4111-8111-111111111111/x')).toBe('/p/[uuid]/x')
  })
  test('URL inválida não derruba: devolve o texto cortado', () => {
    expect(redigirUrl('http://[')).toBe('http://[')
  })
})

describe('sessaoDeRastreioAtual', () => {
  test('acha a sessão do checkout no sessionStorage e ignora lixo', () => {
    const itens: Record<string, string> = { 'vx-nav': 'abc', 'vx-rastreio:plano': 'nao-e-uuid', 'vx-rastreio:outro': 'c3cbeaf4-1111-4111-8111-111111111111' }
    const chaves = Object.keys(itens)
    const armazem = { length: chaves.length, key: (i: number) => chaves[i] ?? null, getItem: (k: string) => itens[k] ?? null } as unknown as Storage
    expect(sessaoDeRastreioAtual(armazem)).toBe('c3cbeaf4-1111-4111-8111-111111111111')
    expect(sessaoDeRastreioAtual(null)).toBeNull()
  })
})

describe('montarContexto', () => {
  test('reúne rota (redigida), aparelho, aba, usuário e migalhas', () => {
    const contexto = montarContexto({
      janela: { location: { pathname: '/c/x', search: '?t=segredo', hostname: 'pay.vertix.studio' } as Location, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3 },
      navegador: { userAgent: 'UA', onLine: true, language: 'pt-BR', maxTouchPoints: 5 },
      documento: { referrer: 'https://scan.vertix.studio/r/abc?email=x', visibilityState: 'visible' },
      aba: 'aba1',
      usuarioId: 'u1',
      migalhas: () => [{ t: 1, tipo: 'clique', texto: 'button: Pagar' }],
      relogio: () => 12_400,
      memoriaMb: () => 80,
    })
    expect(contexto).toEqual({
      rota: '/c/x?t=%5Boculto%5D', host: 'pay.vertix.studio', nav: 'aba1', agente: 'UA', viewport: '390x844', pixel_ratio: 3,
      toque: true, online: true, idioma: 'pt-BR', visivel: true, tempo_na_pagina_s: 12,
      migalhas: [{ t: 1, tipo: 'clique', texto: 'button: Pagar' }],
      referrer: '/r/abc?email=%5Boculto%5D', usuario: 'u1', memoria_mb: 80,
    })
  })
})
