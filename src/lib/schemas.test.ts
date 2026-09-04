import { describe, expect, it } from 'vitest'
import {
  CLIENT_ORIGENS,
  bioLinkFormToPayload,
  bioLinkSchema,
  clientFormToPayload,
  clientSchema,
} from './schemas'
import type { BioLinkFormValues, ClientFormValues } from './schemas'

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

describe('bioLinkSchema', () => {
  const VALIDO: BioLinkFormValues = {
    rotulo: 'Loja Shopify',
    descricao: 'Do zero ou migração',
    chamada: '',
    texto_botao: '',
    icone: 'store',
    formato: 'grade',
    tipo_destino: 'whatsapp',
    destino: '(62) 99607-6194',
    mensagem: 'Oi, Vertix!',
    ativo: true,
  }

  it('aceita um botão de conversa completo', () => {
    expect(bioLinkSchema.safeParse(VALIDO).success).toBe(true)
  })

  it('exige o texto do botão', () => {
    const result = bioLinkSchema.safeParse({ ...VALIDO, rotulo: '  ' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['rotulo'])
    }
  })

  it('recusa ligar um botão sem destino', () => {
    const result = bioLinkSchema.safeParse({ ...VALIDO, destino: '', ativo: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Informe o destino para poder ligar o botão.'
      )
    }
  })

  it('aceita botão desligado sem destino (campanha em preparo)', () => {
    const result = bioLinkSchema.safeParse({ ...VALIDO, destino: '', ativo: false })
    expect(result.success).toBe(true)
  })

  it('recusa número de telefone curto demais', () => {
    const result = bioLinkSchema.safeParse({ ...VALIDO, destino: '99607' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['destino'])
    }
  })

  it('recusa endereço sem protocolo e aceita com https', () => {
    const semProtocolo = { ...VALIDO, tipo_destino: 'url' as const, destino: 'vertix.studio' }
    expect(bioLinkSchema.safeParse(semProtocolo).success).toBe(false)
    expect(
      bioLinkSchema.safeParse({ ...semProtocolo, destino: 'https://vertix.studio' })
        .success
    ).toBe(true)
  })

  it('recusa formato fora dos três', () => {
    expect(bioLinkSchema.safeParse({ ...VALIDO, formato: 'gigante' }).success).toBe(
      false
    )
  })
})

describe('bioLinkFormToPayload', () => {
  it('converte campos opcionais vazios em null', () => {
    const payload = bioLinkFormToPayload({
      rotulo: 'Projetos',
      descricao: '',
      chamada: '',
      texto_botao: '',
      icone: '',
      formato: 'grade',
      tipo_destino: 'url',
      destino: 'https://www.vertix.studio',
      mensagem: '',
      ativo: true,
    })
    expect(payload.descricao).toBeNull()
    expect(payload.chamada).toBeNull()
    expect(payload.texto_botao).toBeNull()
    expect(payload.icone).toBeNull()
    expect(payload.mensagem).toBeNull()
    expect(payload.destino).toBe('https://www.vertix.studio')
  })
})
