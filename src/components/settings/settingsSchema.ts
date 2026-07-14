import { z } from 'zod'
import type { Tables } from '../../lib/database.types'

export type SettingRow = Tables<'settings'>

/** Converte a lista de linhas settings(chave, valor) num mapa chave→valor. */
export function settingsToMap(rows: SettingRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.chave, row.valor]))
}

// ---------------------------------------------------------------------------
// Dados da empresa
// ---------------------------------------------------------------------------

export const EMPRESA_KEYS = [
  'empresa_nome',
  'empresa_cnpj',
  'empresa_endereco',
  'empresa_email',
  'empresa_telefone',
  'empresa_site',
] as const

export type EmpresaKey = (typeof EMPRESA_KEYS)[number]

export const EMPRESA_FIELD_META: Record<
  EmpresaKey,
  { label: string; placeholder: string; type: string }
> = {
  empresa_nome: {
    label: 'Nome da empresa',
    placeholder: 'Vertix',
    type: 'text',
  },
  empresa_cnpj: {
    label: 'CNPJ',
    placeholder: '00.000.000/0001-00',
    type: 'text',
  },
  empresa_endereco: {
    label: 'Endereço',
    placeholder: 'Rua Exemplo, 123 — Cidade/UF',
    type: 'text',
  },
  empresa_email: {
    label: 'Email',
    placeholder: 'contato@vertix.com.br',
    type: 'text',
  },
  empresa_telefone: {
    label: 'Telefone',
    placeholder: '(11) 99999-0000',
    type: 'tel',
  },
  empresa_site: {
    label: 'Site',
    placeholder: 'https://vertix.com.br',
    type: 'text',
  },
}

export type EmpresaFormValues = Record<EmpresaKey, string>

const emailValido = (value: string): boolean =>
  value === '' || z.email().safeParse(value).success

export const empresaSchema = z.object({
  empresa_nome: z.string().trim().min(1, 'Informe o nome da empresa.'),
  empresa_cnpj: z.string().trim(),
  empresa_endereco: z.string().trim(),
  empresa_email: z.string().trim().refine(emailValido, 'Informe um email válido.'),
  empresa_telefone: z.string().trim(),
  empresa_site: z.string().trim(),
})

// ---------------------------------------------------------------------------
// Faturamento
// ---------------------------------------------------------------------------

export const VALOR_HORA_KEY = 'valor_hora'

export const valorHoraSchema = z
  .string()
  .trim()
  .min(1, 'Informe o valor da hora.')
  .refine((value) => {
    const normalized = value.replace(',', '.')
    const num = Number(normalized)
    return Number.isFinite(num) && num >= 0
  }, 'Informe um valor numérico válido.')

/** Normaliza entrada com vírgula/ponto para o formato numérico salvo no banco. */
export function normalizeValorHora(value: string): string {
  const num = Number(value.replace(',', '.'))
  return String(num)
}
