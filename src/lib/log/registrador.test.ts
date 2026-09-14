import { describe, expect, test, vi } from 'vitest'
import { criarRegistrador, fatiar, type EntradaDeLog } from './registrador'

/**
 * O registrador é a fila entre a página e a RPC. O que se protege aqui:
 * lote (não uma requisição por entrada), fatal na hora, repetição local
 * contada em vez de enviada, teto por página, keepalive na saída e o
 * fatiamento para caber no limite do keepalive.
 */

function montar(extra: Partial<Parameters<typeof criarRegistrador>[0]> = {}) {
  const fetchFn = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
  const tarefas: Array<() => void> = []
  let relogio = 1_000
  const r = criarRegistrador({
    url: 'https://x.supabase.co',
    chave: 'anon',
    tokenDeAcesso: () => null,
    contexto: () => ({ rota: '/c/x' }),
    sessaoId: () => 'c3cbeaf4-1111-4111-8111-111111111111',
    versao: 'abc123',
    ligado: true,
    fetchFn: fetchFn as unknown as typeof fetch,
    agora: () => relogio,
    agendar: (fn) => {
      tarefas.push(fn)
      return tarefas.length
    },
    cancelar: () => {},
    espelharNoConsole: false,
    ...extra,
  })
  const corpo = (n = 0) => JSON.parse((fetchFn.mock.calls[n] as unknown as [string, RequestInit])[1].body as string) as { p_entradas: EntradaDeLog[] }
  const opcoes = (n = 0) => (fetchFn.mock.calls[n] as unknown as [string, RequestInit])[1]
  return { r, fetchFn, tarefas, corpo, opcoes, avancar: (ms: number) => { relogio += ms } }
}

describe('criarRegistrador', () => {
  test('junta entradas e manda um lote só quando o temporizador dispara', () => {
    const { r, fetchFn, tarefas, corpo } = montar()
    r.registrar('erro', 'checkout', 'a', 'primeira')
    r.registrar('aviso', 'checkout', 'b', 'segunda')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(r.pendentes()).toBe(2)
    tarefas[0]()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('https://x.supabase.co/rest/v1/rpc/registrar_log')
    const { p_entradas } = corpo()
    expect(p_entradas.map((e) => e.evento)).toEqual(['a', 'b'])
    expect(p_entradas[0]).toMatchObject({ origem: 'navegador', fonte: 'checkout', versao: 'abc123', sessao_id: 'c3cbeaf4-1111-4111-8111-111111111111', contexto: { rota: '/c/x' } })
  })

  test('fatal sai na hora, sem esperar o temporizador', () => {
    const { r, fetchFn } = montar()
    r.registrar('fatal', 'render', 'quebrou', 'x')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('a mesma falha dentro de 5 s vai uma vez, com a contagem; depois da janela vai de novo', () => {
    const { r, tarefas, corpo, avancar } = montar()
    r.registrar('erro', 'f', 'e', 'Falha 1')
    r.registrar('erro', 'f', 'e', 'Falha 2') // mesma mensagem normalizada
    r.registrar('erro', 'f', 'e', 'Falha 3')
    tarefas[0]()
    expect(corpo().p_entradas).toHaveLength(1)
    avancar(6_000)
    r.registrar('erro', 'f', 'e', 'Falha 4')
    tarefas[1]()
    expect(corpo(1).p_entradas[0].detalhes).toEqual({ repeticoes_locais: 3 })
  })

  test('teto por página: depois do limite só sai o aviso de limite', () => {
    const { r, fetchFn, tarefas, corpo, avancar } = montar({ limitePorPagina: 2 })
    r.registrar('erro', 'f', 'e1', 'um'); avancar(6000)
    r.registrar('erro', 'f', 'e2', 'dois'); avancar(6000)
    r.registrar('erro', 'f', 'e3', 'três'); avancar(6000)
    r.registrar('erro', 'f', 'e4', 'quatro')
    tarefas.forEach((t) => t())
    const todas = fetchFn.mock.calls.flatMap((_, i) => corpo(i).p_entradas)
    expect(todas.map((e) => e.evento)).toEqual(['e1', 'e2', 'limite_por_pagina'])
  })

  test('descarregar(true) manda com keepalive e o token da pessoa logada', () => {
    const { r, fetchFn, opcoes } = montar({ tokenDeAcesso: () => 'jwt-da-pessoa' })
    r.registrar('erro', 'f', 'e', 'x')
    r.descarregar(true)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(opcoes().keepalive).toBe(true)
    expect((opcoes().headers as Record<string, string>).Authorization).toBe('Bearer jwt-da-pessoa')
  })

  test('desligado: nada sai, e nada quebra', () => {
    const { r, fetchFn, tarefas } = montar({ ligado: false })
    r.registrar('fatal', 'f', 'e', 'x')
    r.descarregar()
    expect(fetchFn).not.toHaveBeenCalled()
    expect(tarefas).toHaveLength(0)
  })

  test('fetch que rejeita ou lança não derruba quem registrou', async () => {
    const { r } = montar({ fetchFn: (() => { throw new Error('sem fetch') }) as unknown as typeof fetch })
    expect(() => { r.registrar('fatal', 'f', 'e', 'x') }).not.toThrow()
    const { r: r2 } = montar({ fetchFn: (() => Promise.reject(new Error('rede'))) as unknown as typeof fetch })
    expect(() => { r2.registrar('fatal', 'f', 'e', 'x') }).not.toThrow()
    await Promise.resolve()
  })
})

describe('fatiar', () => {
  const entrada = (n: number, tamanho = 10): EntradaDeLog => ({
    nivel: 'erro', origem: 'navegador', fonte: 'f', evento: `e${n}`, mensagem: 'x'.repeat(tamanho),
    detalhes: {}, contexto: { migalhas: [] }, requisicao_id: null, sessao_id: null, versao: null,
  })

  test('cabe tudo num lote quando é pequeno', () => {
    expect(fatiar([entrada(1), entrada(2)], 10_000)).toHaveLength(1)
  })

  test('quebra em lotes quando passa do limite de bytes', () => {
    const lotes = fatiar([entrada(1, 300), entrada(2, 300), entrada(3, 300)], 800)
    expect(lotes.length).toBeGreaterThan(1)
    expect(lotes.flat()).toHaveLength(3)
  })

  test('entrada maior que o limite sozinha perde os detalhes em vez de perder o lote', () => {
    const grande = { ...entrada(1), detalhes: { stack: 'y'.repeat(5_000) } }
    const [lote] = fatiar([grande], 1_000)
    expect(lote[0].detalhes).toMatchObject({ cortado: true })
    expect(JSON.stringify(lote).length).toBeLessThan(3_000)
  })

  test('no máximo 25 entradas por lote', () => {
    const lotes = fatiar(Array.from({ length: 30 }, (_, i) => entrada(i)), 1_000_000)
    expect(lotes.map((l) => l.length)).toEqual([25, 5])
  })
})
