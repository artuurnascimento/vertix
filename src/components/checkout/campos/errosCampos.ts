/**
 * Erros dos Secure Fields traduzidos para o que o comprador lê.
 *
 * Funções puras: sem React, sem SDK, sem rede. Ficam separadas porque o mapa
 * de código → campo é dado conferível — e porque errar esse mapa manda a
 * pessoa corrigir o campo errado, que é pior do que não dizer nada.
 *
 * Duas fontes de erro, dois caminhos:
 *  - `validityChange` durante a digitação → `mensagemDeValidade`
 *  - `createCardToken` no envio          → `mensagemDeToken` / `campoDoErro`
 */

// ---------------------------------------------------------------------------
// Vocabulário de campos
// ---------------------------------------------------------------------------

/** Campos do formulário que podem receber destaque de erro. */
export type CampoCartao = 'numero' | 'validade' | 'cvv' | 'titular' | 'documento'

/**
 * Nomes que o SDK usa no `field` dos eventos. Os três de validade convergem
 * para o mesmo campo nosso: a tela monta um `expirationDate` só (MM/AA), então
 * mês e ano nunca têm caixa própria para destacar.
 */
const CAMPO_POR_NOME_SDK: Record<string, CampoCartao> = {
  cardNumber: 'numero',
  securityCode: 'cvv',
  expirationDate: 'validade',
  expirationMonth: 'validade',
  expirationYear: 'validade',
}

/** Traduz o `field` de um evento do SDK para o campo da nossa tela. */
export function campoDoSdk(nomeSdk: string): CampoCartao | null {
  return Object.hasOwn(CAMPO_POR_NOME_SDK, nomeSdk)
    ? CAMPO_POR_NOME_SDK[nomeSdk]
    : null
}

// ---------------------------------------------------------------------------
// Códigos do createCardToken
// ---------------------------------------------------------------------------

interface EntradaDeCodigo {
  readonly campo: CampoCartao
  /** true = o parâmetro chegou em branco; false = veio preenchido e inválido. */
  readonly vazio: boolean
}

/**
 * Tabela extraída do bundle do SDK v2 (a página de docs desses códigos está
 * fora do ar). Um código, um campo — a busca é por IGUALDADE EXATA.
 *
 * Por que isso importa: `src/components/upsell/cardToken.ts` testa os códigos
 * com `JSON.stringify(causa).includes(codigo)`, e por isso trata `221` (nome do
 * titular vazio) e `E301` (número inválido) como se fossem CVV. Os de CVV são
 * `224` e `E302`. Substring também casa por acidente: "1221" contém "221".
 */
const CODIGOS: Record<string, EntradaDeCodigo> = {
  '205': { campo: 'numero', vazio: true },
  E301: { campo: 'numero', vazio: false },
  '208': { campo: 'validade', vazio: true },
  '325': { campo: 'validade', vazio: false },
  '209': { campo: 'validade', vazio: true },
  '326': { campo: 'validade', vazio: false },
  '212': { campo: 'documento', vazio: true },
  '322': { campo: 'documento', vazio: false },
  '214': { campo: 'documento', vazio: true },
  '324': { campo: 'documento', vazio: false },
  '221': { campo: 'titular', vazio: true },
  '316': { campo: 'titular', vazio: false },
  '224': { campo: 'cvv', vazio: true },
  E302: { campo: 'cvv', vazio: false },
}

function entradaDoCodigo(codigo: string): EntradaDeCodigo | null {
  const normalizado = normalizarCodigo(codigo)
  if (normalizado === null) return null
  return Object.hasOwn(CODIGOS, normalizado) ? CODIGOS[normalizado] : null
}

/** Campo a destacar para um código do `createCardToken`. */
export function campoDoCodigo(codigo: string): CampoCartao | null {
  return entradaDoCodigo(codigo)?.campo ?? null
}

// ---------------------------------------------------------------------------
// Extração dos códigos de um erro de formato desconhecido
// ---------------------------------------------------------------------------

