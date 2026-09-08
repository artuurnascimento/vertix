import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScanComprasTable from './ScanComprasTable'
import ScanReembolsoModal from './ScanReembolsoModal'
import { mensagemDoCorpoDaCompra } from './comprasData'
import { podeReembolsarCompra } from './comprasResumo'
import type { ScanCompra } from './comprasData'

/**
 * O reembolso das vendas que existem de verdade — as do Vertix Scan.
 *
 * A confirmação forte é o que separa um clique errado de R$ 197 saindo da
 * conta e um cliente perdendo o acesso ao plano que comprou. O que se protege
 * aqui é: o botão só existe onde há dinheiro para devolver, o botão de
 * confirmar nasce travado e só o valor EXATO o destrava, e a tela diz as duas
 * consequências ANTES — não depois.
 */

const COMPRA: ScanCompra = {
  id: 'f9923026-c0cf-40f4-aca3-a1b58a784fbb',
  criado_em: '2026-09-07T11:00:00.000Z',
  status: 'pago',
  valor_centavos: 19700,
  dominio: 'loja-exemplo.com.br',
  comprador: 'Maria Souza',
  email: 'maria@loja.com',
  plano_code: 'abc123abc123',
  plano_gerado_em: '2026-09-07T11:05:00.000Z',
  recibo_enviado_em: '2026-09-07T11:06:00.000Z',
  pago_em: '2026-09-07T11:00:30.000Z',
  concorrentes: null,
  reanalise_agendada_em: null,
  reanalise_analysis_id: null,
  receivable_id: '48f8b0ae-6d7a-466c-9020-1309dcca7415',
  reembolsado_em: null,
}

function botaoConfirmar() {
  return screen.getByRole('button', { name: /Reembolsar R\$/ })
}

describe('podeReembolsarCompra — quando o botão pode existir', () => {
  it('só a compra paga oferece estorno', () => {
    expect(podeReembolsarCompra({ status: 'pago' })).toBe(true)
  })

  it.each(['aguardando_pagamento', 'cancelado', 'reembolsado'])(
    'não oferece estorno em %s',
    (status) => {
      expect(podeReembolsarCompra({ status })).toBe(false)
    }
  )

  it('status desconhecido não oferece estorno — o padrão é não devolver', () => {
    expect(podeReembolsarCompra({ status: 'em_disputa' })).toBe(false)
  })
})

describe('ScanComprasTable — o botão de reembolso', () => {
  const onReembolsar = vi.fn()

  function renderTabela(over: Partial<ScanCompra> = {}) {
    onReembolsar.mockClear()
    render(
      <ScanComprasTable
        compras={[{ ...COMPRA, ...over }]}
        onReembolsar={onReembolsar}
        agora={new Date('2026-09-07T11:30:00.000Z')}
      />
    )
  }

  it('entrega a compra inteira a quem abre a confirmação', async () => {
    renderTabela()
    await userEvent.click(screen.getByRole('button', { name: /Reembolsar/ }))
    expect(onReembolsar).toHaveBeenCalledWith(
      expect.objectContaining({ id: COMPRA.id, valor_centavos: 19700 })
    )
  })

  it.each(['aguardando_pagamento', 'cancelado', 'reembolsado'])(
    'não mostra o botão na compra %s',
    (status) => {
      renderTabela({ status })
      expect(
        screen.queryByRole('button', { name: /Reembolsar/ })
      ).not.toBeInTheDocument()
    }
  )

  it('a lista sem onReembolsar fica só de leitura', () => {
    render(<ScanComprasTable compras={[COMPRA]} />)
    expect(
      screen.queryByRole('button', { name: /Reembolsar/ })
    ).not.toBeInTheDocument()
  })

  it('mostra quando o dinheiro voltou', () => {
    renderTabela({
      status: 'reembolsado',
      reembolsado_em: '2026-09-08T13:00:00.000Z',
    })
    expect(screen.getByText(/Reembolsado em/)).toBeInTheDocument()
  })

  it('não afirma data que não conseguiu ler', () => {
    // Compra reembolsada num ambiente sem a coluna: a tela diz que não sabe,
    // em vez de omitir o reembolso ou inventar um carimbo.
    render(
      <ScanComprasTable
        compras={[{ ...COMPRA, status: 'reembolsado' }]}
        temColunaReembolso={false}
      />
    )
    expect(screen.getByText(/data não registrada/)).toBeInTheDocument()
  })

  it('separa "estornado por fora" de "não sei a data"', () => {
    // Com a coluna presente e vazia, o reembolso veio de fora do painel (pelo
    // painel do MP ou por contestação) — outra frase, outro fato.
    render(
      <ScanComprasTable compras={[{ ...COMPRA, status: 'reembolsado' }]} />
    )
    expect(screen.getByText(/estornado por fora do painel/)).toBeInTheDocument()
  })
})

