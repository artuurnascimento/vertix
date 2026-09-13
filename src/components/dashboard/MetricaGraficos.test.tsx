import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { Barras, Donut, Linha } from './MetricaGraficos'

const serie = [
  { key: '2026-04', label: 'abr', total: 10 },
  { key: '2026-05', label: 'mai', total: 20 },
  { key: '2026-06', label: 'jun', total: 30 },
  { key: '2026-07', label: 'jul', total: 25 },
  { key: '2026-08', label: 'ago', total: 40 },
  { key: '2026-09', label: 'set', total: 34 },
]
const inteiro = (n: number) => String(n)

describe('Barras', () => {
  test('cada mês carrega a própria dica com o valor, e a barra sobe na altura certa', () => {
    const { container } = render(<Barras serie={serie} formatar={inteiro} rotulos />)
    const meses = container.querySelectorAll('.vx-barras > span')
    expect(meses).toHaveLength(6)
    expect(meses[4].querySelector('.vx-dica')).toHaveTextContent('ago · 40')
    expect((meses[4] as HTMLElement).style.getPropertyValue('--altura')).toBe('100%')
    expect((meses[0] as HTMLElement).style.getPropertyValue('--altura')).toBe('25%')
  })
})

describe('Linha', () => {
  test('o mouse escolhe o mês mais próximo e a dica aparece; sair esconde', () => {
    const { container } = render(<Linha serie={serie} formatar={inteiro} />)
    const svg = container.querySelector('svg') as SVGSVGElement
    // O jsdom não mede nada: a caixa de 240px casa 1:1 com o viewBox.
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 240,
      top: 0,
      height: 60,
      right: 240,
      bottom: 60,
      x: 0,
      y: 0,
      toJSON() {},
    })

    expect(container.querySelector('.vx-dica')).toBeNull()

    // x = 8 + 4 * 44.8 ≈ 187 → o quinto ponto (ago).
    fireEvent.mouseMove(svg, { clientX: 190, clientY: 20 })
    expect(container.querySelector('.vx-dica')).toHaveTextContent('ago · 40')
    expect(container.querySelectorAll('.vx-linha-ponto-ativo')).toHaveLength(1)
    expect(container.querySelector('.vx-linha-guia')).toBeInTheDocument()

    // Fora da margem à direita cai no último mês, nunca fora da série.
    fireEvent.mouseMove(svg, { clientX: 239, clientY: 20 })
    expect(container.querySelector('.vx-dica')).toHaveTextContent('set · 34')

    fireEvent.mouseLeave(container.firstElementChild as Element)
    expect(container.querySelector('.vx-dica')).toBeNull()
  })
})

describe('Donut', () => {
  test('passar o mouse numa fatia põe o valor dela no centro e marca a legenda', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { container } = render(<Donut dados={{ andamento: 8, revisao: 4, concluidos: 3 }} />)
    const centro = screen.getByTestId('donut-centro')
    expect(centro).toHaveTextContent('12')
    expect(centro).toHaveTextContent('4 em revisão')

    const fatias = container.querySelectorAll('svg circle:not(.vx-donut-trilho)')
    fireEvent.mouseEnter(fatias[2])
    expect(centro).toHaveTextContent('3')
    expect(centro).toHaveTextContent('Concluídos')
    const itens = within(container).getAllByRole('listitem')
    expect(itens[2]).toHaveClass('vx-fatia-ativa')
    expect(itens[0]).toHaveClass('vx-fatia-apagada')
    expect(fatias[2]).toHaveClass('vx-fatia-ativa')

    // Pela legenda também.
    fireEvent.mouseEnter(itens[1])
    expect(centro).toHaveTextContent('Em revisão')

    fireEvent.mouseLeave(container.firstElementChild as Element)
    expect(centro).toHaveTextContent('4 em revisão')
    expect(itens[0]).not.toHaveClass('vx-fatia-apagada')
    vi.unstubAllGlobals()
  })
})
