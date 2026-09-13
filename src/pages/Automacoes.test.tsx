import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { EntregaPendente, LinhaDeJobRun, LinhaDeJobStatus } from '../components/automacoes/automacoes'

const { estado, reprocessar } = vi.hoisted(() => ({
  estado: {
    status: [] as LinhaDeJobStatus[],
    runs: [] as LinhaDeJobRun[],
    pendentes: [] as EntregaPendente[],
  },
  reprocessar: vi.fn(),
}))
vi.mock('../components/automacoes/automacoesData', () => ({
  useJobStatus: () => ({ data: estado.status, isLoading: false, isError: false }),
  useJobRuns: () => ({ data: estado.runs, isLoading: false, isError: false }),
  useEntregasPendentes: () => ({ data: estado.pendentes, isLoading: false, isError: false }),
  useReprocessarEntrega: () => ({ mutate: reprocessar, isPending: false }),
}))

import Automacoes from './Automacoes'

const agora = Date.now()
const min = (n: number) => new Date(agora - n * 60_000).toISOString()

beforeEach(() => {
  estado.status = [
    { job: 'entregas-pendentes', origem: 'worker', ultimo_inicio: min(1), ultimo_ok: min(2), ultimo_erro: null, erro: null, itens: 0, updated_at: min(2) },
    { job: 'medicoes', origem: 'worker', ultimo_inicio: min(1), ultimo_ok: min(30), ultimo_erro: min(1), erro: 'PageSpeed 429', itens: null, updated_at: min(1) },
    { job: 'sequencia-emails', origem: 'worker', ultimo_inicio: min(50), ultimo_ok: min(50), ultimo_erro: null, erro: null, itens: 2, updated_at: min(50) },
  ]
  estado.runs = [
    { id: 'r1', job: 'lembretes-pagamento', status: 'ok', itens: 3, detalhe: '3 lembretes enviados', created_at: min(60) },
    { id: 'r2', job: 'lembretes-pagamento', status: 'erro', itens: 0, detalhe: 'SMTP', created_at: min(60 * 25) },
  ]
  estado.pendentes = [
    { tipo: 'pedido', id: '11111111-1111-4111-8111-111111111111', pago_em: min(90), cliente: 'Ana Silva', email: 'ana@x.com', valor: '197.00', faltando: 'plano e recibo', plano_code: null },
  ]
  reprocessar.mockReset()
})

describe('Automacoes', () => {
  test('lista quem pagou e não recebeu e manda reprocessar pelo tipo e id', () => {
    render(<Automacoes />)
    const linha = screen.getByTestId('pendente-11111111-1111-4111-8111-111111111111')
    expect(linha).toHaveTextContent('Ana Silva')
    expect(linha).toHaveTextContent('plano e recibo')
    expect(linha).toHaveTextContent('há 2 h')
    fireEvent.click(within(linha).getByRole('button', { name: /reprocessar/i }))
    expect(reprocessar).toHaveBeenCalledWith(
      { tipo: 'pedido', id: '11111111-1111-4111-8111-111111111111' },
      expect.anything()
    )
  })

  test('varreduras: rodando, falhou (com o erro), parada e sem registro', () => {
    render(<Automacoes />)
    expect(screen.getByTestId('rotina-entregas-pendentes')).toHaveTextContent('Rodando')
    const medicoes = screen.getByTestId('rotina-medicoes')
    expect(medicoes).toHaveTextContent('Falhou')
    expect(medicoes).toHaveTextContent('PageSpeed 429')
    expect(screen.getByTestId('rotina-sequencia-emails')).toHaveTextContent('Parada')
    expect(screen.getByTestId('rotina-reanalises')).toHaveTextContent('Sem registro')
    expect(screen.getByText('2 com problema')).toBeInTheDocument()
  })

  test('rotinas do banco: última execução, itens, falhas na janela e detalhe', () => {
    render(<Automacoes />)
    const cron = screen.getByTestId('cron-lembretes-pagamento')
    expect(cron).toHaveTextContent('Rodando')
    expect(cron).toHaveTextContent('há 1 h')
    expect(cron).toHaveTextContent('1 / 2')
    expect(cron).toHaveTextContent('3 lembretes enviados')
    expect(screen.getByTestId('cron-varredura-nudges')).toHaveTextContent('Sem registro')
  })

  test('sem pendências, diz que ninguém está esperando', () => {
    estado.pendentes = []
    render(<Automacoes />)
    expect(screen.getByText('Ninguém esperando entrega.')).toBeInTheDocument()
  })
})
