import { describe, expect, test, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AoVivoTab from './AoVivoTab'
import type { EventoAoVivo, SessaoAoVivo } from './aoVivoResumo'

/**
 * Testes da aba "Ao vivo" com o hook de dados substituído: o que entra é o
 * que o Realtime/PostgREST entregariam; o que se testa é o que a equipe vê.
 */

const AGORA = new Date('2026-09-14T15:00:00Z')
const iso = (segundosAtras: number) =>
  new Date(AGORA.getTime() - segundosAtras * 1000).toISOString()

function sessao(over: Partial<SessaoAoVivo> = {}): SessaoAoVivo {
  return {
    id: 'a1',
    checkout_id: 'c1',
    visitante_id: null,
    iniciado_em: iso(120),
    ultimo_evento_em: iso(10),
    encerrada_em: null,
    visivel: true,
    etapa: 'chegou',
    secao: null,
    foco: null,
    dados_em: null,
    pagar_em: null,
    pagamento_em: null,
    aprovado_em: null,
    obrigado_em: null,
    interagiu_em: iso(100),
    bot: false,
    bot_motivo: null,
    nome: null,
    email: null,
    whatsapp: null,
    documento_preenchido: false,
    metodo: null,
    bump: false,
    cupom: null,
    total_centavos: null,
    pedido_id: null,
    dispositivo: 'celular',
    navegador: 'Instagram',
    so: 'iOS',
    largura: 390,
    altura: 844,
    agente: null,
    referrer: 'https://l.instagram.com/',
    utm: {},
    cidade: 'Curitiba',
    estado: 'PR',
    pais: 'BR',
    latitude: null,
    longitude: null,
    eventos: 3,
    updated_at: iso(10),
    ...over,
  }
}

const SESSOES: SessaoAoVivo[] = [
  sessao({
    id: 'maria',
    nome: 'Maria Souza',
    email: 'maria@exemplo.com',
    etapa: 'pagamento',
    secao: 'pagamento',
    foco: 'cartao',
    dados_em: iso(60),
    metodo: 'cartao',
    bump: true,
    total_centavos: 24400,
  }),
  sessao({
    id: 'joao',
    email: 'joao@exemplo.com',
    etapa: 'concluido',
    dados_em: iso(300),
    pagar_em: iso(280),
    aprovado_em: iso(270),
    obrigado_em: iso(260),
    pedido_id: 'p1',
    ultimo_evento_em: iso(250),
    cidade: 'Recife',
    estado: 'PE',
  }),
  sessao({ id: 'preview', bot: true, bot_motivo: 'agente', interagiu_em: null }),
]

const EVENTOS: EventoAoVivo[] = [
  {
    id: 1,
    sessao_id: 'maria',
    tipo: 'entrou',
    dados: { referrer: 'https://l.instagram.com/', dispositivo: 'celular', navegador: 'Instagram' },
    criado_em: iso(120),
  },
  { id: 2, sessao_id: 'maria', tipo: 'olhou', dados: { secao: 'resumo' }, criado_em: iso(110) },
  { id: 3, sessao_id: 'maria', tipo: 'bump', dados: { marcado: true }, criado_em: iso(90) },
  { id: 4, sessao_id: 'maria', tipo: 'preencheu', dados: { campo: 'email' }, criado_em: iso(60) },
  { id: 5, sessao_id: 'maria', tipo: 'digitando', dados: { campo: 'cartao' }, criado_em: iso(10) },
]

const estado = {
  sessoes: { data: SESSOES, isLoading: false, isError: false },
  eventos: { data: EVENTOS, isLoading: false },
  pedidos: new Map([['p1', { status: 'pago', total_centavos: 24400 }]]),
  agora: AGORA,
  selecionada: null as string | null,
  setSelecionada: vi.fn((id: string | null) => {
    estado.selecionada = id
  }),
  conectado: true,
}

vi.mock('./useAoVivo', () => ({
  useAoVivo: () => estado,
}))

function renderizar() {
  return render(
    <MemoryRouter>
      <AoVivoTab nomesDosCheckouts={new Map([['c1', 'Plano de Correção']])} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  estado.selecionada = null
})

describe('AoVivoTab', () => {
  test('os números do topo e o funil contam só gente; o bot fica escondido', () => {
    renderizar()
    expect(screen.getByText('Ao vivo')).toBeInTheDocument()
    expect(screen.getByText('Na página agora').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Visitas · 24 h').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Compraram · 24 h').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Receita · 24 h').parentElement).toHaveTextContent('244,00')

    const funil = screen.getByRole('list', { name: 'Funil das últimas 24 horas' })
    expect(within(funil).getByText('Chegaram').parentElement).toHaveTextContent('2')
    expect(within(funil).getByText('Compraram').parentElement).toHaveTextContent('1')

    const visitas = screen.getByRole('list', { name: 'Visitas' })
    expect(within(visitas).getAllByRole('listitem')).toHaveLength(2)
    expect(within(visitas).getByText('Maria Souza')).toBeInTheDocument()
    expect(within(visitas).getByText('Digitando o cartão')).toBeInTheDocument()
    expect(within(visitas).getByText(/Curitiba · PR/)).toBeInTheDocument()
    expect(within(visitas).getByText('Comprou · Concluiu a compra')).toBeInTheDocument()
    expect(within(visitas).queryByText('bot')).not.toBeInTheDocument()
  })

  test('"Mostrar bots" traz a visita do crawler, marcada e com o motivo', async () => {
    renderizar()
    await userEvent.click(screen.getByLabelText('Mostrar bots (1)'))
    const visitas = screen.getByRole('list', { name: 'Visitas' })
    expect(within(visitas).getAllByRole('listitem')).toHaveLength(3)
    expect(within(visitas).getByText('bot')).toHaveAttribute(
      'title',
      'agente de crawler ou preview de link'
    )
  })

  test('abrir uma visita mostra onde ela está olhando e o passo a passo', async () => {
    renderizar()
    await userEvent.click(screen.getByRole('button', { name: /Maria Souza/ }))
    expect(estado.setSelecionada).toHaveBeenCalledWith('maria')

    estado.selecionada = 'maria'
    renderizar()
    const detalhe = screen.getByRole('region', { name: 'Detalhe da visita' })
    expect(within(detalhe).getByRole('heading', { name: 'Maria Souza' })).toBeInTheDocument()
    expect(within(detalhe).getByText('Plano de Correção')).toBeInTheDocument()

    const mapa = within(detalhe).getByRole('list', { name: 'Seções do checkout' })
    const acesa = within(mapa).getByText('Pagamento').closest('li') as HTMLElement
    expect(acesa).toHaveAttribute('aria-current', 'location')
    expect(within(acesa).getByText('digitando')).toBeInTheDocument()

    const passos = within(detalhe).getByRole('list', { name: 'Linha do tempo da visita' })
    const textos = within(passos)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(textos[0]).toMatch(/Chegou · Instagram/)
    expect(textos[2]).toMatch(/Marcou o order bump/)
    expect(textos[4]).toMatch(/Começou a digitar o cartão/)
  })
})
