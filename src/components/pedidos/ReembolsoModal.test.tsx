import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReembolsoModal from './ReembolsoModal'
import PedidoLinha from './PedidoLinha'
import type { Pedido } from './pedidosData'

/**
 * A confirmação forte é o que separa um clique errado de R$ 197 saindo da
 * conta e um cliente perdendo o acesso ao que comprou. Estes testes garantem
 * que o botão nasce travado, que só o valor exato o destrava, e que a tela
 * diz as duas consequências ANTES — não depois.
 */

const PEDIDO: Pedido = {
  id: 'ped-1',
  criado_em: '2026-09-08T12:00:00.000Z',
  cliente_nome: 'Maria Souza',
  cliente_email: 'maria@loja.com',
  cliente_whatsapp: null,
  itens: [
    {
      produto_id: 'p1',
      nome: 'Plano de Correção',
      tipo: 'principal',
      preco_centavos: 19700,
      pago: true,
      entrega: 'plano_scan',
      receivable_id: null,
    },
  ],
  subtotal_centavos: 19700,
  desconto_centavos: 0,
  desconto_metodo_centavos: 0,
  total_centavos: 19700,
  status: 'pago',
  mp_payment_id: '123',
  mp_card_id: null,
  receivable_id: null,
  plano_code: 'abc123',
  origem: null,
  entregue_em: '2026-09-08T12:05:00.000Z',
  plano_gerado_em: '2026-09-08T12:05:00.000Z',
  recibo_enviado_em: null,
  reembolsado_em: null,
  checkout_titulo: 'Plano de Correção',
  checkout_slug: 'plano',
}

function botaoConfirmar() {
  return screen.getByRole('button', { name: /Reembolsar R\$/ })
}

describe('ReembolsoModal — confirmação forte', () => {
  it('nasce com o botão travado', () => {
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    expect(botaoConfirmar()).toBeDisabled()
  })

  it('continua travado com o valor quase certo', async () => {
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByRole('textbox'), '196,99')
    expect(botaoConfirmar()).toBeDisabled()
  })

  it('só destrava com o valor exato do pedido', async () => {
    const onConfirm = vi.fn()
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={onConfirm} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByRole('textbox'), '197,00')
    expect(botaoConfirmar()).toBeEnabled()

    await userEvent.click(botaoConfirmar())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('trava de novo se a pessoa apagar o que digitou', async () => {
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    const campo = screen.getByRole('textbox')
    await userEvent.type(campo, '197,00')
    expect(botaoConfirmar()).toBeEnabled()
    await userEvent.clear(campo)
    expect(botaoConfirmar()).toBeDisabled()
  })

  it('não confirma no Enter enquanto o valor não bate', async () => {
    const onConfirm = vi.fn()
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={onConfirm} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByRole('textbox'), '19700{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('diz as duas consequências antes de confirmar', () => {
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/R\$\s?197,00 voltam para Maria Souza/)
    expect(dialogo).toHaveTextContent(/revogado na hora/)
    expect(dialogo).toHaveTextContent(/já foi entregue/)
    expect(dialogo).toHaveTextContent(/Não tem como devolver o acesso/)
  })

  it('avisa quando o pedido virou recebível no Financeiro', () => {
    render(
      <ReembolsoModal
        pedido={{ ...PEDIDO, receivable_id: 'rec-1' }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      /recebível no Financeiro/
    )
  })

  it('mostra o erro do estorno sem fechar o diálogo', () => {
    render(
      <ReembolsoModal
        pedido={PEDIDO}
        erro="O gateway recusou o estorno."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('O gateway recusou')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('trava tudo enquanto o estorno está em curso', async () => {
    const onClose = vi.fn()
    render(
      <ReembolsoModal
        pedido={PEDIDO}
        isPending
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('button', { name: /Estornando/ })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('fecha no Esc quando não está estornando', async () => {
    const onClose = vi.fn()
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={vi.fn()} onClose={onClose} />
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('não renderiza nada quando não há pedido escolhido', () => {
    render(<ReembolsoModal pedido={null} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('prende o foco: o Tab do último elemento volta para o primeiro', async () => {
    render(
      <ReembolsoModal pedido={PEDIDO} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    const fechar = screen.getByRole('button', { name: 'Fechar' })
    fechar.focus()
    // Chega ao último focável (o botão de confirmar, desabilitado sai da
    // conta) e segue: o foco não pode cair na lista de pedidos atrás.
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    cancelar.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(fechar)
  })
})

describe('PedidoLinha — o botão de reembolso', () => {
  const onReembolsar = vi.fn()

  function renderLinha(over: Partial<Pedido> = {}) {
    onReembolsar.mockClear()
    render(
      <ul>
        <PedidoLinha
          pedido={{ ...PEDIDO, ...over }}
          temColunaReembolso
          onReembolsar={onReembolsar}
          agora={new Date('2026-09-08T12:30:00.000Z')}
        />
      </ul>
    )
  }

  it('oferece reembolso no pedido pago', async () => {
    renderLinha()
    await userEvent.click(screen.getByRole('button', { name: /Reembolsar/ }))
    expect(onReembolsar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ped-1' })
    )
  })

  it.each(['aguardando', 'recusado', 'reembolsado'])(
    'não oferece reembolso no pedido %s',
    (status) => {
      renderLinha({ status })
      expect(
        screen.queryByRole('button', { name: /Reembolsar/ })
      ).not.toBeInTheDocument()
    }
  )

  it('mostra quando o pedido já foi reembolsado', () => {
    renderLinha({
      status: 'reembolsado',
      reembolsado_em: '2026-09-08T13:00:00.000Z',
    })
    expect(screen.getByText(/Reembolsado em/)).toBeInTheDocument()
  })
})
