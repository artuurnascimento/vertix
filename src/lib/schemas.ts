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

/** Formatos do botão do link de bio (check constraint em bio_links.formato). */
export const BIO_FORMATOS = ['destaque', 'largo', 'grade'] as const

/** Tipos de destino (check constraint em bio_links.tipo_destino). */
export const BIO_TIPOS_DESTINO = ['url', 'whatsapp'] as const

export const BIO_FORMATO_LABEL: Record<(typeof BIO_FORMATOS)[number], string> = {
  destaque: 'Destaque (card grande do topo)',
  largo: 'Largo (linha inteira)',
  grade: 'Grade (meia largura)',
}

export const BIO_TIPO_DESTINO_LABEL: Record<
  (typeof BIO_TIPOS_DESTINO)[number],
  string
> = {
  url: 'Endereço na web',
  whatsapp: 'Conversa no WhatsApp',
}

export const bioLinkSchema = z
  .object({
    rotulo: z.string().trim().min(1, 'Informe o texto do botão.'),
    descricao: z.string().trim(),
    icone: z.string().trim(),
    formato: z.enum(BIO_FORMATOS, { error: 'Selecione o formato.' }),
    tipo_destino: z.enum(BIO_TIPOS_DESTINO, {
      error: 'Selecione o tipo de destino.',
    }),
    destino: z.string().trim(),
    mensagem: z.string().trim(),
    ativo: z.boolean(),
  })
  .superRefine((valores, ctx) => {
    // Botão sem destino pode existir desligado (campanha em preparo), mas
    // nunca ligado — a página mostraria um botão que não leva a lugar nenhum.
    if (valores.ativo && valores.destino === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['destino'],
        message: 'Informe o destino para poder ligar o botão.',
      })
      return
    }
    if (valores.destino === '') return

    if (valores.tipo_destino === 'whatsapp') {
      const digitos = valores.destino.replace(/\D/g, '').length
      if (digitos < 10 || digitos > 13) {
        ctx.addIssue({
          code: 'custom',
          path: ['destino'],
          message: 'Informe um número com DDD, por exemplo (62) 99607-6194.',
        })
      }
      return
    }

    if (!/^https?:\/\//i.test(valores.destino)) {
      ctx.addIssue({
        code: 'custom',
        path: ['destino'],
        message: 'O endereço precisa começar com https://.',
      })
    }
  })

export type BioLinkFormValues = z.infer<typeof bioLinkSchema>

/** Converte os valores do form em payload do banco ('' vira null). */
export function bioLinkFormToPayload(valores: BioLinkFormValues) {
  return {
    rotulo: valores.rotulo,
    descricao: valores.descricao === '' ? null : valores.descricao,
    icone: valores.icone === '' ? null : valores.icone,
    formato: valores.formato,
    tipo_destino: valores.tipo_destino,
    destino: valores.destino,
    mensagem: valores.mensagem === '' ? null : valores.mensagem,
    ativo: valores.ativo,
  }
}
