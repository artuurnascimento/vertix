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
    expect(faixa).toHaveTextContent('Esta oferta termina em')
    expect(faixa).toHaveTextContent('14:52')
    expect(faixa).not.toHaveTextContent('00:14')
    expect(faixa.className).toContain('from-accent-2')
    expect(faixa.className).not.toContain('amber')
    expect(screen.getByLabelText('Tempo restante: 14 minutos, 52 segundos')).toBeInTheDocument()
  })

  test('com horas, elas aparecem uma vez, sem zero à esquerda', () => {
    relogio.restante = (2 * 3600 + 5 * 60 + 9) * 1000
    render(<Cronometro ate="2027-01-01T00:00:00Z" minutos={null} slug="plano" />)
    expect(screen.getByTestId('cronometro')).toHaveTextContent('2:05:09')
  })

  test('sem contagem, não renderiza nada', () => {
    relogio.restante = null
    const { container } = render(<Cronometro ate={null} minutos={null} slug="plano" />)
    expect(container).toBeEmptyDOMElement()
  })
})
