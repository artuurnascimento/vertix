import { describe, expect, it } from 'vitest'
import {
  EMPTY_CUPOM,
  cupomFormToPayload,
  cupomSchema,
  isoParaCampoData,
  normalizarCodigo,
  validadeParaIso,
  valorDoBanco,
  valorParaBanco,
} from './cupomForm'
import type { CupomFormValues } from './cupomForm'
import { cupomEsgotado } from './cuponsData'
import type { Cupom } from './cuponsData'

const PERCENTUAL: CupomFormValues = {
  ...EMPTY_CUPOM,
  codigo: 'BF50',
  tipo: 'percentual',
  valor: '50',
}

const FIXO: CupomFormValues = {
  ...EMPTY_CUPOM,
  codigo: 'MENOS50',
  tipo: 'fixo',
  valor: '50,00',
}

function erroDe(values: CupomFormValues, campo: string): string | undefined {
  const parsed = cupomSchema.safeParse(values)
  if (parsed.success) return undefined
  return parsed.error.issues.find((i) => i.path[0] === campo)?.message
}

describe('valorParaBanco', () => {
  it('percentual vai em pontos percentuais', () => {
    expect(valorParaBanco('percentual', '50')).toBe(50)
    expect(valorParaBanco('percentual', ' 7 ')).toBe(7)
  })

  it('valor fixo vai em CENTAVOS', () => {
    expect(valorParaBanco('fixo', '50,00')).toBe(5000)
    expect(valorParaBanco('fixo', 'R$ 19,90')).toBe(1990)
  })

  it('recusa texto que não é número', () => {
    expect(valorParaBanco('percentual', 'metade')).toBeNull()
    expect(valorParaBanco('fixo', '')).toBeNull()
  })

  it('volta do banco para o campo sem mudar o valor', () => {
    expect(valorDoBanco('fixo', 5000)).toBe('50,00')
    expect(valorDoBanco('percentual', 50)).toBe('50')
  })
})

describe('normalizarCodigo', () => {
  it('sobe para maiúsculas (o banco só aceita assim)', () => {
    expect(normalizarCodigo(' bf50 ')).toBe('BF50')
    expect(normalizarCodigo('black friday')).toBe('BLACKFRIDAY')
  })
})

describe('cupomSchema', () => {
  it('aceita percentual e fixo bem preenchidos', () => {
    expect(cupomSchema.safeParse(PERCENTUAL).success).toBe(true)
    expect(cupomSchema.safeParse(FIXO).success).toBe(true)
  })

  it('exige código', () => {
    expect(erroDe({ ...PERCENTUAL, codigo: '' }, 'codigo')).toBe(
      'Informe o código do cupom.'
    )
  })

  it('recusa percentual acima de 100 ou zerado', () => {
    expect(erroDe({ ...PERCENTUAL, valor: '150' }, 'valor')).toBeDefined()
    expect(erroDe({ ...PERCENTUAL, valor: '0' }, 'valor')).toBeDefined()
  })

  it('recusa limite de uso zerado ou negativo', () => {
    expect(erroDe({ ...PERCENTUAL, limiteUso: '0' }, 'limiteUso')).toBe(
      'O limite de uso precisa ser um número maior que zero.'
    )
    expect(cupomSchema.safeParse({ ...PERCENTUAL, limiteUso: '30' }).success).toBe(
      true
    )
  })
})

describe('validade', () => {
  it('a data escolhida vale até o fim do dia', () => {
    const iso = validadeParaIso('2026-12-24')
    expect(iso).not.toBeNull()
    expect(isoParaCampoData(iso)).toBe('2026-12-24')
  })

  it('sem data = não expira', () => {
    expect(validadeParaIso('')).toBeNull()
    expect(isoParaCampoData(null)).toBe('')
  })
})

describe('cupomFormToPayload', () => {
  it('grava centavos no fixo e percentual no percentual', () => {
    expect(cupomFormToPayload(FIXO).valor).toBe(5000)
    expect(cupomFormToPayload(PERCENTUAL).valor).toBe(50)
  })

  it('sem limite e sem produto vira null', () => {
    const payload = cupomFormToPayload(PERCENTUAL)
    expect(payload.limite_uso).toBeNull()
    expect(payload.produto_id).toBeNull()
    expect(payload.codigo).toBe('BF50')
  })
})

describe('cupomEsgotado', () => {
  const base: Cupom = {
    id: 'c1',
    codigo: 'BF50',
    tipo: 'percentual',
    valor: 50,
    validade: null,
    limite_uso: null,
    usos: 0,
    produto_id: null,
    ativo: true,
    created_at: '2026-09-01T00:00:00Z',
  }
  const agora = new Date('2026-09-07T12:00:00Z')

  it('cupom vivo não está esgotado', () => {
    expect(cupomEsgotado(base, agora)).toBe(false)
  })

  it('desativado, vencido ou no limite conta como esgotado', () => {
    expect(cupomEsgotado({ ...base, ativo: false }, agora)).toBe(true)
    expect(
      cupomEsgotado({ ...base, validade: '2026-09-01T00:00:00Z' }, agora)
    ).toBe(true)
    expect(cupomEsgotado({ ...base, limite_uso: 10, usos: 10 }, agora)).toBe(true)
  })
})