/** Profundidade e volume são limitados: erro cru é entrada não confiável. */
const PROFUNDIDADE_MAXIMA = 6
const MAXIMO_DE_CODIGOS = 12
const TAMANHO_MAXIMO_DO_CODIGO = 24

/**
 * Onde o SDK costuma pendurar a lista de causas. `cause` de um
 * `new Error(msg, { cause })` NÃO é enumerável — varrer só `Object.keys`
 * perderia justamente o caso mais provável.
 */
const CHAVES_DE_CAUSA = [
  'cause',
  'causes',
  'error',
  'errors',
  'errorMessages',
  'data',
  'response',
] as const

function normalizarCodigo(bruto: string | number): string | null {
  const texto = String(bruto).trim().toUpperCase()
  if (texto === '' || texto.length > TAMANHO_MAXIMO_DO_CODIGO) return null
  return texto
}

function chavesParaVarrer(objeto: Record<string, unknown>): string[] {
  const chaves = Object.keys(objeto)
  for (const chave of CHAVES_DE_CAUSA) {
    if (!chaves.includes(chave) && chave in objeto) chaves.push(chave)
  }
  return chaves
}

/**
 * `candidato` diz se o valor atual pode SER um código (o erro inteiro, ou um
 * item de lista) ou se é só um lugar por onde passar. Sem essa distinção,
 * qualquer texto solto — a descrição em inglês, por exemplo — viraria código.
 */
function coletar(
  valor: unknown,
  candidato: boolean,
  achados: string[],
  vistos: Set<object>,
  profundidade: number
): void {
  if (achados.length >= MAXIMO_DE_CODIGOS) return
  if (profundidade > PROFUNDIDADE_MAXIMA) return

  if (typeof valor === 'string' || typeof valor === 'number') {
    if (!candidato) return
    acrescentar(normalizarCodigo(valor), achados)
    return
  }

  if (valor === null || typeof valor !== 'object') return
  if (vistos.has(valor)) return
  vistos.add(valor)

  if (Array.isArray(valor)) {
    for (const item of valor) {
      coletar(item, true, achados, vistos, profundidade + 1)
    }
    return
  }

  const objeto = valor as Record<string, unknown>
  const bruto = objeto.code
  if (typeof bruto === 'string' || typeof bruto === 'number') {
    acrescentar(normalizarCodigo(bruto), achados)
  }

  for (const chave of chavesParaVarrer(objeto)) {
    coletar(objeto[chave], false, achados, vistos, profundidade + 1)
  }
}

function acrescentar(codigo: string | null, achados: string[]): void {
  if (codigo === null || achados.includes(codigo)) return
  achados.push(codigo)
}

/**
 * Códigos que dá para achar num erro do `createCardToken`, sem exigir formato:
 * o SDK pode lançar a lista crua, um `{ cause: [...] }`, um `Error` com
 * `cause`, ou a string do código. Devolve em MAIÚSCULAS, sem repetição, na
 * ordem em que apareceram. Lista vazia quando nada tem cara de código.
 */
export function extrairCodigos(erro: unknown): string[] {
  const achados: string[] = []
  coletar(erro, true, achados, new Set<object>(), 0)
  return achados
}

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------

const GENERICA_TOKEN =
  'Não foi possível validar o cartão. Confira os dados e tente de novo.'
const GENERICA_CAMPO = 'Confira os dados do cartão.'

/**
 * O CVV tem 3 dígitos na maioria das bandeiras e 4 no Amex — quem informa é o
 * `settings` do BIN. Sem esse número a mensagem não inventa um.
 */
function digitosUteis(digitosCvv: number | undefined): number | null {
  if (digitosCvv === undefined) return null
  if (!Number.isInteger(digitosCvv)) return null
  if (digitosCvv < 3 || digitosCvv > 8) return null
  return digitosCvv
}

function textoDoCvv(vazio: boolean, digitosCvv: number | undefined): string {
  const digitos = digitosUteis(digitosCvv)
  if (digitos === null) {
    return vazio
      ? 'Digite o código de segurança do cartão.'
      : 'Confira o código de segurança do cartão.'
  }
  return vazio
    ? `Digite os ${digitos} dígitos do código de segurança.`
    : `Confira o código de segurança: são ${digitos} dígitos.`
}

