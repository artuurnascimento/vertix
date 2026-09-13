import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * Os quatro cards com dados de dois meses, para a variação e os gráficos
 * terem o que mostrar. As datas são relativas a hoje: o teste não pode
 * quebrar quando o mês virar.
 */
const hoje = new Date()
const mes = (recuo: number) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - recuo, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
}
const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false })

const { estado } = vi.hoisted(() => ({
  estado: { pedidosComErro: false },
}))

vi.mock('./useDashboardData', () => ({
  useDashboardReceivables: () =>
    ok([
      { id: 'r1', valor: 24800, status: 'pago', pago_em: mes(0) },
      { id: 'r2', valor: 22143, status: 'pago', pago_em: mes(1) },
      { id: 'r3', valor: 999, status: 'pendente', pago_em: null },
    ]),
  useDashboardProposals: () =>
    ok([
      { id: 'p1', status: 'enviada', valor_total: 38400, sent_at: mes(0), created_at: mes(0) },
      { id: 'p2', status: 'enviada', valor_total: 35556, sent_at: mes(1), created_at: mes(1) },
      { id: 'p3', status: 'aceita', valor_total: 9999, sent_at: mes(0), created_at: mes(0) },
    ]),
  useDashboardPedidos: () =>
    estado.pedidosComErro
      ? { data: undefined, isLoading: false, isError: true }
      : ok([
          ...Array.from({ length: 34 }, (_, i) => ({ id: `a${i}`, status: 'pago', created_at: mes(0), total_centavos: 19700 })),
          ...Array.from({ length: 27 }, (_, i) => ({ id: `b${i}`, status: 'pago', created_at: mes(1), total_centavos: 19700 })),
          { id: 'x', status: 'aguardando', created_at: mes(0), total_centavos: 19700 },
        ]),
  useDashboardProjects: () =>
    ok([
      ...Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, status: 'em_desenvolvimento' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `v${i}`, status: 'revisao' })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, status: 'entregue' })),
    ]),
}))

import ExecutiveMetrics from './ExecutiveMetrics'

const montar = () =>
  render(
    <MemoryRouter>
      <ExecutiveMetrics />
    </MemoryRouter>
  )

afterEach(() => {
  estado.pedidosComErro = false
})

describe('ExecutiveMetrics', () => {
  test('receita do mês com variação verde e as barras 3D dos meses', () => {
    montar()
    // O Intl separa "R$" do número com espaço fixo; o regex não se importa.
    const card = screen.getByRole('link', { name: /^Receita do mês: R\$.24\.800,00$/ })
    expect(within(card).getByTitle(/24\.800,00/)).toHaveTextContent(/R\$.24\.800/)
    expect(within(card).getByText('12%', { exact: false })).toHaveClass('vx-variacao-verde')
    expect(within(card).getByText('em relação ao mês anterior')).toBeInTheDocument()
    const barras = within(card).getByRole('img')
    expect(barras).toHaveClass('vx-barras-prisma')
    expect(barras.getAttribute('aria-label')).toMatch(/24\.800,00/)
    expect(barras.getAttribute('aria-label')).toMatch(/22\.143,00/)
  })

  test('em negociação com variação roxa e barras rotuladas por mês', () => {
    montar()
    const card = screen.getByRole('link', { name: /^Em negociação: R\$.38\.400,00$/ })
    expect(within(card).getByText('8%', { exact: false })).toHaveClass('vx-variacao-roxo')
    const barras = within(card).getByRole('img')
    expect(barras).toHaveClass('vx-barras-rotuladas')
    expect(barras.querySelectorAll('em')).toHaveLength(6)
  })

  test('planos vendidos conta os pedidos pagos, com variação ciano e gráfico de linha', () => {
    montar()
    const card = screen.getByRole('link', { name: 'Planos vendidos: 34' })
    expect(within(card).getByText('26%', { exact: false })).toHaveClass('vx-variacao-ciano')
    const linha = within(card).getByRole('img')
    expect(linha).toHaveClass('vx-linha')
    expect(linha.querySelectorAll('circle')).toHaveLength(6)
    expect(card).toHaveAttribute('href', '/admin/pedidos')
  })

  test('projetos ativos mostra o donut com a legenda por etapa', () => {
    montar()
    const card = screen.getByRole('link', { name: 'Projetos ativos: 12' })
    const donut = within(card).getByRole('img')
    expect(donut.getAttribute('aria-label')).toBe(
      '12 projetos ativos — Em andamento: 8; Em revisão: 4; Concluídos: 3'
    )
    expect(within(card).getByText('4 em revisão')).toBeInTheDocument()
    const legenda = within(card).getAllByRole('listitem').map((li) => li.textContent?.trim())
    expect(legenda).toEqual(['Em andamento 8', 'Em revisão 4', 'Concluídos 3'])
  })

  test('um card com erro avisa sem derrubar os outros', () => {
    estado.pedidosComErro = true
    montar()
    const card = screen.getByRole('link', { name: 'Planos vendidos: Indisponível' })
    expect(within(card).getByRole('alert')).toHaveTextContent('Dados indisponíveis')
    expect(screen.getByRole('link', { name: 'Projetos ativos: 12' })).toBeInTheDocument()
  })
})
