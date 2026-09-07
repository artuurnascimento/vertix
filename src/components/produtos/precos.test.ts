import { describe, expect, it } from 'vitest'
import {
  centavosParaCampo,
  descontoPercentual,
  formatCentavos,
  reaisParaCentavos,
} from './precos'

describe('reaisParaCentavos', () => {
  it('converte reais com vírgula em centavos inteiros', () => {
    expect(reaisParaCentavos('197,00')).toBe(19700)
    expect(reaisParaCentavos('0,99')).toBe(99)
    expect(reaisParaCentavos('1,05')).toBe(105)
  })

  it('trata um decimal só como dezenas de centavo', () => {
    // "19,5" são 19 reais e 50 centavos — não 19 reais e 5 centavos.
    expect(reaisParaCentavos('19,5')).toBe(1950)
  })

  it('aceita valor inteiro sem separador', () => {
    expect(reaisParaCentavos('197')).toBe(19700)
    expect(reaisParaCentavos('0')).toBe(0)
  })

  it('aceita ponto como separador decimal', () => {
    expect(reaisParaCentavos('197.00')).toBe(19700)
    expect(reaisParaCentavos('19.99')).toBe(1999)
  })

  it('entende separador de milhar em pt-BR e en-US', () => {
    expect(reaisParaCentavos('1.234,50')).toBe(123450)
    expect(reaisParaCentavos('1,234.50')).toBe(123450)
    expect(reaisParaCentavos('12.345.678,90')).toBe(1234567890)
  })

  it('ignora prefixo R$ e espaços colados de outro sistema', () => {
    expect(reaisParaCentavos('R$ 197,00')).toBe(19700)
    expect(reaisParaCentavos('R$ 1.997,00')).toBe(199700)
  })

  it('não perde centavos por arredondamento de float', () => {
    // 19.99 * 100 em ponto flutuante dá 1998.9999999999998.
    expect(reaisParaCentavos('19,99')).toBe(1999)
    expect(reaisParaCentavos('8,70')).toBe(870)
    expect(reaisParaCentavos('1.000,10')).toBe(100010)
  })

  it('devolve null para vazio e para texto que não é preço', () => {
    expect(reaisParaCentavos('')).toBeNull()
    expect(reaisParaCentavos('   ')).toBeNull()
    expect(reaisParaCentavos('grátis')).toBeNull()
    expect(reaisParaCentavos('197,000')).toBeNull()
    expect(reaisParaCentavos('-197,00')).toBeNull()
  })
})

describe('centavosParaCampo', () => {
  it('sempre volta com duas casas', () => {
    expect(centavosParaCampo(19700)).toBe('197,00')
    expect(centavosParaCampo(1950)).toBe('19,50')
    expect(centavosParaCampo(5)).toBe('0,05')
    expect(centavosParaCampo(0)).toBe('0,00')
  })

  it('devolve vazio quando não há valor (âncora opcional)', () => {
    expect(centavosParaCampo(null)).toBe('')
  })

  it('faz a volta completa sem mudar o valor', () => {
    for (const centavos of [1, 99, 100, 1999, 19700, 123450]) {
      expect(reaisParaCentavos(centavosParaCampo(centavos))).toBe(centavos)
    }
  })
})

describe('formatCentavos', () => {
  it('mostra o preço em reais', () => {
    // Espaço da moeda em pt-BR é não separável — normalizado no teste.
    expect(formatCentavos(19700).replace(/ /g, ' ')).toBe('R$ 197,00')
    expect(formatCentavos(0).replace(/ /g, ' ')).toBe('R$ 0,00')
  })
})

describe('descontoPercentual', () => {
  it('calcula o desconto sobre a âncora', () => {
    expect(descontoPercentual(19700, 29700)).toBe(34)
  })

  it('não inventa desconto quando a âncora não é maior', () => {
    expect(descontoPercentual(19700, null)).toBeNull()
    expect(descontoPercentual(19700, 19700)).toBeNull()
    expect(descontoPercentual(19700, 9700)).toBeNull()
  })
})
