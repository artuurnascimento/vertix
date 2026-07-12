import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PROJECT_STATUS_ORDER,
  formatMonthYear,
  formatRelativeTime,
  getProjectStatusMeta,
  getTipoServicoMeta,
  isActiveStatus,
} from './format'

const NOW_ISO = '2026-07-12T12:00:00.000Z'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_ISO))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna "agora" para o instante atual', () => {
    expect(formatRelativeTime(NOW_ISO)).toBe('agora')
  })

  it('formata segundos atrás em pt-BR', () => {
    expect(formatRelativeTime('2026-07-12T11:59:30.000Z')).toBe(
      'há 30 segundos'
    )
  })

  it('formata minutos atrás em pt-BR', () => {
    expect(formatRelativeTime('2026-07-12T11:55:00.000Z')).toBe('há 5 minutos')
  })

  it('formata horas atrás em pt-BR', () => {
    expect(formatRelativeTime('2026-07-12T10:00:00.000Z')).toBe('há 2 horas')
  })

  it('formata dias atrás em pt-BR', () => {
    expect(formatRelativeTime('2026-07-09T12:00:00.000Z')).toBe('há 3 dias')
  })

  it('formata semanas atrás em pt-BR', () => {
    expect(formatRelativeTime('2026-06-21T12:00:00.000Z')).toBe(
      'há 3 semanas'
    )
  })

  it('formata meses atrás em pt-BR', () => {
    expect(formatRelativeTime('2026-05-13T12:00:00.000Z')).toBe('há 2 meses')
  })

  it('aceita um "now" explícito sem depender do relógio', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(formatRelativeTime('2025-12-31T22:00:00.000Z', now)).toBe(
      'há 2 horas'
    )
  })
})

describe('formatMonthYear', () => {
  it('formata mês e ano em pt-BR', () => {
    expect(formatMonthYear('2026-07-12T12:00:00.000Z')).toBe('julho de 2026')
  })
})

describe('PROJECT_STATUS_ORDER', () => {
  it('tem exatamente as 6 etapas na ordem do pipeline', () => {
    expect(PROJECT_STATUS_ORDER).toEqual([
      'lead',
      'briefing_enviado',
      'briefing_recebido',
      'em_desenvolvimento',
      'revisao',
      'entregue',
    ])
  })
})

describe('getProjectStatusMeta', () => {
  it('retorna metadados de um status conhecido', () => {
    const meta = getProjectStatusMeta('em_desenvolvimento')
    expect(meta.label).toBe('Em desenvolvimento')
    expect(meta.badgeClass).toContain('amber')
    expect(meta.dotClass).toContain('amber')
  })

  it('retorna metadados de cada status do pipeline', () => {
    for (const status of PROJECT_STATUS_ORDER) {
      const meta = getProjectStatusMeta(status)
      expect(meta.label).not.toBe('Desconhecido')
      expect(meta.badgeClass).toBeTruthy()
      expect(meta.dotClass).toBeTruthy()
    }
  })

  it('cai no fallback para status desconhecido', () => {
    const meta = getProjectStatusMeta('status_inexistente')
    expect(meta.label).toBe('Desconhecido')
    expect(meta.dotClass).toBe('bg-muted')
  })
})

describe('getTipoServicoMeta', () => {
  it('retorna metadados de um tipo conhecido', () => {
    expect(getTipoServicoMeta('ecommerce').label).toBe('E-commerce')
    expect(getTipoServicoMeta('sistema').label).toBe('Sistema')
    expect(getTipoServicoMeta('site').label).toBe('Site')
  })

  it('cai no fallback para tipo desconhecido', () => {
    const meta = getTipoServicoMeta('consultoria')
    expect(meta.label).toBe('Serviço')
    expect(meta.badgeClass).toBeTruthy()
  })
})

describe('isActiveStatus', () => {
  it('considera "entregue" como inativo', () => {
    expect(isActiveStatus('entregue')).toBe(false)
  })

  it('considera todas as demais etapas como ativas', () => {
    const naoEntregues = PROJECT_STATUS_ORDER.filter((s) => s !== 'entregue')
    for (const status of naoEntregues) {
      expect(isActiveStatus(status)).toBe(true)
    }
  })
})
