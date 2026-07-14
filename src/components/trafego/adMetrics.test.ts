import { describe, expect, test } from 'vitest'
import {
  aggregateCurrentMonth,
  cpc,
  cpm,
  ctr,
  formatDerived,
  roas,
} from './adMetrics'
import type { DailyMetric } from './adMetrics'

function dia(data: string, gasto: number, extras?: Partial<DailyMetric>): DailyMetric {
  return {
    data,
    gasto,
    impressoes: extras?.impressoes ?? 0,
    cliques: extras?.cliques ?? 0,
    conversoes: extras?.conversoes ?? 0,
    receita: extras?.receita ?? 0,
  }
}

describe('roas/cpm/cpc/ctr', () => {
  test('roas calcula receita sobre gasto', () => {
    expect(roas(100, 450)).toBe(4.5)
  })

  test('roas devolve null com gasto zero (indefinido, não Infinity)', () => {
    expect(roas(0, 450)).toBeNull()
  })

  test('cpm por mil impressões', () => {
    expect(cpm(50, 10_000)).toBe(5)
  })

  test('cpm e cpc devolvem null sem denominador', () => {
    expect(cpm(50, 0)).toBeNull()
    expect(cpc(50, 0)).toBeNull()
  })

  test('cpc divide gasto por cliques', () => {
    expect(cpc(30, 60)).toBe(0.5)
  })

  test('ctr em porcentagem e null sem impressões', () => {
    expect(ctr(25, 1000)).toBe(2.5)
    expect(ctr(25, 0)).toBeNull()
  })
})

describe('aggregateCurrentMonth', () => {
  const now = new Date()
  const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  test('soma só os dias do mês corrente', () => {
    const rows = [
      dia(`${mes}-01`, 100, { cliques: 10, receita: 300 }),
      dia(`${mes}-02`, 50, { cliques: 5, receita: 100 }),
      dia('2020-01-15', 999, { cliques: 999, receita: 999 }),
    ]
    const agg = aggregateCurrentMonth(rows)
    expect(agg.gasto).toBe(150)
    expect(agg.cliques).toBe(15)
    expect(agg.receita).toBe(400)
  })

  test('lista vazia devolve zeros', () => {
    expect(aggregateCurrentMonth([])).toEqual({
      gasto: 0,
      impressoes: 0,
      cliques: 0,
      conversoes: 0,
      receita: 0,
    })
  })

  test('campos null tratados como zero', () => {
    const agg = aggregateCurrentMonth([
      {
        data: `${mes}-03`,
        gasto: 10,
        impressoes: null,
        cliques: null,
        conversoes: null,
        receita: null,
      },
    ])
    expect(agg.impressoes).toBe(0)
    expect(agg.gasto).toBe(10)
  })
})

describe('formatDerived', () => {
  test('null vira travessão', () => {
    expect(formatDerived(null)).toBe('—')
  })

  test('formata pt-BR com prefixo', () => {
    expect(formatDerived(4.5, 'R$ ')).toBe('R$ 4,50')
  })
})
