/**
 * Tipagem do Secure Fields (`mp.fields`) do SDK v2 do Mercado Pago.
 *
 * Por que existe um arquivo só de tipos: o SDK chega por `<script>` e não traz
 * `.d.ts`. Sem esta camada, cada consumidor faria `as any` e a primeira
 * armadilha do SDK — `settings` ser um ARRAY, `style` aceitar só um punhado de
 * propriedades, `createCardToken` poder resolver vazio — só apareceria em
 * produção. Aqui elas viram erro de compilação.
 *
 * Nada aqui foi inventado: os campos vêm de
 * https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md e do bundle
 * publicado em https://sdk.mercadopago.com/js/v2.
 */

// ---------------------------------------------------------------------------
// Campos e eventos
// ---------------------------------------------------------------------------

/**
 * Os três campos que montamos.
 *
 * `expirationDate` é um campo só e NUNCA pode coexistir com
 * `expirationMonth`/`expirationYear` — o SDK lança
 * "field cardExpirationDate cannot coexist with cardExpirationMonth or
 * cardExpirationYear". Por isso os dois separados ficam de fora deste union.
 */
export type TipoCampo = 'cardNumber' | 'expirationDate' | 'securityCode'

/** Eventos cujo payload é só `{ field }`. */
export type EventoSimples = 'focus' | 'blur' | 'ready' | 'change' | 'paste'

/**
 * Os 8 eventos que existem, e só esses. A prosa da doc oficial cita 4; a
 * tabela da mesma página e o registro do bundle listam 8. Vale o bundle:
 *   default: focus, blur, ready, validityChange, error, change, paste
 *   cardNumber: + binChange
 */
export type EventoCampo =
  | EventoSimples
  | 'validityChange'
  | 'error'
  | 'binChange'

/** Payload de `focus`, `blur`, `ready`, `change` e `paste`. Nada mais que isso
 *  — em particular, `change` NÃO traz o valor nem a contagem de dígitos. */
export interface EventoPadrao {
  field: string
}

/**
 * Payload de `binChange` (exclusivo de `cardNumber`). Dispara na TRANSIÇÃO
 * entre válido e inválido, não a cada tecla, e repete — quem escuta precisa do
 * guard `bin !== binAnterior`.
 */
export interface EventoBin {
  field: string
  bin: string | null
}

/** Uma linha de `EventoValidade.errorMessages`. */
export interface MensagemValidade {
  message: string
  /** `invalid_type` · `invalid_length` · `invalid_value`. */
  cause: string
}

/**
 * Payload de `validityChange`. O campo está VÁLIDO quando `errorMessages` vem
 * vazio — não existe getter síncrono (`field.isValid()` não existe), então o
 * estado por campo só pode ser mantido a partir deste evento.
 */
export interface EventoValidade {
  field: string
  errorMessages: MensagemValidade[]
}

/** Payload de `error`. */
export interface EventoErroCampo {
  field: string
  error: string
}

// ---------------------------------------------------------------------------
// Estilo
// ---------------------------------------------------------------------------

/**
 * Lista FECHADA das propriedades de estilo que o iframe do MP aceita.
 *
 * Deliberadamente sem index signature: é o que impede alguém de escrever
 * `letterSpacing`, `background`, `border` ou `boxShadow` aqui e achar que
 * funcionou — o SDK descarta em silêncio. Fundo, borda, raio, sombra e todo o
 * estado visual de foco são CSS do NOSSO container, reagindo a `focus`/`blur`.
 * É para isso que esses dois eventos existem.
 */
export interface EstiloCampo {
  color?: string
  fontFamily?: string
  fontSize?: string
  fontStyle?: string
  fontVariant?: string
  fontWeight?: string
  height?: string
  margin?: string
  marginBottom?: string
  marginLeft?: string
  marginRight?: string
  marginTop?: string
  padding?: string
  paddingBottom?: string
  paddingLeft?: string
  paddingRight?: string
  paddingTop?: string
  placeholderColor?: string
  textAlign?: string
  width?: string
}