describe('ScanReembolsoModal — confirmação forte', () => {
  it('nasce com o botão travado', () => {
    render(
      <ScanReembolsoModal compra={COMPRA} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    expect(botaoConfirmar()).toBeDisabled()
  })

  it('continua travado com o valor quase certo', async () => {
    render(
      <ScanReembolsoModal compra={COMPRA} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByRole('textbox'), '196,99')
    expect(botaoConfirmar()).toBeDisabled()
  })

  it('só destrava com o valor exato da venda', async () => {
    const onConfirm = vi.fn()
    render(
      <ScanReembolsoModal compra={COMPRA} onConfirm={onConfirm} onClose={vi.fn()} />
    )
    await userEvent.type(screen.getByRole('textbox'), '197,00')
    expect(botaoConfirmar()).toBeEnabled()
    await userEvent.click(botaoConfirmar())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('o valor certo de OUTRA venda não libera esta', async () => {
    render(
      <ScanReembolsoModal
        compra={{ ...COMPRA, valor_centavos: 29700 }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await userEvent.type(screen.getByRole('textbox'), '197,00')
    expect(botaoConfirmar()).toBeDisabled()
  })

  it('diz as duas consequências antes de confirmar', () => {
    render(
      <ScanReembolsoModal compra={COMPRA} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/R\$\s?197,00 voltam para Maria Souza/)
    expect(dialogo).toHaveTextContent(/revogado na hora/)
    expect(dialogo).toHaveTextContent(/já foi gerado/)
    expect(dialogo).toHaveTextContent(/reanálise de 30 dias também não acontece/i)
    expect(dialogo).toHaveTextContent(/Não tem como devolver o acesso/)
  })

  it('avisa o que acontece com a cobrança no Financeiro', () => {
    render(
      <ScanReembolsoModal compra={COMPRA} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/sai da receita do mês/)
  })

  it('não inventa nome para compra sem lead casado', () => {
    render(
      <ScanReembolsoModal
        compra={{ ...COMPRA, comprador: null, email: null }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const dialogo = screen.getByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/este comprador/)
    expect(dialogo).not.toHaveTextContent(/null/)
  })

  it('mostra o erro do estorno sem fechar o diálogo', () => {
    render(
      <ScanReembolsoModal
        compra={COMPRA}
        erro="O Mercado Pago recusou o reembolso."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('recusou o reembolso')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('trava tudo enquanto o estorno está em curso', async () => {
    const onClose = vi.fn()
    render(
      <ScanReembolsoModal
        compra={COMPRA}
        isPending
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('button', { name: /Estornando/ })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('não renderiza nada quando não há compra escolhida', () => {
    render(
      <ScanReembolsoModal compra={null} onConfirm={vi.fn()} onClose={vi.fn()} />
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('mensagemDoCorpoDaCompra — o que a tela diz sobre o dinheiro', () => {
  it('não vê erro nenhum na resposta de sucesso', () => {
    expect(
      mensagemDoCorpoDaCompra({
        compra_id: COMPRA.id,
        status: 'reembolsado',
        resultado: 'reembolsado',
      })
    ).toBeNull()
  })

  it('trata "já estava reembolsada" como sucesso, não como falha', () => {
    expect(
      mensagemDoCorpoDaCompra({ status: 'reembolsado', resultado: 'ja_reembolsado' })
    ).toBeNull()
  })

  it('prefere a mensagem do servidor, que é quem sabe se o dinheiro saiu', () => {
    expect(
      mensagemDoCorpoDaCompra({
        erro: 'reembolsado_sem_registro',
        mensagem:
          'O reembolso foi feito no Mercado Pago, mas a compra não pôde ser atualizada. Não repita a operação.',
      })
    ).toMatch(/Não repita a operação/)
  })

  it('repassa a recusa por ambiguidade em vez de resumi-la', () => {
    // Dois pagamentos do mesmo valor: a function recusa de propósito, e a tela
    // não pode transformar isso num "tente de novo".
    expect(
      mensagemDoCorpoDaCompra({
        erro: 'pagamento_ambiguo',
        pagamentos: ['1', '2'],
        mensagem:
          'Esta venda tem mais de um pagamento do mesmo valor no Mercado Pago. Nada foi estornado.',
      })
    ).toMatch(/mais de um pagamento/)
  })

  it('traduz os códigos próprios da venda do Scan', () => {
    expect(mensagemDoCorpoDaCompra({ erro: 'compra_nao_encontrada' })).toMatch(
      /não existe/
    )
    expect(mensagemDoCorpoDaCompra({ erro: 'acesso_negado' })).toMatch(/permissão/)
  })

  it('não engole um código novo do backend', () => {
    expect(mensagemDoCorpoDaCompra({ erro: 'chargeback_em_disputa' })).toMatch(
      /confira no Mercado Pago/i
    )
  })

  it('não inventa erro sem corpo', () => {
    expect(mensagemDoCorpoDaCompra(null)).toBeNull()
  })
})
