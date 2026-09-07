/**
 * Tokenização do cartão salvo, no NAVEGADOR.
 *
 * Por que existe: o código de segurança não pode passar pelo nosso servidor.
 * Se ele trafegasse pela edge function, a Vertix entraria no escopo do
 * PCI-DSS sem ganho nenhum — e a API de pagamentos do Mercado Pago nem aceita
 * CVV solto. O caminho correto é o SDK do MP renderizar o campo dentro de um
 * iframe do próprio MP, ler o código de lá e devolver um token de uso único.
 * Nada além desse token sai daqui.
 *
 * Consequência prática: o `<input>` do CVV NÃO é nosso. Montamos um container
 * vazio e o SDK injeta o campo dentro dele; por isso o estilo do que a pessoa
 * digita vai em `ESTILO_CAMPO` (aplicado dentro do iframe) e não em classes
 * Tailwind. A moldura (borda, fundo, altura) continua sendo nossa.
 */

const MP_SDK_URL = 'https://sdk.mercadopago.com/js/v2'

/**
 * Public Key do MP: pública por definição (identifica a conta no SDK do
 * navegador); o segredo de verdade é o Access Token, que só existe nas edge
 * functions. Repetida aqui porque a página de pagamento não a exporta — a env
 * é o override para quando a conta mudar.
 */
const MP_PUBLIC_KEY =
  (import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined) ??
  'APP_USR-53c10a53-70e6-4c45-90eb-cc3472aa51dd'

/** Id do container onde o SDK monta o campo de código de segurança. */
export const CVV_CONTAINER_ID = 'vertix-upsell-cvv'

// ---------------------------------------------------------------------------
// Tipagem mínima do SDK carregado via <script>
// ---------------------------------------------------------------------------
// `window.MercadoPago` já é declarado globalmente pela página de pagamento com
// outro formato (bricks). Redeclarar aqui quebraria a compilação, então o
// acesso é por cast local — sem `declare global`.

export interface CampoSeguro {
  mount: (containerId: string) => CampoSeguro
  unmount: () => CampoSeguro
  on: (evento: string, callback: (dado?: unknown) => void) => CampoSeguro
}

interface CamposMp {
  create: (tipo: string, opcoes?: Record<string, unknown>) => CampoSeguro
  createCardToken: (dados: { cardId: string }) => Promise<{ id?: string }>
}

interface InstanciaMp {
  fields: CamposMp
}

type ConstrutorMp = new (
  chave: string,
  opcoes: { locale: string }
) => InstanciaMp

function construtorMp(): ConstrutorMp | undefined {
  return (window as unknown as { MercadoPago?: ConstrutorMp }).MercadoPago
}

// ---------------------------------------------------------------------------
// Carga do SDK
// ---------------------------------------------------------------------------

let promessaSdk: Promise<void> | null = null

/**
 * Carrega o SDK uma única vez por sessão. A promessa é memoizada para que dois
 * componentes montando ao mesmo tempo não injetem dois <script>; em caso de
 * falha ela é zerada, para que uma nova tentativa possa acontecer.
 */
export function carregarSdkMp(): Promise<void> {
  if (construtorMp()) return Promise.resolve()
  if (promessaSdk) return promessaSdk

  promessaSdk = new Promise<void>((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(
      `script[src="${MP_SDK_URL}"]`
    )
    const script = existente ?? document.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      promessaSdk = null
      reject(new Error('sdk_indisponivel'))
    })
    if (!existente) {
      script.src = MP_SDK_URL
      script.async = true
      document.head.appendChild(script)
    }
  })

  return promessaSdk
}

// ---------------------------------------------------------------------------
// Campo de código de segurança
// ---------------------------------------------------------------------------

/**
 * Estilo aplicado DENTRO do iframe do MP. Espelha o input que a tela usava
 * antes (texto claro, tamanho grande, dígitos espaçados) para que a troca por
 * campo seguro seja invisível para quem digita.
 */
const ESTILO_CAMPO: Record<string, string> = {
  color: '#F4F4F0',
  'font-size': '20px',
  'font-family': 'Kanit, sans-serif',
  'letter-spacing': '6px',
  placeholderColor: '#8A8A82',
}

export interface CampoMontado {
  instancia: InstanciaMp
  campo: CampoSeguro
  desmontar: () => void
}

/**
 * Monta o campo de CVV no container e resolve quando o SDK avisa que está
 * pronto. `aoFicarPronto` é chamado no evento 'ready' — é o que permite trocar
 * o esqueleto de carregamento pelo campo real sem piscar.
 */
export async function montarCampoCvv(
  aoFicarPronto: () => void
): Promise<CampoMontado> {
  await carregarSdkMp()
  const MercadoPago = construtorMp()
  if (!MercadoPago) throw new Error('sdk_indisponivel')

  const instancia = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })
  const campo = instancia.fields
    .create('securityCode', {
      placeholder: '•••',
      style: ESTILO_CAMPO,
    })
    .mount(CVV_CONTAINER_ID)

  campo.on('ready', aoFicarPronto)

  return {
    instancia,
    campo,
    desmontar: () => {
      try {
        campo.unmount()
      } catch {
        // Desmontar já desmontado não é erro que mereça derrubar a tela.
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Geração do token
// ---------------------------------------------------------------------------

export type ResultadoToken =
  | { ok: true; token: string }
  | { ok: false; erro: string }

/**
 * Códigos de validação do SDK que significam "o código de segurança digitado
 * está vazio ou inválido" — os únicos que a pessoa consegue corrigir sozinha.
 */
const CODIGOS_CVV_INVALIDO = [
  'security_code',
  'invalid_parameter',
  '221',
  'E301',
  'E302',
]

function ehErroDeCvv(causa: unknown): boolean {
  const texto = JSON.stringify(causa ?? '')
  return CODIGOS_CVV_INVALIDO.some((codigo) => texto.includes(codigo))
}

/**
 * Gera o token de uso único a partir do cartão salvo mais o CVV que está no
 * campo seguro. O CVV nunca é lido por este código — quem o lê é o iframe do
 * MP. Devolvemos um resultado em vez de lançar para que a página trate os dois
 * desfechos pelo mesmo caminho.
 */
export async function gerarCardToken(
  montado: CampoMontado,
  cardId: string
): Promise<ResultadoToken> {
  try {
    const token = await montado.instancia.fields.createCardToken({ cardId })
    if (!token?.id) return { ok: false, erro: 'token_vazio' }
    return { ok: true, token: token.id }
  } catch (causa) {
    return { ok: false, erro: ehErroDeCvv(causa) ? 'cvv_invalido' : 'token_falhou' }
  }
}
