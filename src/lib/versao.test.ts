import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { assuntoLegivel, buscarVersaoPublicada, itensDesde, useVersaoNova } from './versao'

const historico = [
  { versao: 'c3', data: '2026-09-13T12:00:00Z', assunto: 'feat: cronômetro no topo' },
  { versao: 'c2', data: '2026-09-13T11:00:00Z', assunto: 'chore: bump de dependências' },
  { versao: 'c1', data: '2026-09-13T10:00:00Z', assunto: 'fix: imagens otimizadas' },
  { versao: 'b1', data: '2026-09-12T10:00:00Z', assunto: 'feat: cards do painel' },
]
const publicada = { versao: 'c3', data: '2026-09-13T12:00:00Z', historico }

function servidor(corpo: unknown, ok = true) {
  const fn = vi.fn(async () => ({ ok, json: async () => corpo }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assuntoLegivel', () => {
  test('tira o prefixo de commit e esconde o que é cozinha', () => {
    expect(assuntoLegivel('feat: cards do painel')).toBe('Cards do painel')
    expect(assuntoLegivel('fix(checkout)!: cupom')).toBe('Cupom')
    expect(assuntoLegivel('chore: bump')).toBeNull()
    expect(assuntoLegivel('test: cobre o hook')).toBeNull()
    expect(assuntoLegivel('Mensagem sem prefixo')).toBe('Mensagem sem prefixo')
  })
})

describe('itensDesde', () => {
  test('lista só o que entrou depois da versão da aba — nunca o que ela já tem', () => {
    expect(itensDesde(historico, 'c1')).toEqual(['Cronômetro no topo'])
    expect(itensDesde(historico, 'b1')).toEqual(['Cronômetro no topo', 'Imagens otimizadas'])
    expect(itensDesde(historico, 'c3')).toEqual([])
  })

  test('versão que não está no histórico vê tudo; lista longa vira "…e mais N"', () => {
    expect(itensDesde(historico, 'zzz')).toHaveLength(3)
    const longo = Array.from({ length: 20 }, (_, i) => ({ versao: `h${i}`, data: '', assunto: `feat: item ${i}` }))
    const itens = itensDesde(longo, 'nao-esta')
    expect(itens).toHaveLength(13)
    expect(itens.at(-1)).toBe('…e mais 8')
  })
})

describe('buscarVersaoPublicada', () => {
  test('lê o versao.json sem cache', async () => {
    const fn = servidor(publicada)
    const v = await buscarVersaoPublicada()
    expect(fn).toHaveBeenCalledWith('/versao.json', { cache: 'no-store' })
    expect(v?.versao).toBe('c3')
    expect(v?.historico).toHaveLength(4)
  })

  test('sem versão legível (404, offline, corpo estranho) devolve null', async () => {
    servidor(publicada, false)
    expect(await buscarVersaoPublicada()).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await buscarVersaoPublicada()).toBeNull()
    servidor({ nada: true })
    expect(await buscarVersaoPublicada()).toBeNull()
  })
})

describe('useVersaoNova', () => {
  test('avisa com o que mudou desde a versão desta aba', async () => {
    servidor(publicada)
    const { result } = renderHook(() => useVersaoNova('c1'))
    await waitFor(() => expect(result.current?.versao).toBe('c3'))
    expect(result.current?.itens).toEqual(['Cronômetro no topo'])
  })

  test('mesmo hash = nada a avisar; e em dev nem confere', async () => {
    const fn = servidor(publicada)
    const { result } = renderHook(() => useVersaoNova('c3'))
    await waitFor(() => expect(fn).toHaveBeenCalled())
    expect(result.current).toBeNull()

    fn.mockClear()
    renderHook(() => useVersaoNova('dev'))
    await act(async () => {})
    expect(fn).not.toHaveBeenCalled()
  })

  test('confere de novo quando a aba volta ao foco', async () => {
    const fn = servidor({ ...publicada, versao: 'c1', historico: historico.slice(2) })
    const { result } = renderHook(() => useVersaoNova('c1'))
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1))

    fn.mockImplementation(async () => ({ ok: true, json: async () => publicada }))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(result.current?.versao).toBe('c3'))
  })
})
