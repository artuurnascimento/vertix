import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * O shader de verdade precisa de WebGL 2, que o jsdom não tem. O dublê marca
 * que foi montado e com quais parâmetros — o que importa aqui é a decisão de
 * montar ou não, e que os valores escolhidos no estúdio chegam inteiros.
 */
const { montagens } = vi.hoisted(() => ({ montagens: [] as Record<string, unknown>[] }))
vi.mock('./GhostFibers', () => ({
  default: (props: Record<string, unknown>) => {
    montagens.push(props)
    return <canvas data-testid="fibras" />
  },
}))

import Atmosfera from './Atmosfera'
import { suportaWebGl2 } from './webgl'

const getContextOriginal = HTMLCanvasElement.prototype.getContext

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContextOriginal
  montagens.length = 0
})

describe('Atmosfera', () => {
  test('sem WebGL 2 fica só a cor de base, sem canvas', () => {
    // O jsdom não implementa getContext e avisa no console; o dublê cala isso.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
    expect(suportaWebGl2()).toBe(false)

    const { container } = render(<Atmosfera />)

    const fundo = container.querySelector('.vx-atmosphere')
    expect(fundo).toHaveAttribute('aria-hidden', 'true')
    expect(fundo?.querySelector('canvas')).toBeNull()
    expect(montagens).toHaveLength(0)
  })

  test('com WebGL 2 monta o shader com os parâmetros do estúdio', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as never

    render(<Atmosfera />)

    await waitFor(() => expect(screen.getByTestId('fibras')).toBeInTheDocument())
    expect(montagens).toHaveLength(1)
    expect(montagens[0]).toMatchObject({
      lineColor: '#8036ff',
      glowColor: '#9354ff',
      layers: 1,
      scale: 1.83,
      rotation: 15,
      layerSpeed: -0.09,
      twistFrequency: 6.4,
      dpr: 1,
      fps: 60,
      paused: false,
      lightMode: false,
    })
  })
})