/**
 * Fonte a carregar DENTRO do iframe. `customFonts` carrega; `style.fontFamily`
 * aplica. Um sem o outro não faz efeito nenhum.
 */
export interface FonteCampo {
  src: string
}

// ---------------------------------------------------------------------------
// Criação e atualização de campo
// ---------------------------------------------------------------------------

export interface OpcoesCampo {
  placeholder?: string
  style?: EstiloCampo
  customFonts?: FonteCampo[]
  /** Rótulo lido por leitor de tela — o `<label>` visível é nosso. */
  srLabel?: string
  ariaRequired?: boolean
}

/**
 * O que `field.update()` aceita.
 *
 * `settings` é o caminho do `updatePCIFieldsSettings`: sem ele o CVV valida 3
 * dígitos sempre e o Amex (4 dígitos, 15 no número) nunca passa.
 *
 * `invalid: true` só escreve `aria-invalid` no input do iframe — NÃO pinta
 * nada. A borda vermelha é do nosso container.
 */
export interface AtualizacaoCampo {
  settings?: {
    /** `mandatory` | `optional`, vindo de `security_code.mode`. */
    mode?: string
    length?: number
    /** `standard` | `none`, vindo de `card_number.validation`. */
    validation?: string
  }
  invalid?: boolean
  placeholder?: string
  style?: EstiloCampo
}

/**
 * Um campo seguro montado (ou por montar).
 *
 * Todos os métodos devolvem o próprio campo — a API do SDK é encadeável.
 * `mount()` recebe o **id como string** (não elemento, não seletor) e lança se
 * `document.getElementById()` devolver `null`; lança também se já estiver
 * montado. `unmount()` lança `Field '<tipo>' already unmounted`.
 */
export interface CampoSeguro {
  mount(containerId: string): CampoSeguro
  unmount(): CampoSeguro
  update(opcoes: AtualizacaoCampo): CampoSeguro
  on(evento: 'binChange', callback: (dado: EventoBin) => void): CampoSeguro
  on(
    evento: 'validityChange',
    callback: (dado: EventoValidade) => void
  ): CampoSeguro
  on(evento: 'error', callback: (dado: EventoErroCampo) => void): CampoSeguro
  on(evento: EventoSimples, callback: (dado: EventoPadrao) => void): CampoSeguro
}

// ---------------------------------------------------------------------------
// getPaymentMethods
// ---------------------------------------------------------------------------

/**
 * `results[0].settings[0]` — o ÚNICO lugar que diz o comprimento do CVV e do
 * número. Medido ao vivo: Visa/Elo = CVV 3, `back`, 16 dígitos;
 * Amex = CVV 4, `front`, 15 dígitos.
 */
export interface SettingsCartao {
  security_code: {
    length: number
    /** `front` no Amex, `back` no resto. Informativo: `update()` não aceita —
     *  serve para o cartão 3D decidir se gira ao focar o CVV. */
    card_location: string
    mode: string
  }
  card_number: {
    length: number
    validation: string
  }
  bin?: {
    pattern?: string
    installments_pattern?: string
    exclusion_pattern?: string | null
  }
}

/**
 * `results[0]` de `getPaymentMethods({ bin })`.
 *
 * `id` é a bandeira (`visa`, `master`, `elo`, `amex`, …) e é exatamente o
 * `payment_method_id` que o servidor espera no `formData`.
 */
export interface MetodoPagamentoMp {
  id: string
  name: string
  payment_type_id: string
  status: string
  /** ARRAY. É `settings[0].security_code.length`, nunca
   *  `settings.security_code.length` — o erro clássico desta integração. */
  settings: SettingsCartao[]
  /** Medido na nossa conta: os 4 métodos de crédito BR não pedem `issuer_id`.
   *  Mantido só como guard de custo zero — não montar select de banco. */
  additional_info_needed: string[]
  thumbnail?: string
  secure_thumbnail?: string
}

