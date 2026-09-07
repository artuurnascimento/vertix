import { describe, expect, test } from 'vitest'
import {
  chaveMes,
  dentroDoPeriodo,
  intervaloDoPeriodo,
  mesesRecentes,
  rotuloDoPeriodo,
} from './periodo'

/**
 * Testes das funções puras de período (src/lib/periodo.ts), usadas pelo
 * filtro do Vertix Scan e do link de bio. Sem importadores: roda no Vitest.
 * Datas sintéticas, nada de dado real.
 */

const AGORA = new Date('2026-09-15T12:00:00Z')

describe('intervaloDoPeriodo', () => {
  test('janela corrida conta para trás e não tem fim', () => {
    const { desde, ate } = intervaloDoPeriodo('7d', AGORA)
    expect(desde).toBe('2026-09-08T12:00:00.000Z')
    expect(ate).toBeUndefined()
  })

  test('mês fechado vai da meia-noite de Brasília à virada seguinte', () => {
    const { desde, ate } = intervaloDoPeriodo('2026-09', AGORA)
    expect(desde).toBe('2026-09-01T03:00:00.000Z')
    expect(ate).toBe('2026-10-01T03:00:00.000Z')
  })

  test('dezembro vira para janeiro do ano seguinte', () => {
    expect(intervaloDoPeriodo('2026-12', AGORA).ate).toBe(
      '2027-01-01T03:00:00.000Z'
    )
  })
})

describe('dentroDoPeriodo', () => {
  const setembro = intervaloDoPeriodo('2026-09', AGORA)

  test('o primeiro instante do mês entra', () => {
    expect(dentroDoPeriodo('2026-09-01T03:00:00.000Z', setembro)).toBe(true)
  })

  test('meia-noite UTC do dia 1º ainda é agosto aqui', () => {
    expect(dentroDoPeriodo('2026-09-01T00:30:00.000Z', setembro)).toBe(false)
  })

  test('a virada para outubro fica de fora', () => {
    expect(dentroDoPeriodo('2026-10-01T03:00:00.000Z', setembro)).toBe(false)
  })
})

describe('mesesRecentes', () => {
  test('devolve os últimos meses, do mais novo ao mais antigo', () => {
    expect(mesesRecentes(3, AGORA).map((m) => m.valor)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
    ])
  })

  test('atravessa a virada de ano', () => {
    const meses = mesesRecentes(3, new Date('2026-01-10T12:00:00Z'))
    expect(meses.map((m) => m.valor)).toEqual(['2026-01', '2025-12', '2025-11'])
  })
})

describe('rótulos', () => {
  test('período corrido usa o nome da janela', () => {
    expect(rotuloDoPeriodo('30d')).toBe('30 dias')
  })

  test('mês fechado vira mês/ano curto', () => {
    expect(rotuloDoPeriodo('2026-09')).toBe('set/26')
  })

  test('chaveMes respeita o fuso de Brasília', () => {
    expect(chaveMes('2026-09-01T00:30:00Z')).toBe('2026-08')
  })
})
