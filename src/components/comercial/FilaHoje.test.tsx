import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ItemDaFila } from './fila'

const { estado, mutate } = vi.hoisted(() => ({
  estado: { itens: [] as ItemDaFila[] },
  mutate: vi.fn(),
}))
vi.mock('./comercialData', () => ({
  useFilaComercial: () => ({ data: estado.itens, isLoading: false, isError: false }),
  useAtualizarComercial: () => ({ mutate, isPending: false }),
}))

import FilaHoje from './FilaHoje'

const hoje = new Date()
const dia = (recuo: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - recuo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const item = (o: Partial<ItemDaFila>): ItemDaFila => ({
  project_id: 'p1',
  projeto: 'Correção da loja',
  status: 'lead',
  client_id: 'c1',
  cliente: 'Ana Silva',
  empresa: 'Studio Norte',
  responsavel_id: null,
  responsavel: null,
  proxima_acao: null,
  proxima_acao_em: null,
  valor_estimado: null,
  previsao_fechamento: null,
  updated_at: new Date().toISOString(),
  comprou_plano: false,
  pediu_ajuda: null,
  reuniao_em: null,
  relatorio_aberto_em: null,
  tickets_abertos: 0,
  ...o,
})

const montar = () =>
  render(
    <MemoryRouter>
      <FilaHoje />
    </MemoryRouter>
  )

beforeEach(() => mutate.mockClear())

describe('FilaHoje', () => {
  test('vazia quando tudo tem próximo passo no futuro', () => {
    estado.itens = [item({ proxima_acao_em: dia(-5), proxima_acao: 'ligar' })]
    montar()
    expect(screen.getByText('Nada pendente para hoje')).toBeInTheDocument()
  })

  test('ação vencida aparece com o motivo, valor e os botões; adiar grava a data', () => {
    estado.itens = [item({ proxima_acao_em: dia(2), proxima_acao: 'Ligar para fechar', valor_estimado: 1497 })]
    montar()
    expect(screen.getByText('Venceu')).toBeInTheDocument()
    expect(screen.getByText(/Ligar para fechar — venceu há 2 dias/)).toBeInTheDocument()
    expect(screen.getByText(/1\.497/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Adiar 3 dias' }))
    expect(mutate).toHaveBeenCalledWith({ projectId: 'p1', campos: { proxima_acao_em: dia(-3) } })
  })

  test('"feito" pede a próxima ação e grava texto + data', () => {
    estado.itens = [item({ proxima_acao_em: dia(0), proxima_acao: 'Mandar proposta' })]
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Feito' }))
    fireEvent.change(screen.getByLabelText('Próxima ação'), { target: { value: 'Cobrar retorno' } })
    fireEvent.change(screen.getByLabelText('Até quando'), { target: { value: dia(-7) } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(mutate).toHaveBeenCalledWith({
      projectId: 'p1',
      campos: { proxima_acao: 'Cobrar retorno', proxima_acao_em: dia(-7) },
    })
  })

  test('sinal do Scan entra sem data combinada e explica o porquê', () => {
    estado.itens = [item({ comprou_plano: true, pediu_ajuda: 'não consigo aplicar o passo 3' })]
    montar()
    expect(screen.getByText('Sinais do Scan')).toBeInTheDocument()
    expect(screen.getByText(/comprou o plano · pediu ajuda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Combinar próximo passo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Correção da loja' })).toHaveAttribute('href', '/admin/projetos/p1')
  })
})
