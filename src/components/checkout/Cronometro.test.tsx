import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const { relogio } = vi.hoisted(() => ({ relogio: { restante: null as number | null } }))
vi.mock('./useCronometro', () => ({ useCronometro: () => relogio.restante }))

import Cronometro from './Cronometro'

describe('Cronometro', () => {
  test('mostra só minutos e segundos, sem "00:" na frente, na faixa roxa', () => {
    relogio.restante = (14 * 60 + 52) * 1000
    render(<Cronometro ate={null} minutos={15} slug="plano" />)

    const faixa = screen.getByTestId('cronometro')
    expect(faixa).toHaveTextContent('Oferta por tempo limitado')
    expect(faixa).toHaveTextContent('14:52')
    expect(faixa).not.toHaveTextContent('00:14')
    expect(faixa.className).toContain('from-accent-2')
    expect(faixa.className).not.toContain('amber')
    expect(screen.getByLabelText('Tempo restante: 14 minutos, 52 segundos')).toBeInTheDocument()
    // Linha de progresso: 14:52 de 15:00 ≈ 99%.
    const barra = faixa.querySelector('.vx-cronometro-barra') as HTMLElement
    expect(parseFloat(barra.style.width)).toBeCloseTo((892 / 900) * 100, 5)
    expect(faixa).not.toHaveAttribute('data-urgente')
  })

  test('no último minuto os dígitos pulsam', () => {
    relogio.restante = 42_000
    render(<Cronometro ate={null} minutos={15} slug="plano" />)
    expect(screen.getByTestId('cronometro')).toHaveAttribute('data-urgente', 'true')
    expect(screen.getByLabelText('Tempo restante: 0 minutos, 42 segundos')).toHaveClass('vx-cronometro-pulso')
  })

  test('com horas, elas aparecem uma vez, sem zero à esquerda', () => {
    relogio.restante = (2 * 3600 + 5 * 60 + 9) * 1000
    render(<Cronometro ate="2027-01-01T00:00:00Z" minutos={null} slug="plano" />)
    const faixa = screen.getByTestId('cronometro')
    expect(faixa).toHaveTextContent('2:05:09')
    // No modo de data não há total conhecido: sem linha de progresso.
    expect(faixa.querySelector('.vx-cronometro-barra')).toBeNull()
  })

  test('a frase vem do painel; vazia, cai no padrão', () => {
    relogio.restante = 30_000
    const { rerender } = render(<Cronometro ate={null} minutos={15} slug="plano" texto="Preço de lançamento acaba em" />)
    expect(screen.getByTestId('cronometro')).toHaveTextContent('Preço de lançamento acaba em')
    rerender(<Cronometro ate={null} minutos={15} slug="plano" texto="   " />)
    expect(screen.getByTestId('cronometro')).toHaveTextContent('Oferta por tempo limitado')
  })

  test('sem contagem, não renderiza nada', () => {
    relogio.restante = null
    const { container } = render(<Cronometro ate={null} minutos={null} slug="plano" />)
    expect(container).toBeEmptyDOMElement()
  })
})
