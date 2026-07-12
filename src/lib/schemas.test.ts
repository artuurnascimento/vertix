import { describe, expect, it } from 'vitest'
import {
  CLIENT_ORIGENS,
  clientFormToPayload,
  clientSchema,
} from './schemas'
import type { ClientFormValues } from './schemas'

const VALID_VALUES: ClientFormValues = {
  nome: 'Marina Duarte',
  empresa: 'Duarte Modas',
  email: 'marina@duartemodas.com',
  telefone: '(11) 99999-0000',
  origem: 'Indicação',
}

describe('clientSchema', () => {
  it('aceita um cliente válido completo', () => {
    const result = clientSchema.safeParse(VALID_VALUES)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(VALID_VALUES)
    }
  })

  it('rejeita nome vazio com mensagem amigável', () => {
    const result = clientSchema.safeParse({ ...VALID_VALUES, nome: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['nome'])
      expect(result.error.issues[0]?.message).toBe(
        'Informe o nome do cliente.'
      )
    }
  })

  it('rejeita nome só com espaços (trim antes da validação)', () => {
    const result = clientSchema.safeParse({ ...VALID_VALUES, nome: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejeita email inválido com mensagem amigável', () => {
    const result = clientSchema.safeParse({
      ...VALID_VALUES,
      email: 'nao-e-um-email',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['email'])
      expect(result.error.issues[0]?.message).toBe('Informe um email válido.')
    }
  })

  it('aceita email vazio (campo opcional)', () => {
    const result = clientSchema.safeParse({ ...VALID_VALUES, email: '' })
    expect(result.success).toBe(true)
  })

  it('aceita origem vazia e todas as origens conhecidas', () => {
    expect(
      clientSchema.safeParse({ ...VALID_VALUES, origem: '' }).success
    ).toBe(true)
    for (const origem of CLIENT_ORIGENS) {
      expect(clientSchema.safeParse({ ...VALID_VALUES, origem }).success).toBe(
        true
      )
    }
  })

  it('rejeita origem fora da lista', () => {
    const result = clientSchema.safeParse({
      ...VALID_VALUES,
      origem: 'TikTok',
    })
    expect(result.success).toBe(false)
  })
})

describe('clientFormToPayload', () => {
  it('mantém os valores preenchidos', () => {
    expect(clientFormToPayload(VALID_VALUES)).toEqual({
      nome: 'Marina Duarte',
      empresa: 'Duarte Modas',
      email: 'marina@duartemodas.com',
      telefone: '(11) 99999-0000',
      origem: 'Indicação',
    })
  })

  it("converte strings vazias em null (menos o nome)", () => {
    const payload = clientFormToPayload({
      nome: 'Cliente Mínimo',
      empresa: '',
      email: '',
      telefone: '',
      origem: '',
    })
    expect(payload).toEqual({
      nome: 'Cliente Mínimo',
      empresa: null,
      email: null,
      telefone: null,
      origem: null,
    })
  })
})
