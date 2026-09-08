/**
 * O `formData` de cartão que viaja dentro do corpo do `checkout-pagar`.
 *
 * Função pura, e é pura por um motivo só: aqui mora a trava do bug de dinheiro
 * nº 1 do plano. O servidor faz `pagamento.installments = formData.installments
 * ?? 1` (`supabase/functions/checkout-pagar/index.ts:494`). Se este objeto sair
 * daqui sem `installments`, o cliente escolhe 12x na tela e é cobrado à vista —
 * sem erro, sem log, sem nada na resposta que denuncie. O `?? 1` do servidor
 * não é rede de segurança: é o silêncio que transforma um bug de front em
 * estorno. Por isso `installments` é validado aqui e o submit ABORTA quando não
 * dá para confiar nele.
 *
 * O contrato com o servidor NÃO PODE MUDAR — o corpo é idêntico ao que
 * `pagarCheckout` já manda hoje (`checkoutApi.ts:202-213`). A whitelist que o
 * servidor lê de dentro do `formData` é exatamente esta:
 *
 *   payment_method_id  obrigatório sempre   (:312, :362, :466)
 *   token              obrigatório no cartão (:493)
 *   installments       obrigatório no cartão (:494 — o `?? 1`)
 *   issuer_id          opcional, só se != null (:495)
 *   payer.last_name    opcional, só se truthy  (:471)
 *
 * Nada além disso atravessa. E, acima de tudo: **não existe campo de valor
 * neste payload**. O preço sai do catálogo do servidor, o cupom é revalidado
 * lá, e um `transaction_amount` vindo do navegador seria a forma mais direta
 * de deixar o cliente escolher quanto pagar.
 */

/** Payload de cartão, exatamente como o servidor espera lê-lo. */
export interface FormDataCartao {
  payment_method_id: string
  token: string
  /** Inteiro ≥ 1. NUNCA `undefined` — ver o cabeçalho deste arquivo. */
  installments: number
  /**
   * Vai CRU. `getPaymentMethods` devolve número (`26`) e `getInstallments`
   * devolve string (`"26"`); o servidor aceita os dois
   * (`index.ts:96`: `issuer_id?: string | number`). Converter aqui seria
   * inventar um tipo que nenhuma das duas pontas combinou.
   */
  issuer_id?: string | number
  /** Omitido inteiro quando não há sobrenome — o servidor usa `payer?.last_name`. */
  payer?: { last_name: string }
}

export interface EntradaFormDataCartao {
  /**
   * Bandeira: `visa`, `master`, `elo`, `amex`… Vem de `getPaymentMethods` e,
   * como reserva, do `payment_method_id` que `getInstallments` devolve de
   * brinde — se a consulta de BIN falhar, a segunda ainda pode ter respondido.
   */
  paymentMethodId: string | null | undefined
  /** `id` do `createCardToken`. Uso único, vale 7 dias. */
  token: string | null | undefined
  /** Parcela escolhida no select. */
  installments: number
  issuerId?: string | number | null
  /** Nome digitado no campo de titular; daqui sai o `payer.last_name`. */
  nomeCompleto?: string | null
}

/** Motivos de aborto. São `Error.message`, e cada um significa uma coisa só. */
export const ERRO_METODO_INDEFINIDO = 'metodo_indefinido'
export const ERRO_TOKEN_AUSENTE = 'token_ausente'
export const ERRO_PARCELAMENTO_INDEFINIDO = 'parcelamento_indefinido'

/**
 * Resto do nome depois do primeiro espaço. O servidor já monta o `first_name`
 * a partir do nome do cliente (`index.ts:470`); o sobrenome é o único pedaço
 * que ele aceita de fora.
 *
 * Espaços repetidos são colapsados: `"Maria   Silva"` tem sobrenome `"Silva"`,
 * não `"  Silva"`, e um sobrenome com espaço na frente é lixo que iria para a
 * fatura do cliente.
 */
export function sobrenomeDe(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean)
  return partes.slice(1).join(' ')
}

function textoObrigatorio(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

/**
 * `issuer_id` utilizável, ou `null` para omitir a chave.
 *
 * String vazia é o caso perigoso: o servidor testa `!= null`, então `''`
 * passaria e o Mercado Pago receberia um emissor em branco. Fora isso o valor
 * atravessa sem conversão de tipo.
 */
function issuerUtilizavel(
  bruto: string | number | null | undefined
): string | number | null {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : null
  if (typeof bruto === 'string') {
    const limpo = bruto.trim()
    return limpo === '' ? null : limpo
  }
  return null
}

/**
 * Monta o payload — ou lança e aborta a venda ANTES de a edge function ser
 * chamada.
 *
 * Lançar é deliberado. As três condições abaixo não têm valor padrão razoável:
 * cobrar à vista quem escolheu 12x, ou mandar um pagamento sem método, é pior
 * do que mostrar uma mensagem e deixar a pessoa tentar de novo.
 */
export function montarFormDataCartao(
  entrada: EntradaFormDataCartao
): FormDataCartao {
  const metodo = textoObrigatorio(entrada.paymentMethodId)
  if (metodo === null) throw new Error(ERRO_METODO_INDEFINIDO)

  const token = textoObrigatorio(entrada.token)
  if (token === null) throw new Error(ERRO_TOKEN_AUSENTE)

  /*
   * A guarda do item 4 do plano, palavra por palavra.
   *
   * O tipo diz `number`, mas o valor real vem do `value` de um <select> e de
   * um estado do React que pode ter sido repopulado no meio do clique. Em
   * runtime chegam aqui `NaN` (de um `Number('')`), `undefined` (de uma opção
   * que sumiu) e string (de um `value` não convertido). Nenhum dos três pode
   * virar "1x" em silêncio.
   */
  const parcelas = entrada.installments
  if (typeof parcelas !== 'number' || !Number.isInteger(parcelas) || parcelas < 1) {
    throw new Error(ERRO_PARCELAMENTO_INDEFINIDO)
  }

  const emissor = issuerUtilizavel(entrada.issuerId)
  const sobrenome = sobrenomeDe(entrada.nomeCompleto ?? '')

  return {
    payment_method_id: metodo,
    token,
    installments: parcelas,
    ...(emissor !== null && { issuer_id: emissor }),
    ...(sobrenome !== '' && { payer: { last_name: sobrenome } }),
  }
}
