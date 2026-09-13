import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useContagem } from './useContagem'

/**
 * O relógio é falso e o requestAnimationFrame é um dublê que só avança
 * quando o teste manda — assim dá para ver o número no meio do caminho.
 */
function relogioFalso(reduzido = false) {
  let agora = 1000
  const fila: FrameRequestCallback[] = []
  vi.stubGlobal('matchMedia', () => ({ matches: reduzido }))
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => fila.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
  return {
    avancar(ms: number) {
      agora += ms
      const pendentes = fila.splice(0)
      act(() => pendentes.forEach((cb) => cb(agora)))
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useContagem', () => {
  test('sobe de zero até o alvo com suavização, sem passar do alvo', () => {
    const relogio = relogioFalso()
    const { result } = renderHook(() => useContagem(24800, 800))

    expect(result.current).toBe(0)
    relogio.avancar(0)
    relogio.avancar(200)
    const noMeio = result.current
    expect(noMeio).toBeGreaterThan(0)
    expect(noMeio).toBeLessThan(24800)
    relogio.avancar(200)
    expect(result.current).toBeGreaterThan(noMeio)
    relogio.avancar(1000)
    expect(result.current).toBe(24800)
  })

  test('quando o alvo muda, parte do valor atual e não do zero', () => {
    const relogio = relogioFalso()
    const { result, rerender } = renderHook(({ alvo }) => useContagem(alvo, 800), {
      initialProps: { alvo: 100 },
    })
    relogio.avancar(0)
    relogio.avancar(2000)
    expect(result.current).toBe(100)

    rerender({ alvo: 50 })
    relogio.avancar(0)
    relogio.avancar(100)
    expect(result.current).toBeLessThan(100)
    expect(result.current).toBeGreaterThan(50)
  })

  test('com prefers-reduced-motion vai direto ao alvo', () => {
    relogioFalso(true)
    const { result } = renderHook(() => useContagem(34))
    expect(result.current).toBe(34)
  })
})
