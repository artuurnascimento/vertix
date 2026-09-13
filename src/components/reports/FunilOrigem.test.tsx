import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { PessoaComReceita, SessaoResumida } from './origem'

const { estado } = vi.hoisted(() => ({
  estado: {
    pessoas: [] as PessoaComReceita[],
    sessoes: [] as SessaoResumida[],
    gasto: 0,
    erro: false,
  },
}))
vi.mock('./useReportsData', () => ({
  useFunilPessoas: () => ({ data: estado.pessoas, isLoading: false, isError: estado.erro }),
  useSessoesUtm: () => ({ data: estado.sessoes, isLoading: false, isError: false }),
  useGastoEmAnuncios: () => ({ data: estado.gasto, isLoading: false, isError: false }),
}))

import FunilOrigem from './FunilOrigem'

/** `Intl` usa espaço fino entre "R$" e o número; o teste compara texto comum. */
const texto = (t: string | null) => (t ?? '').replace(/ /g, ' ')

const pessoa = (o: Partial<PessoaComReceita>): PessoaComReceita => ({
  email: 'x',
  origem: null,
  campanha: null,
  lead_em: '2026-08-01T10:00:00.000Z',
  relatorio_em: null,
  compra_em: null,
  reuniao_em: null,
  contratado_em: null,
  recorrencia_em: null,
  receita_plano: '0.00',
  receita_contratos: '0.00',
  ...o,
})

beforeEach(() => {
  estado.pessoas = [
    pessoa({ email: 'a', campanha: 'bf-2026', origem: 'ig', compra_em: 'x', receita_plano: '197.00', contratado_em: '2026-08-21T10:00:00.000Z', receita_contratos: '1497.00' }),
    pessoa({ email: 'b', campanha: 'bf-2026', origem: 'ig' }),
    pessoa({ email: 'c', origem: 'google', compra_em: 'x', receita_plano: '197.00' }),
  ]
  estado.sessoes = [
    { utm_campaign: 'bf-2026', utm_source: 'ig' },
    { utm_campaign: 'bf-2026', utm_source: 'ig' },
    { utm_campaign: null, utm_source: 'google' },
  ]
  estado.gasto = 800
  estado.erro = false
})

describe('FunilOrigem', () => {
  test('KPIs: receita por lead, CAC do plano e da implementação, tempo lead → contrato', () => {
    render(<FunilOrigem />)
    const kpis = screen.getAllByRole('definition').map((el) => texto(el.textContent))
    // receita 1891 ÷ 3 leads; gasto 800 ÷ 2 compras; 800 ÷ 1 contrato; 20 dias.
    expect(kpis).toEqual(expect.arrayContaining(['R$ 630,33', 'R$ 400,00', 'R$ 800,00', '20 dias']))
    expect(kpis).toEqual(expect.arrayContaining(['R$ 800,00 ÷ 2 compras']))
  })

  test('uma linha por campanha com sessões, etapas, taxas e receita', () => {
    render(<FunilOrigem />)
    const bf = screen.getByTestId('campanha-bf-2026')
    const celulas = within(bf).getAllByRole('cell').map((c) => texto(c.textContent))
    expect(celulas).toEqual(['bf-2026ig', '2', '2', '150%', '150%', 'R$ 1.694,00', 'R$ 847,00'])

    const google = screen.getByTestId('campanha-google')
    expect(within(google).getAllByRole('cell').map((c) => texto(c.textContent))).toEqual([
      'google',
      '1',
      '1',
      '1100%',
      '00%',
      'R$ 197,00',
      'R$ 197,00',
    ])
  })

  test('sem gasto em anúncios o CAC fica em branco e diz por quê', () => {
    estado.gasto = 0
    render(<FunilOrigem />)
    expect(screen.getAllByText('sem gasto em anúncios')).toHaveLength(2)
  })

  test('sem sessões nem leads, estado vazio explicativo', () => {
    estado.pessoas = []
    estado.sessoes = []
    render(<FunilOrigem />)
    expect(screen.getByText('Sem tráfego rastreado')).toBeInTheDocument()
  })
})
