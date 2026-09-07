/**
 * Carregador do SDK v2 do Mercado Pago. Mesma mecânica já provada na
 * PagarPage: uma única tag <script> por sessão, promessa memorizada para que
 * remontagens do Brick (troca de bump/cupom altera o valor) não baixem o SDK
 * de novo. Falha limpa a memória para permitir nova tentativa.
 */

const MP_SDK_URL = 'https://sdk.mercadopago.com/js/v2'

export interface BrickController {
  unmount: () => void
  /**
   * Recolhe o formulário de novo e gera um NOVO token do cartão. É o único
   * caminho para o segundo token (o do submit é de uso único e morre ao criar
   * o pagamento). Opcional na tipagem porque nem toda versão do Brick expõe.
   */
  getFormData?: () => Promise<unknown>
}

/** Teto para o token acessório: passou disso, a venda segue sem ele. */
const TIMEOUT_TOKEN_EXTRA_MS = 5000

function extrairToken(resposta: unknown): string | null {
  if (typeof resposta !== 'object' || resposta === null) return null
  const raiz = resposta as Record<string, unknown>
  // O Brick devolve ora { token }, ora { formData: { token } }.
  const interno = raiz.formData
  const token =
    typeof interno === 'object' && interno !== null
      ? (interno as Record<string, unknown>).token
      : raiz.token
  return typeof token === 'string' && token.trim() !== '' ? token : null
}

/**
 * Segundo token do cartão, para o servidor SALVAR o cartão e a tela de upsell
 * poder cobrar sem pedir o número de novo.
 *
 * Regra de ouro: isto é acessório. Qualquer falha — método sem cartão, Brick
 * sem `getFormData`, exceção, demora — devolve `null` e o pagamento segue. A
 * venda principal vale mais que o upsell, e um `await` pendurado aqui
 * congelaria o botão de pagar em cima de quem já decidiu comprar.
 */
export async function gerarTokenParaSalvar(
  controller: BrickController | null,
  formData: unknown
): Promise<string | null> {
  const metodo = (formData as { payment_method_id?: unknown } | null)
    ?.payment_method_id
  // Pix não tem cartão para salvar.
  if (metodo === 'pix' || typeof controller?.getFormData !== 'function') {
    return null
  }

  try {
    const resposta = await Promise.race([
      controller.getFormData(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_TOKEN_EXTRA_MS)
      ),
    ])
    return extrairToken(resposta)
  } catch {
    return null
  }
}

export interface MercadoPagoSdk {
  bricks: () => {
    create: (
      brick: string,
      containerId: string,
      settings: Record<string, unknown>
    ) => Promise<BrickController>
  }
}

type ConstrutorMp = new (key: string, opts: { locale: string }) => MercadoPagoSdk

/**
 * Acesso ao SDK global.
 *
 * Deliberadamente SEM `declare global`: a PagarPage já declara
 * `Window.MercadoPago`, e duas declarações do mesmo membro em arquivos
 * diferentes fazem o TypeScript recusar o build inteiro (TS2717). Um cast
 * local aqui mantém os dois módulos independentes — nenhum precisa saber que o
 * outro existe.
 */
export function mpGlobal(): ConstrutorMp | undefined {
  return (window as unknown as { MercadoPago?: ConstrutorMp }).MercadoPago
}

let sdkPromise: Promise<void> | null = null

export function carregarMpSdk(): Promise<void> {
  if (mpGlobal()) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = MP_SDK_URL
      script.onload = () => resolve()
      script.onerror = () => {
        sdkPromise = null
        reject(new Error('sdk_load_failed'))
      }
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

/** Recusas mais comuns do MP, traduzidas em algo que o comprador possa agir. */
export const MENSAGENS_RECUSA: Record<string, string> = {
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
  cc_rejected_bad_filled_date: 'Confira a validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança.',
  cc_rejected_bad_filled_other: 'Confira os dados digitados.',
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente.',
  cc_rejected_call_for_authorize:
    'O banco pediu autorização — ligue para o emissor e tente de novo.',
  cc_rejected_duplicated_payment: 'Este pagamento já foi feito.',
  cc_rejected_high_risk:
    'Recusado pela análise de risco. Tente Pix ou outro cartão.',
}
