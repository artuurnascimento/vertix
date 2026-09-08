import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PagamentoPix from './PagamentoPix'
import { formatarCentavos } from './checkoutTotal'

/**
 * O que estes testes protegem é dinheiro, não pixel.
 *
 * `payment_method_id: 'pix'` é o único campo que dá o desconto do Pix E faz a
 * cobrança ser Pix. Uma chave a mais no payload (um `token`, um
 * `installments`) joga a venda no ramo do cartão no servidor, que recusa sem
 * token. Uma chave a menos cobra o preço cheio no cartão.
 */
describe('PagamentoPix', () => {
  const TOTAL = 17730

  it('manda exatamente { payment_method_id: "pix" } e nenhum token', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <PagamentoPix
        totalCentavos={TOTAL}
        processando={false}
        onSubmit={onSubmit}
      />
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [formData, cardTokenSalvar] = onSubmit.mock.calls[0]
    expect(formData).toEqual({ payment_method_id: 'pix' })
    // toEqual não reprova campo extra com valor undefined; a contagem sim.
    expect(Object.keys(formData as object)).toHaveLength(1)
    expect(cardTokenSalvar).toBeNull()
  })

  it('mostra o total a pagar no botão', () => {
    render(
      <PagamentoPix
        totalCentavos={TOTAL}
        processando={false}
        onSubmit={vi.fn()}
      />
    )

    expect(screen.getByRole('button').textContent).toContain(
      formatarCentavos(TOTAL)
    )
  })

  it('desabilita o botão e diz o que está acontecendo enquanto processa', () => {
    render(
      <PagamentoPix totalCentavos={TOTAL} processando onSubmit={vi.fn()} />
    )

    const botao = screen.getByRole('button')
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    expect(botao.textContent).toContain('Processando')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Processando o pagamento'
    )
  })

  it('absorve a rejeição do onSubmit — a página é quem mostra o erro', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('pagamento_recusado'))
    const naoTratada = vi.fn()
    window.addEventListener('unhandledrejection', naoTratada)

    render(
      <PagamentoPix
        totalCentavos={TOTAL}
        processando={false}
        onSubmit={onSubmit}
      />
    )
    await userEvent.click(screen.getByRole('button'))
    await Promise.resolve()

    window.removeEventListener('unhandledrejection', naoTratada)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(naoTratada).not.toHaveBeenCalled()
  })

  /**
   * Caminho gratuito: reproduz o comportamento de hoje (`formData` nulo), que
   * o servidor recusa com 400. Está sob teste para que ninguém o "conserte"
   * por acidente durante a migração — o conserto é tarefa separada.
   */
  it('no pedido gratuito manda formData nulo, como o Brick faz hoje', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <PagamentoPix totalCentavos={0} processando={false} onSubmit={onSubmit} />
    )

    const botao = screen.getByRole('button', { name: /finalizar pedido/i })
    expect(botao.textContent).not.toContain('R$')

    await userEvent.click(botao)
    expect(onSubmit).toHaveBeenCalledWith(null, null)
  })
})
