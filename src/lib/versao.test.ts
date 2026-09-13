import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { buscarVersaoPublicada, useVersaoNova } from './versao'

const publicada = { versao: 'b2c3d4', data: '2026-09-13T10:00:00Z', titulo: 'Novidades', itens: ['Cronômetro no topo', 'Imagens otimizadas'] }

function servidor(corpo: unknown, ok = true) {
  const fn = vi.fn(async () => ({ ok, json: async () => corpo }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('buscarVersaoPublicada', () => {
  test('lê o versao.json sem cache e tolera o que não for string', async () => {
    const fn = servidor({ ...publicada, itens: ['ok', 7, null] })
    const v = await buscarVersaoPublicada()
    expect(fn).toHaveBeenCalledWith('/versao.json', { cache: 'no-store' })
    expect(v).toEqual({ ...publicada, itens: ['ok'] })
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
  test('avisa quando o servidor tem hash diferente do desta aba', async () => {
    servidor(publicada)
    const { result } = renderHook(() => useVersaoNova('a1b2c3'))
    await waitFor(() => expect(result.current?.versao).toBe('b2c3d4'))
    expect(result.current?.itens).toHaveLength(2)
  })

  test('mesmo hash = nada a avisar; e em dev nem confere', async () => {
    const fn = servidor({ ...publicada, versao: 'a1b2c3' })
    const { result } = renderHook(() => useVersaoNova('a1b2c3'))
    await waitFor(() => expect(fn).toHaveBeenCalled())
    expect(result.current).toBeNull()

    fn.mockClear()
    renderHook(() => useVersaoNova('dev'))
    await act(async () => {})
    expect(fn).not.toHaveBeenCalled()
  })

  test('confere de novo quando a aba volta ao foco', async () => {
    const fn = servidor({ ...publicada, versao: 'a1b2c3' })
    const { result } = renderHook(() => useVersaoNova('a1b2c3'))
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1))

    fn.mockImplementation(async () => ({ ok: true, json: async () => publicada }))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(result.current?.versao).toBe('b2c3d4'))
  })
})
