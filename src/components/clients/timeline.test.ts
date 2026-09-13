import { describe, expect, test } from 'vitest'
import { agruparPorMes, filtrarPorGrupo, formatarQuando, metaDoEvento, normalizarEventos } from './timeline'

const LINHAS = [
  { quando: '2026-09-10T14:30:00+00:00', tipo: 'proposta_enviada', titulo: 'Proposta enviada: Loja', detalhe: 'R$ 1.200,00', link: '/admin/propostas?abrir=p1', ref_id: 'p1' },
  { quando: '2026-09-02T00:00:00+00:00', tipo: 'recebivel_vencido', titulo: 'Cobrança vencida: Parcela 1', detalhe: '', link: '/admin/financeiro?abrir=r1', ref_id: 'r1' },
  { quando: '2026-08-20T09:00:00+00:00', tipo: 'analise', titulo: 'Analisou a loja no Scan', detalhe: 'loja.com · nota 5,4', link: 'javascript:alert(1)', ref_id: 'a1' },
  { quando: 'ontem', tipo: 'lead', titulo: 'Sem data válida', detalhe: null, link: null, ref_id: 'l1' },
  { quando: '2026-08-01T09:00:00+00:00', tipo: 'lead', titulo: '   ', detalhe: null, link: null, ref_id: 'l2' },
]

describe('normalizarEventos', () => {
  test('descarta data inválida e título vazio; detalhe vazio vira null; link só se for caminho interno', () => {
    const eventos = normalizarEventos(LINHAS)
    expect(eventos.map((e) => e.id)).toEqual(['proposta_enviada:p1', 'recebivel_vencido:r1', 'analise:a1'])
    expect(eventos[1].detalhe).toBeNull()
    expect(eventos[2].link).toBeNull()
    expect(eventos[0].link).toBe('/admin/propostas?abrir=p1')
    expect(normalizarEventos(null)).toEqual([])
  })
})

describe('metaDoEvento / filtrarPorGrupo', () => {
  test('cada tipo tem grupo e tom; tipo desconhecido não quebra', () => {
    expect(metaDoEvento('recebivel_vencido')).toEqual({ grupo: 'dinheiro', tom: 'alerta' })
    expect(metaDoEvento('proposta_aceita')).toEqual({ grupo: 'venda', tom: 'positivo' })
    expect(metaDoEvento('tipo_novo')).toEqual({ grupo: 'entrega', tom: 'neutro' })
  })

  test('filtra pelo grupo; "tudo" devolve cópia de tudo', () => {
    const eventos = normalizarEventos(LINHAS)
    expect(filtrarPorGrupo(eventos, 'dinheiro').map((e) => e.tipo)).toEqual(['recebivel_vencido'])
    expect(filtrarPorGrupo(eventos, 'captacao').map((e) => e.tipo)).toEqual(['analise'])
    const tudo = filtrarPorGrupo(eventos, 'tudo')
    expect(tudo).toEqual(eventos)
    expect(tudo).not.toBe(eventos)
  })
})

describe('agruparPorMes', () => {
  test('mais recente primeiro, um grupo por mês com rótulo em português', () => {
    const meses = agruparPorMes(normalizarEventos(LINHAS))
    expect(meses.map((m) => [m.chave, m.rotulo, m.eventos.length])).toEqual([
      ['2026-09', 'Setembro de 2026', 2],
      ['2026-08', 'Agosto de 2026', 1],
    ])
    expect(meses[0].eventos[0].tipo).toBe('proposta_enviada')
  })
})

describe('formatarQuando', () => {
  test('dia curto; hora só quando não é meia-noite', () => {
    // Datas locais para não depender do fuso da máquina.
    expect(formatarQuando(new Date(2026, 8, 10, 14, 30).toISOString())).toEqual({ dia: '10 set', hora: '14:30' })
    expect(formatarQuando(new Date(2026, 8, 2, 0, 0).toISOString())).toEqual({ dia: '02 set', hora: null })
  })
})
