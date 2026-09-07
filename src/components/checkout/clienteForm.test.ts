import { describe, expect, test } from 'vitest'
import {
  clienteParaEnvio,
  documentoValido,
  mascararDocumento,
  mascararWhatsapp,
  validarCliente,
} from './clienteForm'

describe('mascararWhatsapp', () => {
  test('formata celular com nove dígitos', () => {
    expect(mascararWhatsapp('62999887766')).toBe('(62) 99988-7766')
  })

  test('formata fixo com oito dígitos', () => {
    expect(mascararWhatsapp('6232213344')).toBe('(62) 3221-3344')
  })

  test('descarta o que passa de onze dígitos', () => {
    expect(mascararWhatsapp('629998877669999')).toBe('(62) 99988-7766')
  })
})

describe('mascararDocumento', () => {
  test('formata CPF', () => {
    expect(mascararDocumento('52998224725')).toBe('529.982.247-25')
  })

  test('formata CNPJ', () => {
    expect(mascararDocumento('54203421000149')).toBe('54.203.421/0001-49')
  })
})

describe('documentoValido', () => {
  test('aceita CPF e CNPJ com dígitos verificadores corretos', () => {
    expect(documentoValido('529.982.247-25')).toBe(true)
    expect(documentoValido('54.203.421/0001-49')).toBe(true)
  })

  test('recusa dígito verificador errado e sequência repetida', () => {
    expect(documentoValido('529.982.247-26')).toBe(false)
    expect(documentoValido('111.111.111-11')).toBe(false)
    expect(documentoValido('123')).toBe(false)
  })
})

describe('validarCliente', () => {
  const valido = {
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: '(62) 99988-7766',
    documento: '',
  }

  test('não reclama de um cadastro completo sem documento exigido', () => {
    expect(validarCliente(valido, false)).toEqual({})
  })

  test('exige documento válido quando o checkout pede', () => {
    expect(validarCliente(valido, true).documento).toBeDefined()
    expect(
      validarCliente({ ...valido, documento: '529.982.247-25' }, true)
    ).toEqual({})
  })

  test('documento opcional em branco passa, mas digitado errado é barrado', () => {
    expect(validarCliente({ ...valido, documento: '' }, false)).toEqual({})
    expect(
      validarCliente({ ...valido, documento: '529.982.247-26' }, false).documento
    ).toBeDefined()
  })

  test('aponta cada campo problemático', () => {
    const erros = validarCliente(
      { nome: 'Al', email: 'sem-arroba', whatsapp: '123', documento: '' },
      false
    )

    expect(erros.nome).toBeDefined()
    expect(erros.email).toBeDefined()
    expect(erros.whatsapp).toBeDefined()
  })
})

describe('clienteParaEnvio', () => {
  test('normaliza antes de mandar ao servidor', () => {
    expect(
      clienteParaEnvio({
        nome: '  Ana Souza ',
        email: ' Ana@Exemplo.COM ',
        whatsapp: '(62) 99988-7766',
        documento: '529.982.247-25',
      })
    ).toEqual({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      whatsapp: '62999887766',
      documento: '52998224725',
    })
  })
})
