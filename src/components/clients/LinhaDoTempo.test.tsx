import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { EventoDaLinha } from './timeline'

const { estado } = vi.hoisted(() => ({
  estado: { eventos: [] as EventoDaLinha[], carregando: false, erro: false },
}))
vi.mock('./timelineData', () => ({
  useLinhaDoTempo: () => ({ data: estado.eventos, isLoading: estado.carregando, isError: estado.erro }),
}))

import LinhaDoTempo from './LinhaDoTempo'

const EVENTOS: EventoDaLinha[] = [
  { id: 'e1', quando: '2026-09-10T14:30:00.000Z', tipo: 'proposta_enviada', titulo: 'Proposta enviada: Loja', detalhe: 'R$ 1.200,00', link: '/admin/propostas?abrir=p1' },
  { id: 'e2', quando: '2026-09-02T00:00:00.000Z', tipo: 'recebivel_vencido', titulo: 'Cobrança vencida: Parcela 1', detalhe: 'R$ 400,00 · há 11 dias', link: '/admin/financeiro?abrir=r1' },
  { id: 'e3', quando: '2026-08-20T09:00:00.000Z', tipo: 'analise', titulo: 'Analisou a loja no Scan', detalhe: 'loja.com · nota 5,4', link: null },
]

function montar() {
  return render(
    <MemoryRouter>
      <LinhaDoTempo clientId="c1" />
    </MemoryRouter>
  )
}

beforeEach(() => {
  estado.eventos = EVENTOS
  estado.carregando = false
  estado.erro = false
})

describe('LinhaDoTempo', () => {
  test('agrupa por mês, mostra título, detalhe e o link de abrir só quando há', () => {
    montar()
    expect(screen.getByText('Setembro de 2026')).toBeInTheDocument()
    expect(screen.getByText('Agosto de 2026')).toBeInTheDocument()

    const proposta = screen.getByText('Proposta enviada: Loja').closest('li') as HTMLElement
    expect(proposta).toHaveTextContent('R$ 1.200,00')
    expect(within(proposta).getByRole('link', { name: 'Abrir: Proposta enviada: Loja' })).toHaveAttribute(
      'href',
      '/admin/propostas?abrir=p1'
    )

    const analise = screen.getByText('Analisou a loja no Scan').closest('li') as HTMLElement
    expect(within(analise).queryByRole('link')).not.toBeInTheDocument()
  })

  test('os filtros contam e filtram por grupo', () => {
    montar()
    const dinheiro = screen.getByRole('tab', { name: /dinheiro/i })
    expect(dinheiro).toHaveTextContent('1')
    fireEvent.click(dinheiro)
    expect(dinheiro).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Cobrança vencida: Parcela 1')).toBeInTheDocument()
    expect(screen.queryByText('Proposta enviada: Loja')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /relacionamento/i }))
    expect(screen.getByText('Nada neste grupo.')).toBeInTheDocument()
  })

  test('sem eventos explica o que vai aparecer', () => {
    estado.eventos = []
    montar()
    expect(screen.getByText(/Nada registrado ainda/)).toBeInTheDocument()
  })

  test('erro de carga não vira tela em branco', () => {
    estado.erro = true
    montar()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a linha do tempo')
  })
})
