import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SecaoPagamento from './SecaoPagamento'
import type { MetodoPagamento } from './MetodoPagamento'

/**
 * O que estes testes protegem é a trava nº 1 da migração: **enquanto ninguém
 * ligar a flag, esta seção tem de renderizar o Payment Brick, e só ele.**
 *
 * O Brick está vendendo. Um `?` invertido aqui, ou uma flag lida com o valor
 * errado, trocaria o formulário de pagamento de 100% do tráfego sem ninguém
 * pedir — e o sintoma chegaria como queda de conversão, não como erro no
 * console.
 *
 * Os três formulários são dublês: quem testa o que cada um faz são
 * `PagamentoPix.test.tsx` e `PagamentoCartao.test.tsx`. Aqui só interessa
 * QUAL entra na tela, e com quais dados.
 */

vi.mock('./PagamentoBrick', () => ({
  default: (props: { metodo: string; emailInicial: string }) => (
    <div
      data-testid="brick"
      data-metodo={props.metodo}
      data-email={props.emailInicial}
    />
  ),
}))

vi.mock('./PagamentoCartao', () => ({
  default: (props: { documento: string; totalCentavos: number }) => (
    <div
      data-testid="cartao"
      data-documento={props.documento}
      data-total={String(props.totalCentavos)}
    />
  ),
}))

vi.mock('./PagamentoPix', () => ({
  default: (props: { totalCentavos: number }) => (
    <div data-testid="pix" data-total={String(props.totalCentavos)} />
  ),
}))

const TOTAL = 19700

function renderizar(
  opcoes: { busca?: string; metodo?: MetodoPagamento; erro?: string } = {}
) {
  window.history.replaceState({}, '', `/c/slug${opcoes.busca ?? ''}`)
  return render(
    <SecaoPagamento
      id="pagamento"
      totalCentavos={TOTAL}
      metodo={opcoes.metodo ?? 'cartao'}
      onMetodo={vi.fn()}
      descontoPixPercentual={null}
      emailInicial="comprador@exemplo.com"
      documento="123.456.789-09"
      processando={false}
      erro={opcoes.erro ?? null}
      onSubmit={vi.fn()}
      onErroCarregamento={vi.fn()}
    />
  )
}

describe('SecaoPagamento', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  describe('flag desligada — o checkout de hoje, intacto', () => {
    it('renderiza o Brick no cartão, e nenhum formulário novo', () => {
      renderizar()

      expect(screen.getByTestId('brick')).toBeInTheDocument()
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pix')).not.toBeInTheDocument()
    })

    it('renderiza o Brick TAMBÉM no Pix — quem desenha os dois é ele', () => {
      renderizar({ metodo: 'pix' })

      expect(screen.getByTestId('brick')).toHaveAttribute('data-metodo', 'pix')
      expect(screen.queryByTestId('pix')).not.toBeInTheDocument()
    })

    it('mantém o wrapper .vtx-checkout, que é quem escopa o botão do Brick', () => {
      const { container } = renderizar()

      const wrapper = container.querySelector('.vtx-checkout')
      expect(wrapper).not.toBeNull()
      expect(wrapper).toContainElement(screen.getByTestId('brick'))
    })

    it('continua pré-preenchendo o e-mail do pagador', () => {
      renderizar()

      expect(screen.getByTestId('brick')).toHaveAttribute(
        'data-email',
        'comprador@exemplo.com'
      )
    })

    it('?sf=0 é o kill-switch: volta ao Brick mesmo pedindo o novo', () => {
      renderizar({ busca: '?sf=0' })

      expect(screen.getByTestId('brick')).toBeInTheDocument()
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
    })
  })

  describe('flag ligada por ?sf=1', () => {
    it('troca o Brick pelo formulário de cartão', () => {
      const { container } = renderizar({ busca: '?sf=1' })

      expect(screen.getByTestId('cartao')).toBeInTheDocument()
      expect(screen.queryByTestId('brick')).not.toBeInTheDocument()
      // Sem Brick não há botão do SDK para escopar — o wrapper sai junto.
      expect(container.querySelector('.vtx-checkout')).toBeNull()
    })

    it('entrega o documento ao cartão: sem ele não há token nem venda', () => {
      renderizar({ busca: '?sf=1' })

      expect(screen.getByTestId('cartao')).toHaveAttribute(
        'data-documento',
        '123.456.789-09'
      )
    })

    it('no Pix monta o painel do Pix, não o do cartão', () => {
      renderizar({ busca: '?sf=1', metodo: 'pix' })

      expect(screen.getByTestId('pix')).toHaveAttribute(
        'data-total',
        String(TOTAL)
      )
      expect(screen.queryByTestId('cartao')).not.toBeInTheDocument()
      expect(screen.queryByTestId('brick')).not.toBeInTheDocument()
    })
  })

  it.each([undefined, '?sf=1'])(
    'mostra o erro da última tentativa nos dois caminhos (%j)',
    (busca) => {
      renderizar({ busca, erro: 'Cartão recusado pelo emissor.' })

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Cartão recusado pelo emissor.'
      )
    }
  )
})
