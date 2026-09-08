import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResumoPedido from './ResumoPedido'
import type { ProdutoCheckout } from './checkoutTypes'
import type { ResultadoTotal } from './checkoutTotal'

/**
 * O estado inicial do resumo é CONFIGURAÇÃO DA OFERTA, não largura de tela.
 *
 * Antes ele nascia aberto a partir de 1024px, por um `matchMedia` dentro do
 * componente. Estes testes travam as duas metades da regra nova: a semente vem
 * da prop, e depois da montagem quem manda é o clique da pessoa.
 */

const PRODUTO: ProdutoCheckout = {
  nome: 'Plano de correção',
  descricao: 'Diagnóstico completo da loja e plano de ação.',
  imagemUrl: null,
  precoCentavos: 19700,
  ancoraCentavos: null,
}

const TOTAL: ResultadoTotal = {
  subtotalCentavos: 19700,
  descontoCentavos: 0,
  descontoMetodoCentavos: 0,
  totalCentavos: 19700,
}

function renderizar(padraoAberto: boolean) {
  return render(
    <ResumoPedido
      produto={PRODUTO}
      bump={null}
      bumpMarcado={false}
      cupomCodigo={null}
      metodo="pix"
      descontoPixPercentual={null}
      total={TOTAL}
      padraoAberto={padraoAberto}
    />
  )
}

describe('ResumoPedido — padrão vindo da oferta', () => {
  beforeEach(() => {
    // jsdom não tem matchMedia e o `useReducedMotion` do framer-motion lê ele.
    // O componente em si já não consulta mais largura de tela nenhuma.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('padrão recolhido: nasce fechado', () => {
    renderizar(false)

    const botao = screen.getByRole('button')
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Ver detalhes')).toBeInTheDocument()
  })

  it('padrão aberto: nasce aberto', () => {
    renderizar(true)

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Ocultar')).toBeInTheDocument()
  })

  it('nome e total aparecem no cabeçalho mesmo recolhido', () => {
    renderizar(false)

    // Dentro do próprio botão: o preço também existe no corpo recolhido (o
    // `Revelar` o esconde por `visibility`, não o remove), e o que este teste
    // guarda é o que fica à vista de relance.
    const cabecalho = screen.getByRole('button')
    expect(within(cabecalho).getByText('Plano de correção')).toBeInTheDocument()
    expect(within(cabecalho).getByText('R$ 197,00')).toBeInTheDocument()
  })

  it('depois da montagem quem manda é o clique, não o padrão', async () => {
    const { rerender } = renderizar(true)
    const botao = screen.getByRole('button')

    await userEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')

    // Um re-render com o mesmo padrão (janela redimensionada, cupom aplicado,
    // método trocado) não pode reabrir o que a pessoa acabou de fechar.
    rerender(
      <ResumoPedido
        produto={PRODUTO}
        bump={null}
        bumpMarcado={false}
        cupomCodigo={null}
        metodo="cartao"
        descontoPixPercentual={null}
        total={TOTAL}
        padraoAberto
      />
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })
})
