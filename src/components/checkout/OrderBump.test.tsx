import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import OrderBump from './OrderBump'
import type { BumpCheckout } from './checkoutTypes'

const BUMP: BumpCheckout = {
  titulo: 'Quer ver mais 3 concorrentes?',
  descricao: 'Comparativo lado a lado\n• Mais contexto de mercado\n• Onde eles estão na sua frente',
  precoCentavos: 9700,
  ancoraCentavos: 19700,
  imagem: null,
}

describe('OrderBump', () => {
  test('sem imagem, o card é o de sempre: nenhum <img>', () => {
    render(<OrderBump bump={BUMP} marcado={false} onChange={vi.fn()} />)

    expect(screen.getByText('Quer ver mais 3 concorrentes?')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('picture')).toBeNull()
  })

  test('com as duas artes, o celular fica no <img> e o desktop no <source>', () => {
    const { container } = render(
      <OrderBump
        bump={{
          ...BUMP,
          imagem: {
            desktop: { url: 'https://cdn/bump-d.webp', largura: 1400, altura: 400 },
            mobile: { url: 'https://cdn/bump-m.webp', largura: 780, altura: 440 },
            alt: 'Comparativo com 3 concorrentes',
          },
        }}
        marcado={false}
        onChange={vi.fn()}
      />
    )

    const img = screen.getByRole('img', { name: 'Comparativo com 3 concorrentes' })
    expect(img).toHaveAttribute('src', 'https://cdn/bump-m.webp')
    // width/height reservam o espaço antes de a arte chegar.
    expect(img).toHaveAttribute('width', '780')
    expect(img).toHaveAttribute('height', '440')

    const source = container.querySelector('picture source')
    expect(source).toHaveAttribute('media', '(min-width: 768px)')
    expect(source).toHaveAttribute('srcset', 'https://cdn/bump-d.webp')
  })

  test('com imagem, a arte substitui o texto: fica a caixa, o rótulo e o preço', () => {
    render(
      <OrderBump
        bump={{
          ...BUMP,
          imagem: {
            desktop: { url: 'https://cdn/bump-d.webp', largura: 1400, altura: 500 },
            mobile: { url: 'https://cdn/bump-m.webp', largura: 780, altura: 600 },
            alt: '',
          },
        }}
        marcado={false}
        onChange={vi.fn()}
      />
    )

    // Nada de título visível nem lista de benefícios: a copy está na arte.
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByText('Mais contexto de mercado')).toBeNull()
    expect(screen.getByText('Adicione ao pedido')).toBeInTheDocument()
    expect(screen.getByText('R$ 97,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 197,00')).toBeInTheDocument()

    // Mas quem não vê a arte ainda sabe o que está marcando.
    const caixa = screen.getByRole('checkbox')
    expect(caixa).toHaveAccessibleDescription(/Quer ver mais 3 concorrentes\?/)
    expect(caixa).toHaveAccessibleDescription(/Mais contexto de mercado/)
  })

  test('só uma arte serve nos dois tamanhos, sem <source>', () => {
    const { container } = render(
      <OrderBump
        bump={{
          ...BUMP,
          imagem: {
            desktop: { url: 'https://cdn/bump-d.webp', largura: 1400, altura: 400 },
            mobile: null,
            alt: '',
          },
        }}
        marcado={false}
        onChange={vi.fn()}
      />
    )

    // alt vazio (decorativa): não entra como "img" nomeado, mas está lá.
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://cdn/bump-d.webp')
    expect(img).toHaveAttribute('alt', '')
    expect(container.querySelector('picture source')).toBeNull()
  })
})
