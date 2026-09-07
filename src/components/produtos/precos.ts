/**
 * Conversão de preço entre a tela (reais) e o banco (centavos).
 *
 * Este é o ÚNICO lugar do módulo de produtos/checkouts que multiplica ou
 * divide por 100. Errar o fator aqui vira cobrança errada no cartão do
 * cliente, então a conversão não usa float em momento nenhum: a entrada é
 * quebrada em parte inteira e centavos como texto e recomposta com inteiros
 * (19,99 * 100 em ponto flutuante dá 1998.9999999999998).
 */

import { formatBRL } from '../../lib/commercial'

/** "1.234,50" — milhar com ponto, decimal com vírgula (padrão pt-BR). */
const PADRAO_MILHAR_BR = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/
/**
 * "1,234.50" — formato en-US, aceito porque cola de planilha acontece. O
 * decimal com ponto é OBRIGATÓRIO aqui: sem ele "197,000" seria lido como
 * cento e noventa e sete mil, um erro de mil vezes num preço de R$ 197.
 */
const PADRAO_MILHAR_EN = /^\d{1,3}(,\d{3})+\.\d{1,2}$/
/** "1234", "1234,5", "1234.50" — sem separador de milhar. */
const PADRAO_SIMPLES = /^\d+([.,]\d{1,2})?$/

const CENTAVOS_POR_REAL = 100

function compor(inteiro: string, decimal: string): number {
  // padEnd: "5" em "19,5" são 50 centavos, não 5.
  return Number(inteiro) * CENTAVOS_POR_REAL + Number(decimal.padEnd(2, '0') || '0')
}

/**
 * Texto digitado → centavos inteiros. Devolve null quando o texto está vazio
 * ou não é um preço reconhecível — quem chama decide se isso é erro.
 */
export function reaisParaCentavos(entrada: string): number | null {
  const limpo = entrada.replace(/[R$\s\u00A0]/g, '')
  if (limpo === '') return null

  if (PADRAO_MILHAR_BR.test(limpo)) {
    const [inteiro, decimal = ''] = limpo.replace(/\./g, '').split(',')
    return compor(inteiro, decimal)
  }
  if (PADRAO_MILHAR_EN.test(limpo)) {
    const [inteiro, decimal = ''] = limpo.replace(/,/g, '').split('.')
    return compor(inteiro, decimal)
  }
  if (PADRAO_SIMPLES.test(limpo)) {
    const [inteiro, decimal = ''] = limpo.split(/[.,]/)
    return compor(inteiro, decimal)
  }
  return null
}

/** Centavos → "197,00", o valor que fica dentro do input ao editar. */
export function centavosParaCampo(centavos: number | null): string {
  if (centavos == null) return ''
  const negativo = centavos < 0
  const absoluto = Math.abs(Math.round(centavos))
  const inteiro = Math.floor(absoluto / CENTAVOS_POR_REAL)
  const resto = absoluto % CENTAVOS_POR_REAL
  return `${negativo ? '-' : ''}${inteiro},${String(resto).padStart(2, '0')}`
}

/** Centavos → "R$ 197,00", o preço mostrado na lista e nos resumos. */
export function formatCentavos(centavos: number): string {
  return formatBRL(centavos / CENTAVOS_POR_REAL)
}

/**
 * Desconto da âncora em pontos percentuais inteiros ("de R$ 297 por R$ 197"
 * = 34%). Null quando não há âncora ou ela não é maior que o preço.
 */
export function descontoPercentual(
  precoCentavos: number,
  ancoraCentavos: number | null
): number | null {
  if (ancoraCentavos == null || ancoraCentavos <= precoCentavos) return null
  return Math.round(((ancoraCentavos - precoCentavos) / ancoraCentavos) * 100)
}
