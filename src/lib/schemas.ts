import { z } from 'zod'

/** Origens possíveis de um cliente (select do formulário). */
export const CLIENT_ORIGENS = [
  'Indicação',
  'Instagram',
  'Google',
  'Site',
  'Outro',
] as const

export type ClientOrigem = (typeof CLIENT_ORIGENS)[number]

const emailValido = (value: string): boolean =>
  value === '' || z.email().safeParse(value).success

export const clientSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do cliente.'),
  empresa: z.string().trim(),
  email: z.string().trim().refine(emailValido, 'Informe um email válido.'),
  telefone: z.string().trim(),
  origem: z.union([z.enum(CLIENT_ORIGENS), z.literal('')]),
})

export type ClientFormValues = z.infer<typeof clientSchema>

/** Converte os valores do form em payload do banco ('' vira null). */
export function clientFormToPayload(values: ClientFormValues) {
  return {
    nome: values.nome,
    empresa: values.empresa === '' ? null : values.empresa,
    email: values.email === '' ? null : values.email,
    telefone: values.telefone === '' ? null : values.telefone,
    origem: values.origem === '' ? null : values.origem,
  }
}

/** Tipos de serviço aceitos em projects.tipo_servico (check constraint). */
export const PROJECT_TIPOS = ['ecommerce', 'sistema', 'site'] as const

export type ProjectTipo = (typeof PROJECT_TIPOS)[number]

export const projectSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do projeto.'),
  tipo_servico: z.enum(PROJECT_TIPOS, {
    error: 'Selecione o tipo de serviço.',
  }),
  client_id: z.uuid('Selecione o cliente.'),
})

export type ProjectFormValues = z.infer<typeof projectSchema>