export interface RespostaMetodosPagamento {
  results: MetodoPagamentoMp[]
  paging?: { total?: number; limit?: number; offset?: number }
}

// ---------------------------------------------------------------------------
// getInstallments
// ---------------------------------------------------------------------------

/** Uma opção de parcelamento devolvida pelo MP. */
export interface PayerCost {
  installments: number
  /** Teste canônico de juros: `> 0` significa que o comprador paga a mais. */
  installment_rate: number
  discount_rate: number
  /** Medido ao vivo: `["MERCADOPAGO"]` — quem cobra os juros é o MP, em cima
   *  do `transaction_amount`. Juros NUNCA entram no nosso total. */
  installment_rate_collector?: string[]
  labels?: string[]
  min_allowed_amount?: number
  max_allowed_amount?: number
  /** Texto pronto em pt-BR: "12 parcelas de R$ 20,05 (R$ 240,56)". */
  recommended_message: string
  installment_amount: number
  total_amount: number
  payment_method_option_id?: string
}

/**
 * Um elemento do array devolvido por `getInstallments`.
 *
 * `issuer` e `payment_method_id` não aparecem na doc do SDK neste nível, mas
 * vêm na resposta real — é daqui que sai o `issuer_id` opcional do payload.
 */
export interface OfertaParcelas {
  payment_method_id: string
  payment_type_id: string
  processing_mode?: string
  merchant_account_id?: string | null
  payer_costs: PayerCost[]
  /** `getPaymentMethods` devolve número (26), `getInstallments` devolve string
   *  ("26"). O servidor aceita os dois — nunca comparar com `===`. */
  issuer?: { id?: string | number; name?: string }
}

export interface ParametrosParcelas {
  /** Em REAIS, string, duas casas: `(totalCentavos / 100).toFixed(2)`. */
  amount: string
  bin: string
  locale?: string
  /** A doc BR manda; a tabela de `core-methods.md` não lista e o endpoint REST
   *  ignora. Mandamos porque a doc BR manda, mas não dependemos. */
  paymentTypeId?: string
  processingMode?: 'aggregator' | 'gateway'
}

// ---------------------------------------------------------------------------
// Tokenização
// ---------------------------------------------------------------------------

/**
 * O parâmetro de `createCardToken` chama-se literalmente `nonPCIData`: número,
 * validade e CVV o SDK lê dos iframes montados. Passar qualquer um deles aqui
 * é erro.
 */
export interface DadosNaoPci {
  cardholderName: string
  identificationType: 'CPF' | 'CNPJ'
  /** Só dígitos. */
  identificationNumber: string
}

/** Token de uso único, válido por 7 dias. */
export interface CardTokenResponse {
  id?: string
  first_six_digits?: string
  last_four_digits?: string
  expiration_month?: number
  expiration_year?: number
  status?: string
  live_mode?: boolean
  luhn_validation?: boolean
  card_number_length?: number
  security_code_length?: number
  date_created?: string
  date_due?: string
  cardholder?: {
    name?: string
    identification?: { type?: string; number?: string }
  }
}

// ---------------------------------------------------------------------------
// Instância
// ---------------------------------------------------------------------------

export interface CamposMp {
  create(tipo: TipoCampo, opcoes?: OpcoesCampo): CampoSeguro
  /** Pode resolver VAZIO — a assinatura oficial é `Promise<CardTokenResponse |
   *  void>`. Sempre checar `!token?.id`. */
  createCardToken(dados: DadosNaoPci): Promise<CardTokenResponse | void>
}

export interface InstanciaMp {
  fields: CamposMp
  getPaymentMethods(filtros: {
    bin: string
  }): Promise<RespostaMetodosPagamento>
  getInstallments(params: ParametrosParcelas): Promise<OfertaParcelas[]>
}

export type ConstrutorMp = new (
  chave: string,
  opcoes: { locale: string }
) => InstanciaMp
