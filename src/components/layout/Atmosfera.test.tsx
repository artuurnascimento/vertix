import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * O shader de verdade precisa de WebGL 2, que o jsdom não tem. O dublê marca
 * que foi montado e com quais parâmetros — o que importa aqui é a decisão de
 * montar ou não, e que os valores escolhidos no estúdio chegam inteiros.
 */
const { montagens } = vi.hoisted(() => ({ montagens: [] as Record<string, unknown>[] }))
vi.mock('./DarkVeil', () => ({
  default: (props: Record<string, unknown>) => {
    montagens.push(props)
    return <canvas data-testid="veu" />
  },
}))

import Atmosfera from './Atmosfera'
import { suportaWebGl } from './webgl'

const getContextOriginal = HTMLCanvasElement.prototype.getContext

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContextOriginal
  montagens.length = 0
})

describe('Atmosfera', () => {
  test('sem WebGL fica só a cor de base, sem canvas', () => {
    // O jsdom não implementa getContext e avisa no console; o dublê cala isso.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
    expect(suportaWebGl()).toBe(false)

    const { container } = render(<Atmosfera />)

    const fundo = container.querySelector('.vx-atmosphere')
    expect(fundo).toHaveAttribute('aria-hidden', 'true')
    expect(fundo?.querySelector('canvas')).toBeNull()
    expect(montagens).toHaveLength(0)
  })

  test('com WebGL monta o shader com os parâmetros do estúdio', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as never

    render(<Atmosfera />)

    await waitFor(() => expect(screen.getByTestId('veu')).toBeInTheDocument())
    expect(montagens).toHaveLength(1)
    expect(montagens[0]).toEqual({
      hueShift: -10,
      noiseIntensity: 0,
      scanlineIntensity: 0.05,
      speed: 0.3,
      scanlineFrequency: 0,
      warpAmount: 0.1,
      resolutionScale: 1.25,
    })
  })
})
