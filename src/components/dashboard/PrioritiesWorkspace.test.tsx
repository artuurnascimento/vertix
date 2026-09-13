import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { CartaoDePrioridade } from './prioridades'

const { estado, resolver, atualizar } = vi.hoisted(() => ({
  estado: { cartoes: [] as CartaoDePrioridade[], isLoading: false, isError: false },
  resolver: vi.fn(),
  atualizar: vi.fn(),
}))
vi.mock('./prioridadesData', () => ({
  usePrioridades: () => estado,
  useResolverNudge: () => ({ mutate: resolver, isPending: false }),
}))
vi.mock('../comercial/comercialData', () => ({
  useAtualizarComercial: () => ({ mutate: atualizar, isPending: false }),
}))

import PrioritiesWorkspace from './PrioritiesWorkspace'
import { hojeLocal, somarDias } from '../comercial/fila'

const CARTOES: CartaoDePrioridade[] = [
  {
    chave: 'cliente:c1',
    clientId: 'c1',
    projectId: 'p1',
    nome: 'Ana Silva',
    prioridade: 9,
    valor: 8200,
    porque: 'R$ 3.200 vencidos há 4 dias — Parcela 2 · +2',
    link: '/admin/clientes/c1',
    motivos: [
      { chave: 'recebivel:r1', tipo: 'recebivel_vencido', texto: 'R$ 3.200 vencidos há 4 dias — Parcela 2', urgencia: 4, valor: 3200, intencao: 1, link: '/admin/financeiro?abrir=r1' },
      { chave: 'proposta:pr1', tipo: 'proposta_sem_resposta', texto: 'proposta de R$ 5.000 sem resposta há 3 dias', urgencia: 3, valor: 5000, intencao: 1, link: '/admin/propostas?abrir=pr1' },
      { chave: 'nudge:n1', tipo: 'nudge', texto: 'Projeto parado — sem atividade há 10 dias', urgencia: 10, valor: 0, intencao: 1, link: '/admin/projetos/p1', nudgeId: 'n1' },
    ],
  },
  {
    chave: 'projeto:p3',
    clientId: null,
    projectId: 'p3',
    nome: 'Projeto órfão',
    prioridade: 1,
    valor: 0,
    porque: 'Onboarding parado',
    link: '/admin/projetos/p3',
    motivos: [
      { chave: 'nudge:n2', tipo: 'nudge', texto: 'Onboarding parado', urgencia: 1, valor: 0, intencao: 0.5, link: '/admin/projetos/p3', nudgeId: 'n2' },
    ],
  },
]

function montar() {
  return render(
    <MemoryRouter>
      <PrioritiesWorkspace />
    </MemoryRouter>
  )
}

beforeEach(() => {
  estado.cartoes = CARTOES
  estado.isLoading = false
  estado.isError = false
  resolver.mockReset()
  atualizar.mockReset()
})

describe('PrioritiesWorkspace', () => {
  test('um cartão por cliente, numerado, com valor, o porquê e o link de abrir o cliente', () => {
    montar()
    const cartoes = screen.getAllByTestId('cartao-prioridade')
    expect(cartoes).toHaveLength(2)
    expect(cartoes[0]).toHaveTextContent('1')
    expect(cartoes[0]).toHaveTextContent('Ana Silva')
    expect(cartoes[0]).toHaveTextContent('R$ 3.200 vencidos há 4 dias — Parcela 2 · +2')
    expect(within(cartoes[0]).getByRole('link', { name: 'Abrir Ana Silva' })).toHaveAttribute('href', '/admin/clientes/c1')
    expect(within(cartoes[1]).getByRole('link', { name: 'Abrir Projeto órfão' })).toHaveAttribute('href', '/admin/projetos/p3')
  })

  test('expandir mostra os motivos com link próprio e "Resolver" só no que é nudge', () => {
    montar()
    const ana = screen.getAllByTestId('cartao-prioridade')[0]
    expect(within(ana).queryByText('proposta de R$ 5.000 sem resposta há 3 dias')).not.toBeInTheDocument()

    fireEvent.click(within(ana).getByRole('button', { name: /ver os 3 motivos/i }))
    expect(within(ana).getByRole('link', { name: 'proposta de R$ 5.000 sem resposta há 3 dias' })).toHaveAttribute(
      'href',
      '/admin/propostas?abrir=pr1'
    )
    const botoes = within(ana).getAllByRole('button', { name: 'Resolver' })
    expect(botoes).toHaveLength(1)
    fireEvent.click(botoes[0])
    expect(resolver).toHaveBeenCalledWith('n1')
  })

  test('cartão com um só motivo de nudge tem "Resolver" direto', () => {
    montar()
    const orfao = screen.getAllByTestId('cartao-prioridade')[1]
    fireEvent.click(within(orfao).getByRole('button', { name: 'Resolver' }))
    expect(resolver).toHaveBeenCalledWith('n2')
  })

  test('+3d agenda o retorno no projeto do cartão', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Agendar retorno em 3 dias para Ana Silva' }))
    expect(atualizar).toHaveBeenCalledWith({
      projectId: 'p1',
      campos: { proxima_acao_em: somarDias(hojeLocal(), 3) },
    })
  })

  test('sem cartões, "Tudo em dia"', () => {
    estado.cartoes = []
    montar()
    expect(screen.getByText('Tudo em dia')).toBeInTheDocument()
  })
})
