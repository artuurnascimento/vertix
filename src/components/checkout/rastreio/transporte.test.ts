import { describe, expect, test, vi } from 'vitest'
import { criarRastreador, rastreadorMudo } from './transporte'

/** Testes do envio à RPC checkout_rastrear (transporte.ts). Vitest. */

const SESSAO = '3f2b6c8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'

function fetchFalso() {
  const chamadas: Array<{ url: string; init: RequestInit }> = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} })
    return new Response(null, { status: 204 })
  })
  return { fn: fn as unknown as typeof fetch, chamadas }
}

const esperarFila = () => new Promise((r) => setTimeout(r, 0))

describe('criarRastreador', () => {
  test('manda cada passo para a RPC com a anon key, em keepalive', async () => {
    const { fn, chamadas } = fetchFalso()
    const r = criarRastreador({
      slug: 'plano',
      sessaoId: SESSAO,
      url: 'https://x.supabase.co/',
      chave: 'anon-123',
      fetchFn: fn,
    })
    r.rastrear('olhou', { secao: 'dados' })
    await esperarFila()

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toBe('https://x.supabase.co/rest/v1/rpc/checkout_rastrear')
    const init = chamadas[0].init
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(init.headers).toMatchObject({
      apikey: 'anon-123',
      Authorization: 'Bearer anon-123',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      p_sessao: SESSAO,
      p_slug: 'plano',
      p_tipo: 'olhou',
      p_dados: { secao: 'dados' },
    })
  })

  test('os passos saem na ordem em que aconteceram, mesmo com rede lenta', async () => {
    const ordem: string[] = []
    const fn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const tipo = JSON.parse(String(init?.body)).p_tipo as string
      // O primeiro demora mais: sem fila, o segundo chegaria antes.
      await new Promise((r) => setTimeout(r, tipo === 'entrou' ? 20 : 1))
      ordem.push(tipo)
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    const r = criarRastreador({ slug: 'p', sessaoId: SESSAO, url: 'https://x', chave: 'k', fetchFn: fn })
    r.rastrear('entrou')
    r.rastrear('olhou')
    await new Promise((res) => setTimeout(res, 60))
    expect(ordem).toEqual(['entrou', 'olhou'])
  })

  test('falha de rede não lança nem trava a fila', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new Response(null, { status: 204 })) as unknown as typeof fetch
    const r = criarRastreador({ slug: 'p', sessaoId: SESSAO, url: 'https://x', chave: 'k', fetchFn: fn })
    expect(() => r.rastrear('entrou')).not.toThrow()
    r.rastrear('olhou')
    await new Promise((res) => setTimeout(res, 5))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('encerrar manda o "saiu" na hora, sem esperar a fila', async () => {
    const { fn, chamadas } = fetchFalso()
    const r = criarRastreador({ slug: 'p', sessaoId: SESSAO, url: 'https://x', chave: 'k', fetchFn: fn })
    r.encerrar()
    // Sem await: a chamada tem de ter saído de forma síncrona.
    expect(chamadas).toHaveLength(1)
    expect(JSON.parse(String(chamadas[0].init.body)).p_tipo).toBe('saiu')
  })

  test('passo idêntico ao anterior dentro de 2 s é descartado; pulso nunca', async () => {
    const { fn, chamadas } = fetchFalso()
    let relogio = 1_000
    const r = criarRastreador({ slug: 'p', sessaoId: SESSAO, url: 'https://x', chave: 'k', fetchFn: fn, agora: () => relogio })
    r.rastrear('metodo', { metodo: 'pix' })
    relogio += 500
    r.rastrear('metodo', { metodo: 'pix' }) // repetição
    r.rastrear('pulso', { visivel: true })
    r.rastrear('pulso', { visivel: true })
    relogio += 3_000
    r.rastrear('metodo', { metodo: 'pix' }) // já passou a janela
    await new Promise((res) => setTimeout(res, 5))
    expect(chamadas.map((c) => JSON.parse(String(c.init.body)).p_tipo)).toEqual([
      'metodo',
      'pulso',
      'pulso',
      'metodo',
    ])
  })

  test('rastreador mudo não faz nada', () => {
    const r = rastreadorMudo()
    expect(r.sessaoId).toBe('')
    expect(() => {
      r.rastrear('entrou')
      r.encerrar()
    }).not.toThrow()
  })
})
