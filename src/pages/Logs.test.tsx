import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { LinhaDeLog } from '../components/logsPainel/logs'

const { estado } = vi.hoisted(() => ({
  estado: { linhas: [] as LinhaDeLog[], resumo: [] as Array<{ nivel: string; fonte: string; ocorrencias: number }> },
}))
vi.mock('../components/logsPainel/logsData', () => ({
  useLogs: () => ({ data: estado.linhas, isLoading: false, isError: false, error: null }),
  useResumo24h: () => ({ data: estado.resumo, isLoading: false, isError: false }),
  useLogsAoVivo: () => {},
}))

import Logs from './Logs'

const agora = Date.now()
const min = (n: number) => new Date(agora - n * 60_000).toISOString()

function linha(over: Partial<LinhaDeLog>): LinhaDeLog {
  return {
    id: 1, criado_em: min(5), ultima_em: min(5), ocorrencias: 1, nivel: 'erro', origem: 'navegador', fonte: 'CheckoutPage',
    evento: 'render_quebrou', mensagem: 'TypeError: x', detalhes: {}, contexto: {}, requisicao_id: null, sessao_id: null,
    usuario_id: null, versao: 'abc', impressao: 'h', ...over,
  }
}

function montar(rota = '/admin/logs') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Logs />
    </MemoryRouter>
  )
}

beforeEach(() => {
  estado.linhas = [
    linha({ id: 1, mensagem: 'TypeError: x is undefined', ocorrencias: 3, detalhes: { stack: 'at a' }, contexto: { rota: '/c/plano-correcao', migalhas: [{ t: 1200, tipo: 'clique', texto: 'button: Pagar' }] }, requisicao_id: 'req-1', sessao_id: 'c3cbeaf4-1111-4111-8111-111111111111' }),
    linha({ id: 2, nivel: 'aviso', origem: 'edge', fonte: 'checkout-pagar', evento: 'resposta_4xx', mensagem: 'Respondeu 402', requisicao_id: 'req-1' }),
    linha({ id: 3, nivel: 'info', fonte: 'migracao', evento: 'x', mensagem: 'não aparece por padrão' }),
  ]
  estado.resumo = [
    { nivel: 'erro', fonte: 'CheckoutPage', ocorrencias: 3 },
    { nivel: 'fatal', fonte: 'PagarPage', ocorrencias: 1 },
    { nivel: 'aviso', fonte: 'checkout-pagar', ocorrencias: 7 },
  ]
})

describe('Logs', () => {
  test('mostra os números das 24 h e a lista com os níveis padrão (sem info)', () => {
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Logs' })).toBeInTheDocument()
    const lista = screen.getByRole('region', { name: 'Lista de logs' })
    expect(within(lista).getByText('TypeError: x is undefined')).toBeInTheDocument()
    expect(within(lista).getByText('Respondeu 402')).toBeInTheDocument()
    expect(within(lista).queryByText('não aparece por padrão')).not.toBeInTheDocument()
    expect(within(lista).getByText('×3')).toBeInTheDocument()
    expect(screen.getByText('Erros · 24 h').nextElementSibling).toHaveTextContent('3')
    expect(screen.getByText('Fatais · 24 h').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Fontes com erro').nextElementSibling).toHaveTextContent('2')
  })

  test('ligar o nível Info traz a linha de info', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Info' }))
    expect(within(screen.getByRole('region', { name: 'Lista de logs' })).getByText('não aparece por padrão')).toBeInTheDocument()
  })

  test('a URL manda: ?fonte=checkout-pagar mostra só essa fonte', () => {
    montar('/admin/logs?fonte=checkout-pagar')
    const lista = screen.getByRole('region', { name: 'Lista de logs' })
    expect(within(lista).getByText('Respondeu 402')).toBeInTheDocument()
    expect(within(lista).queryByText('TypeError: x is undefined')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Fonte') as HTMLSelectElement).value).toBe('checkout-pagar')
  })

  test('clicar numa linha abre o detalhe com stack, migalhas, relacionadas e o link do Ao vivo', () => {
    montar()
    fireEvent.click(screen.getByText('TypeError: x is undefined'))
    const detalhe = screen.getByRole('complementary', { name: 'Detalhe do log' })
    expect(within(detalhe).getByText(/"stack": "at a"/)).toBeInTheDocument()
    expect(within(detalhe).getByText('button: Pagar')).toBeInTheDocument()
    expect(within(detalhe).getByText('req-1')).toBeInTheDocument()
    // A linha da edge com a mesma requisição aparece como relacionada.
    expect(within(detalhe).getByText('Respondeu 402')).toBeInTheDocument()
    expect(within(detalhe).getByRole('link', { name: /Ver esta visita no Ao vivo/ })).toHaveAttribute('href', '/admin/checkouts?checkout=plano-correcao')
    fireEvent.click(within(detalhe).getByRole('button', { name: 'Fechar detalhe' }))
    expect(screen.queryByRole('complementary', { name: 'Detalhe do log' })).not.toBeInTheDocument()
  })

  test('a busca vai para a URL ao enviar', () => {
    montar()
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'undefined' } })
    fireEvent.submit(screen.getByLabelText('Buscar').closest('form') as HTMLFormElement)
    const lista = screen.getByRole('region', { name: 'Lista de logs' })
    expect(within(lista).getByText('TypeError: x is undefined')).toBeInTheDocument()
    expect(within(lista).queryByText('Respondeu 402')).not.toBeInTheDocument()
  })
})
