import { describe, expect, it } from 'vitest'
import { resumirMedicoes } from './entregasData'

describe('resumirMedicoes', () => {
  it('conta enviadas e total por pedido', () => {
    const mapa = resumirMedicoes([
      { pedido_id: 'a', semana: 1, agendada_para: 'x', analysis_id: 'an', email_enviado_em: 'e' },
      { pedido_id: 'a', semana: 2, agendada_para: 'x', analysis_id: 'an', email_enviado_em: 'e' },
      { pedido_id: 'a', semana: 3, agendada_para: 'x', analysis_id: null, email_enviado_em: null },
      { pedido_id: 'b', semana: 1, agendada_para: 'x', analysis_id: null, email_enviado_em: null },
    ])
    expect(mapa.get('a')).toEqual({ enviadas: 2, total: 3 })
    expect(mapa.get('b')).toEqual({ enviadas: 0, total: 1 })
    expect(mapa.get('c')).toBeUndefined()
  })
})
