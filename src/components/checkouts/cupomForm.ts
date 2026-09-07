import { z } from 'zod'
import { centavosParaCampo, reaisParaCentavos } from '../produtos/precos'
import { CUPOM_TIPOS } from './cuponsData'
import type { Cupom, CupomPayload } from './cuponsData'

/**
 * Regras do formulário de cupom. O detalhe que exige cuidado: `cupons.valor`
 * troca de unidade conforme o tipo — pontos percentuais no 'percentual',
 * CENTAVOS no 'fixo'. A conversão acontece só aqui.
 */

export interface CupomFormValues {
  codigo: string
  tipo: (typeof CUPOM_TIPOS)[number]
  /** Percentual: "10". Fixo: reais digitados ("50,00"). */
  valor: string
  /** 'YYYY-MM-DD' do input date; '' = não expira. */
  validade: string
  /** '' = uso ilimitado. */
  limiteUso: string
  /** '' = vale para qualquer produto. */
  produtoId: string
  ativo: boolean
}

export const EMPTY_CUPOM: CupomFormValues = {
  codigo: '',
  tipo: 'percentual',
  valor: '',
  validade: '',
  limiteUso: '',
  produtoId: '',
  ativo: true,
}

const PERCENTUAL_MIN = 1
const PERCENTUAL_MAX = 100

/** Valor digitado → inteiro que o banco espera para aquele tipo. */
export function valorParaBanco(
  tipo: CupomFormValues['tipo'],
  valor: string
): number | null {
  if (tipo === 'fixo') return reaisParaCentavos(valor)
  const texto = valor.trim()
  if (!/^\d{1,3}$/.test(texto)) return null
  return Number(texto)
}

/** Inteiro do banco → texto do campo (centavos viram reais no fixo). */
export function valorDoBanco(tipo: Cupom['tipo'], valor: number): string {
  return tipo === 'fixo' ? centavosParaCampo(valor) : String(valor)
}

function valorValido(values: CupomFormValues): boolean {
  const numero = valorParaBanco(values.tipo, values.valor)
  if (numero === null || numero <= 0) return false
  if (values.tipo === 'percentual') {
    return numero >= PERCENTUAL_MIN && numero <= PERCENTUAL_MAX
  }
  return true
}

/** "bf50" → "BF50". O banco exige o código em maiúsculas (check constraint). */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, '')
}

/** Data do input ('YYYY-MM-DD') → fim daquele dia, em ISO. */
export function validadeParaIso(data: string): string | null {
  if (data.trim() === '') return null
  const fimDoDia = new Date(`${data}T23:59:59`)
  if (Number.isNaN(fimDoDia.getTime())) return null
  return fimDoDia.toISOString()
}

/** ISO do banco → 'YYYY-MM-DD' para o input date, no fuso de quem olha. */
export function isoParaCampoData(iso: string | null): string {
  if (iso === null) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

export const cupomSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .min(1, 'Informe o código do cupom.')
      .regex(/^[A-Za-z0-9._-]+$/, 'Use letras, números, ponto, hífen ou _.'),
    tipo: z.enum(CUPOM_TIPOS),
    valor: z.string(),
    validade: z
      .string()
      .refine(
        (v) => v.trim() === '' || validadeParaIso(v) !== null,
        'Data de validade inválida.'
      ),
    limiteUso: z
      .string()
      .refine(
        (v) => v.trim() === '' || /^[1-9]\d*$/.test(v.trim()),
        'O limite de uso precisa ser um número maior que zero.'
      ),
    produtoId: z.union([z.uuid(), z.literal('')]),
    ativo: z.boolean(),
  })
  .refine(valorValido, {
    path: ['valor'],
    message:
      'Percentual: de 1 a 100. Valor fixo: um desconto em reais maior que zero.',
  })

export function cupomFormToPayload(values: CupomFormValues): CupomPayload {
  const valor = valorParaBanco(values.tipo, values.valor)
  if (valor === null) throw new Error('Valor de cupom inválido.')
  const limite = values.limiteUso.trim()
  return {
    codigo: normalizarCodigo(values.codigo),
    tipo: values.tipo,
    valor,
    validade: validadeParaIso(values.validade),
    limite_uso: limite === '' ? null : Number(limite),
    produto_id: values.produtoId === '' ? null : values.produtoId,
    ativo: values.ativo,
  }
}

export function cupomToFormValues(cupom: Cupom): CupomFormValues {
  return {
    codigo: cupom.codigo,
    tipo: cupom.tipo,
    valor: valorDoBanco(cupom.tipo, cupom.valor),
    validade: isoParaCampoData(cupom.validade),
    limiteUso: cupom.limite_uso === null ? '' : String(cupom.limite_uso),
    produtoId: cupom.produto_id ?? '',
    ativo: cupom.ativo,
  }
}
