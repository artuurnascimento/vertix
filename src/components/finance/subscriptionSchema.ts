import { z } from 'zod'
import { parseValor } from './receivableSchema'

const MIN_DIA_VENCIMENTO = 1
const MAX_DIA_VENCIMENTO = 28

export const subscriptionSchema = z.object({
  client_id: z.uuid('Selecione o cliente.'),
  project_id: z.string(),
  descricao: z.string().trim().min(1, 'Informe a descrição da assinatura.'),
  valor_mensal: z
    .string()
    .refine((raw) => parseValor(raw) !== null, 'Informe um valor válido.')
    .refine(
      (raw) => (parseValor(raw) ?? 0) > 0,
      'O valor deve ser maior que zero.'
    ),
  dia_vencimento: z
    .string()
    .refine((raw) => {
      const value = Number(raw)
      return (
        Number.isInteger(value) &&
        value >= MIN_DIA_VENCIMENTO &&
        value <= MAX_DIA_VENCIMENTO
      )
    }, `Informe um dia entre ${MIN_DIA_VENCIMENTO} e ${MAX_DIA_VENCIMENTO}.`),
})

export type SubscriptionFormValues = z.infer<typeof subscriptionSchema>

export const EMPTY_SUBSCRIPTION_VALUES: SubscriptionFormValues = {
  client_id: '',
  project_id: '',
  descricao: '',
  valor_mensal: '',
  dia_vencimento: '',
}

/** Converte o form validado no payload de insert/update. */
export function subscriptionFormToPayload(values: SubscriptionFormValues) {
  return {
    client_id: values.client_id,
    project_id: values.project_id === '' ? null : values.project_id,
    descricao: values.descricao,
    valor_mensal: parseValor(values.valor_mensal) ?? 0,
    dia_vencimento: Number(values.dia_vencimento),
  }
}
