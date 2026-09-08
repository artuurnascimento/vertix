/**
 * Os três campos seguros do cartão: criar, montar, desmontar, reconfigurar por
 * bandeira e tokenizar.
 *
 * Regra que atravessa o arquivo inteiro: número, validade e CVV vivem dentro
 * de iframes do Mercado Pago. Este módulo nunca lê o que a pessoa digitou —
 * só orquestra o SDK e devolve um token de uso único. É o que mantém a Vertix
 * fora do escopo do PCI-DSS.
 *
 * A moldura (fundo, borda, raio, anel de foco) é do NOSSO container: o iframe
 * só aceita a lista fechada de `EstiloCampo`, sem pseudo-classes. Por isso os
 * eventos `focus`/`blur` existem — é o container que reage a eles.
 */

import type {
  CampoSeguro,
  DadosNaoPci,
  EstiloCampo,
  FonteCampo,
  InstanciaMp,
  MetodoPagamentoMp,
  RespostaMetodosPagamento,
  SettingsCartao,
  TipoCampo,
} from './mpTipos'

// ---------------------------------------------------------------------------
// Containers e aparência
// ---------------------------------------------------------------------------

export const ID_CAMPO_NUMERO = 'vtx-campo-numero'
export const ID_CAMPO_VALIDADE = 'vtx-campo-validade'
export const ID_CAMPO_CVV = 'vtx-campo-cvv'

/**
 * Estilo aplicado DENTRO do iframe.
 *
 * `height: 100%` + altura fixa no nosso container é o que faz o texto do MP
 * ficar centrado na caixa que desenhamos. `padding: 0` porque o respiro
 * horizontal também é nosso — dobrar o padding empurraria os dígitos para fora
 * em telas de 320px.
 *
 * Nada de `letterSpacing`, `background`, `border` ou `boxShadow`: não estão na
 * lista aceita e o SDK descarta em silêncio. O tipo `EstiloCampo` recusa.
 */
export const ESTILO_CAMPO: EstiloCampo = {
  color: '#F4F4F0',
  fontSize: '18px',
  fontFamily: 'Kanit',
  placeholderColor: '#8A8A82',
  height: '100%',
  padding: '0px',
}

/**
 * `customFonts` CARREGA a fonte no iframe; `ESTILO_CAMPO.fontFamily` APLICA.
 * Um sem o outro não faz nada — o campo cai no `sans-serif` do sistema e a
 * caixa do cartão passa a destoar do resto do checkout.
 */
export const FONTES_CAMPO: FonteCampo[] = [
  { src: 'https://fonts.googleapis.com/css2?family=Kanit:wght@400;600' },
]

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export interface CamposCartao {
  numero: CampoSeguro
  validade: CampoSeguro
  cvv: CampoSeguro
}

interface Definicao {
  tipo: TipoCampo
  containerId: string
  placeholder: string
  srLabel: string
}

const DEF_NUMERO: Definicao = {
  tipo: 'cardNumber',
  containerId: ID_CAMPO_NUMERO,
  placeholder: '0000 0000 0000 0000',
  srLabel: 'Número do cartão',
}
const DEF_VALIDADE: Definicao = {
  tipo: 'expirationDate',
  containerId: ID_CAMPO_VALIDADE,
  placeholder: 'MM/AA',
  srLabel: 'Validade do cartão',
}
const DEF_CVV: Definicao = {
  tipo: 'securityCode',
  containerId: ID_CAMPO_CVV,
  placeholder: '•••',
  srLabel: 'Código de segurança',
}

function criarUm(mp: InstanciaMp, def: Definicao): CampoSeguro {
  return mp.fields.create(def.tipo, {
    placeholder: def.placeholder,
    style: ESTILO_CAMPO,
    customFonts: FONTES_CAMPO,
    // O rótulo visível é nosso `<label>`; este é o que o leitor de tela ouve
    // ao entrar no iframe, onde o nosso label não alcança.
    srLabel: def.srLabel,
    ariaRequired: true,
  })
}

/**
 * Cria os três campos SEM montar.
 *
 * `expirationDate` é um campo só. Criar `expirationMonth`/`expirationYear`
 * junto faz o SDK lançar "cannot coexist" e derruba o formulário inteiro.
 */
