import { describe, expect, test } from 'vitest'
import { cac, chaveDaOrigem, porCampanha, resumoDaOrigem, tempoAteContratacao } from './origem'
import type { PessoaComReceita } from './origem'

const pessoa = (o: Partial<PessoaComReceita>): PessoaComReceita => ({
  email: 'a@x.com',
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

const PESSOAS: PessoaComReceita[] = [
  pessoa({ email: 'a', campanha: 'bf-2026', origem: 'ig', relatorio_em: 'x', compra_em: 'x', receita_plano: '197.00', contratado_em: '2026-08-11T10:00:00.000Z', receita_contratos: '1497.00' }),
  pessoa({ email: 'b', campanha: 'bf-2026', origem: 'ig', relatorio_em: 'x' }),
  pessoa({ email: 'c', campanha: null, origem: 'google', compra_em: 'x', receita_plano: 197 }),
  pessoa({ email: 'd', campanha: null, origem: null, contratado_em: '2026-08-31T10:00:00.000Z', receita_contratos: '5000' }),
  // Comprador do checkout sem lead: não tem origem para atribuir.
  pessoa({ email: 'e', lead_em: null, compra_em: 'x', receita_plano: '1497.00' }),
]

describe('porCampanha', () => {
  test('uma linha por campanha (ou origem, ou "direto"), com etapas, receita e taxas', () => {
    const linhas = porCampanha(PESSOAS, [
      { utm_campaign: 'bf-2026', utm_source: 'ig' },
      { utm_campaign: 'bf-2026', utm_source: 'ig' },
      { utm_campaign: 'bf-2026', utm_source: 'ig' },
      { utm_campaign: null, utm_source: 'google' },
      { utm_campaign: 'so-sessao', utm_source: 'fb' },
    ])
    expect(linhas.map((l) => l.campanha)).toEqual(['direto', 'bf-2026', 'google', 'so-sessao'])

    const bf = linhas[1]
    expect(bf).toMatchObject({ origem: 'ig', sessoes: 3, leads: 2, relatorios: 2, compras: 1, contratos: 1, receita: 1694 })
    expect(bf.receitaPorLead).toBe(847)
    expect(bf.conversaoCompra).toBe(0.5)
    expect(bf.conversaoContrato).toBe(0.5)

    const direto = linhas[0]
    expect(direto).toMatchObject({ leads: 1, contratos: 1, receita: 5000, sessoes: 0 })

    // Campanha só com sessão aparece zerada — é o que se quer enxergar.
    expect(linhas[3]).toMatchObject({ sessoes: 1, leads: 0, receita: 0, receitaPorLead: null })
  })

  test('sem sessões e sem pessoas, lista vazia', () => {
    expect(porCampanha([])).toEqual([])
  })
})

describe('chaveDaOrigem', () => {
  test('campanha > origem > direto, ignorando espaços', () => {
    expect(chaveDaOrigem(' bf ', 'ig')).toBe('bf')
    expect(chaveDaOrigem('', 'ig')).toBe('ig')
    expect(chaveDaOrigem(null, '  ')).toBe('direto')
  })
})

describe('tempoAteContratacao', () => {
  test('mediana e média em dias inteiros, só de quem contratou', () => {
    expect(tempoAteContratacao(PESSOAS)).toEqual({ n: 2, medianaDias: 20, mediaDias: 20 })
    expect(tempoAteContratacao([pessoa({})])).toEqual({ n: 0, medianaDias: null, mediaDias: null })
  })
})

describe('cac / resumoDaOrigem', () => {
  test('CAC só com gasto e conversão', () => {
    expect(cac(1000, 4)).toBe(250)
    expect(cac(0, 4)).toBeNull()
    expect(cac(1000, 0)).toBeNull()
  })

  test('resumo conta só quem passou por lead e divide o gasto pelas compras e pelos contratos', () => {
    const r = resumoDaOrigem(PESSOAS, 1200)
    expect(r).toMatchObject({ leads: 4, compras: 2, contratos: 2, receita: 6891, gasto: 1200 })
    expect(r.receitaPorLead).toBeCloseTo(1722.75, 2)
    expect(r.cac).toBe(600)
    expect(r.cacContrato).toBe(600)
    expect(r.retorno).toBeCloseTo(5.7425, 3)
    expect(resumoDaOrigem(PESSOAS, 0).cac).toBeNull()
  })
})
