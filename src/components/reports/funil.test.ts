import { describe, expect, it } from 'vitest'
import { etapasDoFunil, funilDePropostas, type PessoaNoFunil } from './funil'

const pessoa = (o: Partial<PessoaNoFunil>): PessoaNoFunil => ({
  email: 'x@y.z',
  origem: null,
  campanha: null,
  lead_em: null,
  relatorio_em: null,
  compra_em: null,
  reuniao_em: null,
  contratado_em: null,
  recorrencia_em: null,
  ...o,
})

describe('etapasDoFunil', () => {
  it('conta pessoas por etapa e converte etapa a etapa', () => {
    const etapas = etapasDoFunil([
      pessoa({ lead_em: 'a', relatorio_em: 'b', compra_em: 'c' }),
      pessoa({ lead_em: 'a', relatorio_em: 'b' }),
      pessoa({ lead_em: 'a' }),
      pessoa({ lead_em: 'a', relatorio_em: 'b', compra_em: 'c', reuniao_em: 'd', contratado_em: 'e' }),
    ])
    expect(etapas.map((e) => e.count)).toEqual([4, 3, 2, 1, 1, 0])
    expect(etapas.map((e) => e.conversao && Math.round(e.conversao))).toEqual([null, 75, 67, 50, 100, 0])
  })

  it('nunca passa de 100 % nem divide por zero', () => {
    const etapas = etapasDoFunil([pessoa({ compra_em: 'c' })])
    expect(etapas[0].count).toBe(0)
    expect(etapas[2].count).toBe(1)
    expect(etapas[2].conversao).toBeNull()
  })
})

describe('funilDePropostas', () => {
  it('um projeto com três propostas conta uma vez', () => {
    const r = funilDePropostas([
      { project_id: 'p1', sent_at: '2026-09-01', status: 'enviada' },
      { project_id: 'p1', sent_at: '2026-09-02', status: 'recusada' },
      { project_id: 'p1', sent_at: '2026-09-03', status: 'aceita' },
      { project_id: 'p2', sent_at: null, status: 'rascunho' },
    ])
    expect(r).toEqual({ projetos: 2, enviadas: 1, aceitas: 1 })
  })
})