export function criarCampos(mp: InstanciaMp): CamposCartao {
  return {
    numero: criarUm(mp, DEF_NUMERO),
    validade: criarUm(mp, DEF_VALIDADE),
    cvv: criarUm(mp, DEF_CVV),
  }
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

function paresDeMontagem(campos: CamposCartao): [CampoSeguro, string][] {
  return [
    [campos.numero, DEF_NUMERO.containerId],
    [campos.validade, DEF_VALIDADE.containerId],
    [campos.cvv, DEF_CVV.containerId],
  ]
}

/**
 * Monta os três campos.
 *
 * `mount()` recebe o id como STRING e lança se `getElementById` devolver
 * `null` — por isso a checagem vem antes, e não no meio da montagem: montar
 * dois e falhar no terceiro deixaria o formulário pela metade. Devolve `false`
 * sem lançar quando algum container ainda não está no DOM; quem chama tenta de
 * novo no próximo quadro.
 *
 * Cada `mount()` vai em try/catch individual porque no StrictMode do React 19
 * o efeito roda duas vezes e o SDK lança `already mounted` na segunda — ruído
 * de desenvolvimento, não falha de produto. Engolir é seguro: o sinal real de
 * que um campo subiu é o evento `ready`, e quem escuta esse evento percebe a
 * ausência sem depender do retorno daqui.
 */
export function montar(campos: CamposCartao): boolean {
  const pares = paresDeMontagem(campos)
  if (pares.some(([, id]) => document.getElementById(id) === null)) return false

  for (const [campo, id] of pares) {
    try {
      campo.mount(id)
    } catch {
      // Já montado — o caso normal do StrictMode.
    }
  }
  return true
}

/**
 * Desmonta os três. Cada um no SEU try/catch: `unmount()` lança
 * `Field '<tipo>' already unmounted`, e um catch compartilhado deixaria os
 * campos seguintes montados para sempre — iframes órfãos numa página que a
 * pessoa ainda vai usar para pagar.
 */
export function desmontarTudo(campos: CamposCartao): void {
  for (const [campo] of paresDeMontagem(campos)) {
    try {
      campo.unmount()
    } catch {
      // Desmontar o que já saiu não é erro que mereça derrubar a tela.
    }
  }
}

// ---------------------------------------------------------------------------
// Reconfiguração por bandeira
// ---------------------------------------------------------------------------

/** `results[0]` de `getPaymentMethods({ bin })`, ou `null`. */
export function primeiroMetodo(
  resposta: RespostaMetodosPagamento | null | undefined
): MetodoPagamentoMp | null {
  return resposta?.results?.[0] ?? null
}

/**
 * `settings[0]` do método.
 *
 * `settings` é ARRAY. `metodo.settings.security_code` é `undefined` e não
 * quebra em runtime — só faz o CVV continuar validando 3 dígitos para sempre,
 * e o Amex nunca passar. Este acessador existe para que esse erro não tenha
 * onde acontecer.
 */
export function settingsDoMetodo(
  metodo: MetodoPagamentoMp | null | undefined
): SettingsCartao | null {
  return metodo?.settings?.[0] ?? null
}

/**
 * Aplica o `updatePCIFieldsSettings`: comprimento e modo do CVV, comprimento e
 * validação do número. Sem isto o Amex (15 dígitos, CVV de 4) é recusado pelo
 * próprio campo, antes de chegar ao MP.
 *
 * `security_code.card_location` NÃO entra: `update()` não aceita. Ele é
 * informativo e serve ao cartão 3D — é o que diz se o CVV fica na frente.
 */
export function atualizarSettings(
  campos: CamposCartao,
  settings: SettingsCartao
): void {
  try {
    campos.cvv.update({
      settings: {
        mode: settings.security_code.mode,
        length: settings.security_code.length,
      },
    })
  } catch {
    // Campo desmontado no meio da resposta do BIN: a tela já mudou.
  }
  try {
    campos.numero.update({
      settings: {
        length: settings.card_number.length,
        validation: settings.card_number.validation,
      },
    })
  } catch {
    // idem
  }
}

// ---------------------------------------------------------------------------
// Tokenização
// ---------------------------------------------------------------------------

/** Teto do token acessório: passou disso, a venda segue sem cartão salvo. */
export const TIMEOUT_TOKEN_ACESSORIO_MS = 5000

export interface DadosTitular {
  /** Nome como está no cartão — input NOSSO, não vem de iframe nenhum. */
  nomeTitular: string
  /** CPF ou CNPJ, com ou sem máscara. */
  documento: string
}

/**
 * CPF ou CNPJ pelo tamanho, mesma regra do servidor
 * (`checkout-pagar/index.ts:472-477`). Divergir daqui faria a tokenização
 * passar e a cobrança falhar depois, com o dinheiro já prometido na tela.
 */
export function tipoDeDocumento(documento: string): 'CPF' | 'CNPJ' {
  return apenasDigitos(documento).length > 11 ? 'CNPJ' : 'CPF'
}

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** Monta o `nonPCIData` — e só ele. Número, validade e CVV o SDK lê dos
 *  iframes; passar qualquer um deles aqui é erro de integração. */
export function dadosNaoPci({ nomeTitular, documento }: DadosTitular): DadosNaoPci {
  return {
    cardholderName: nomeTitular.trim(),
    identificationType: tipoDeDocumento(documento),
    identificationNumber: apenasDigitos(documento),
  }
}

/**
 * Token do cartão a partir dos campos MONTADOS.
 *
 * Lança de propósito: o erro cru do SDK carrega os códigos (`205`, `E301`,
 * `224`, `E302`, …) que a camada de mensagens traduz em "confira o campo X".
 * Engolir aqui apagaria essa informação. `token_vazio` é o caso da assinatura
 * `Promise<CardTokenResponse | void>` — o SDK pode resolver sem nada.
 */
export async function criarToken(
  mp: InstanciaMp,
  titular: DadosTitular
): Promise<string> {
  const token = await mp.fields.createCardToken(dadosNaoPci(titular))
  if (!token?.id) throw new Error('token_vazio')
  return token.id
}

/**
 * Segundo token, o que permite ao servidor SALVAR o cartão para o upsell de um
 * clique.
 *
 * Regra de ouro herdada do Brick: isto é ACESSÓRIO. Qualquer falha — exceção,
 * token vazio, demora — devolve `null` e o pagamento segue. A venda principal
 * vale mais que o upsell, e um `await` pendurado aqui congelaria o botão de
 * pagar em cima de quem já decidiu comprar.
 */
export async function criarTokenAcessorio(
  mp: InstanciaMp,
  titular: DadosTitular,
  timeoutMs: number = TIMEOUT_TOKEN_ACESSORIO_MS
): Promise<string | null> {
  try {
    return await Promise.race([
      criarToken(mp, titular),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
  } catch {
    return null
  }
}
