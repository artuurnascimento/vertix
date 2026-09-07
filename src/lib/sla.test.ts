import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computeSla, slaHoras } from './sla'

/**
 * Testes do SLA de suporte (src/lib/sla.ts), consumido pela fila de chamados
 * e pelo health score do cliente. Arquivo de teste: nenhum importador, roda
 * no Vitest.
 *
 * Dados sintéticos de chamado — prioridade ('alta' | 'media' | 'baixa'),
 * created_at e resolved_at em ISO UTC ("2026-09-07T12:00:00Z") — com o
 * relógio congelado. Sem rede, sem banco.
 */

const AGORA = new Date('2026-09-07T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AGORA)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('slaHoras', () => {
  test('cada prioridade tem sua janela', () => {
    expect(slaHoras('alta')).toBe(4)
    expect(slaHoras('media')).toBe(24)
    expect(slaHoras('baixa')).toBe(72)
  })

  test('prioridade desconhecida cai no padrão de 24h', () => {
    expect(slaHoras('urgentíssima')).toBe(24)
  })
})

describe('computeSla — chamado aberto', () => {
  test('recém-aberto fica no prazo', () => {
    const sla = computeSla('alta', '2026-09-07T11:30:00Z', null)
    expect(sla.status).toBe('no_prazo')
    expect(sla.horasRestantes).toBeCloseTo(3.5, 5)
  })

  test('passando de 75% da janela entra em risco', () => {
    // Alta = 4h; aberto há 3h30 já passou dos 75% (3h).
    expect(computeSla('alta', '2026-09-07T08:30:00Z', null).status).toBe(
      'em_risco'
    )
  })

  test('depois do prazo estoura e as horas ficam negativas', () => {
    const sla = computeSla('alta', '2026-09-07T06:00:00Z', null)
    expect(sla.status).toBe('estourado')
    expect(sla.horasRestantes).toBeLessThan(0)
  })
})

describe('computeSla — chamado resolvido', () => {
  test('resolvido dentro da janela conta como cumprido', () => {
    const sla = computeSla(
      'media',
      '2026-09-06T12:00:00Z',
      '2026-09-07T08:00:00Z'
    )
    expect(sla.status).toBe('cumprido')
  })

  test('resolvido depois do prazo continua estourado', () => {
    const sla = computeSla(
      'alta',
      '2026-09-06T12:00:00Z',
      '2026-09-07T08:00:00Z'
    )
    expect(sla.status).toBe('estourado')
  })

  test('resolvido no limite exato ainda é cumprido', () => {
    const sla = computeSla(
      'alta',
      '2026-09-07T00:00:00Z',
      '2026-09-07T04:00:00Z'
    )
    expect(sla.status).toBe('cumprido')
    expect(sla.horasRestantes).toBe(0)
  })
})