/** Compartilhados entre o erro de tokenização e o de digitação. */
const NUMERO_CONFERIR = 'Confira o número do cartão.'
const NUMERO_DIGITO_TROCADO =
  'Confira o número do cartão — algum dígito está trocado.'
const VALIDADE_PREENCHER = 'Preencha a validade do cartão, no formato MM/AA.'
const VALIDADE_CONFERIR =
  'Confira a validade: use MM/AA e veja se o cartão não venceu.'

/**
 * Texto por campo. Sempre no imperativo, dizendo o que fazer — "Confira o
 * número do cartão." resolve; "Número inválido." só informa que o sistema
 * ficou insatisfeito.
 */
function textoDoCampo(
  campo: CampoCartao,
  vazio: boolean,
  digitosCvv?: number
): string {
  switch (campo) {
    case 'numero':
      return vazio ? 'Digite o número do cartão.' : NUMERO_DIGITO_TROCADO
    case 'validade':
      return vazio ? VALIDADE_PREENCHER : VALIDADE_CONFERIR
    case 'cvv':
      return textoDoCvv(vazio, digitosCvv)
    case 'titular':
      return vazio
        ? 'Digite o nome do titular como está impresso no cartão.'
        : 'Confira o nome do titular — use só letras, como está no cartão.'
    case 'documento':
      return vazio
        ? 'Informe o CPF ou CNPJ do titular.'
        : 'Confira o CPF ou CNPJ — digite só os números.'
  }
}

function primeiraEntrada(erro: unknown): EntradaDeCodigo | null {
  for (const codigo of extrairCodigos(erro)) {
    const entrada = entradaDoCodigo(codigo)
    if (entrada !== null) return entrada
  }
  return null
}

/** Campo a destacar depois de o `createCardToken` falhar. */
export function campoDoErro(erro: unknown): CampoCartao | null {
  return primeiraEntrada(erro)?.campo ?? null
}

/**
 * Mensagem para uma falha do `createCardToken`. Código desconhecido cai na
 * genérica: o SDK devolve descrição em inglês, e mostrá-la crua seria pior do
 * que dizer pouco em português.
 */
export function mensagemDeToken(erro: unknown, digitosCvv?: number): string {
  const entrada = primeiraEntrada(erro)
  if (entrada === null) return GENERICA_TOKEN
  return textoDoCampo(entrada.campo, entrada.vazio, digitosCvv)
}

/**
 * Mensagem para um `validityChange` com `errorMessages` não vazio. `cause` vem
 * de dentro de `errorMessages[i]`; `nomeSdkDoCampo` é o `field` do evento.
 *
 * Campo válido não passa por aqui — o SDK sinaliza validade com a lista vazia,
 * e não existe getter síncrono para consultar depois.
 */
export function mensagemDeValidade(
  cause: string | null | undefined,
  nomeSdkDoCampo: string,
  digitosCvv?: number
): string {
  const campo = campoDoSdk(nomeSdkDoCampo)
  if (campo === null) return GENERICA_CAMPO

  switch (campo) {
    case 'numero':
      // invalid_value é a reprovação no Luhn: a quantidade de dígitos está
      // certa e um deles está trocado. invalid_length/invalid_type é número
      // ainda incompleto — apontar um dígito trocado ali seria mentira.
      return cause === 'invalid_value' ? NUMERO_DIGITO_TROCADO : NUMERO_CONFERIR
    case 'validade':
      // invalid_value cobre mês fora de 1-12 e cartão vencido; o evento não
      // separa os dois, então a mensagem cita os dois.
      return cause === 'invalid_value' ? VALIDADE_CONFERIR : VALIDADE_PREENCHER
    case 'cvv':
      return textoDoCvv(cause === 'invalid_length', digitosCvv)
    default:
      return GENERICA_CAMPO
  }
}
