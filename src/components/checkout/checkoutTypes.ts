/**
 * Formato que a página de checkout consome, e o tradutor do que vem do banco.
 *
 * O RPC `get_checkout_info` devolve JSON solto (`Json`), montado por outra
 * parte do time. Em vez de espalhar `any` pelos componentes, normalizamos uma
 * vez aqui: nomes de campo tolerantes (o banco pode chamar de `preco_centavos`
 * ou `valor_centavos`), tipos garantidos, e `null` quando a seção não existe.
 *
 * Regra: normalizar é traduzir, nunca inventar. Campo ausente vira `null` e a
 * seção correspondente some da tela — nada de texto de exemplo em produção.
 */

export interface ProdutoCheckout {
  nome: string
  descricao: string | null
  imagemUrl: string | null
  precoCentavos: number
  /** Preço "de" riscado. Só existe quando é maior que o preço real. */
  ancoraCentavos: number | null
}

export interface BumpCheckout {
  titulo: string
  descricao: string | null
  precoCentavos: number
  ancoraCentavos: number | null
}

export interface DepoimentoCheckout {
  nome: string
  texto: string
  /**
   * Loja de quem deu o depoimento. Num checkout de e-commerce esse é o dado
   * que torna a prova crível: saber que veio de outro lojista pesa mais que o
   * elogio em si.
   */
  loja: string | null
  /** Nota de 1 a 5, quando configurada. */
  nota: number | null
  fotoUrl: string | null
}

export interface ProvaCheckout {
  depoimentos: DepoimentoCheckout[]
  selos: string[]
}

export interface GarantiaCheckout {
  dias: number
  texto: string | null
}

export interface CheckoutConfig {
  slug: string
  titulo: string | null
  subtitulo: string | null
  /** Quando true, CPF/CNPJ vira campo obrigatório do formulário. */
  exigeDocumento: boolean
  /** Decide o destino após aprovar: upsell ou direto para o obrigado. */
  temUpsell: boolean
}

export interface CheckoutInfo {
  checkout: CheckoutConfig
  produto: ProdutoCheckout
  bump: BumpCheckout | null
  prova: ProvaCheckout | null
  garantia: GarantiaCheckout | null
  /** ISO do instante em que a oferta expira; `null` quando não há cronômetro. */
  cronometroAte: string | null
}

// --------------------------------------------------------------- leitores --

type Registro = Record<string, unknown>

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Primeira chave presente com string não vazia. */
function texto(fonte: Registro, ...chaves: string[]): string | null {
  for (const chave of chaves) {
    const valor = fonte[chave]
    if (typeof valor === 'string' && valor.trim() !== '') return valor.trim()
  }
  return null
}

function booleano(fonte: Registro, ...chaves: string[]): boolean {
  for (const chave of chaves) {
    const valor = fonte[chave]
    if (typeof valor === 'boolean') return valor
    // String vale como "configurado": a maioria destas chaves é um id (o
    // upsell se anuncia por `upsell_produto_id`, não por uma flag). Só 'false'
    // e vazio contam como não.
    if (typeof valor === 'string') {
      const limpo = valor.trim()
      return limpo !== '' && limpo !== 'false'
    }
    if (typeof valor === 'number') return valor !== 0
    // Um objeto/array presente e não vazio também conta como "configurado":
    // é assim que um `upsell: {...}` embutido se anuncia.
    if (Array.isArray(valor)) return valor.length > 0
    if (ehRegistro(valor)) return true
  }
  return false
}

function inteiro(fonte: Registro, ...chaves: string[]): number | null {
  for (const chave of chaves) {
    const valor = fonte[chave]
    const numero =
      typeof valor === 'number'
        ? valor
        : typeof valor === 'string' && valor.trim() !== ''
          ? Number(valor)
          : Number.NaN
    if (Number.isFinite(numero)) return Math.round(numero)
  }
  return null
}

/**
 * Dinheiro. Chaves terminadas em `_centavos` já vêm inteiras; `preco`/`valor`
 * puros são reais e viram centavos aqui. Arredondar na multiplicação evita o
 * clássico 19.9 * 100 = 1989.9999 virar R$ 19,89.
 */
function centavos(fonte: Registro, base: string): number | null {
  const emCentavos = inteiro(fonte, `${base}_centavos`, `${base}Centavos`)
  if (emCentavos !== null) return emCentavos
  const emReais = fonte[base]
  const numero =
    typeof emReais === 'number'
      ? emReais
      : typeof emReais === 'string' && emReais.trim() !== ''
        ? Number(emReais)
        : Number.NaN
  return Number.isFinite(numero) ? Math.round(numero * 100) : null
}

function lista(fonte: Registro, ...chaves: string[]): unknown[] {
  for (const chave of chaves) {
    const valor = fonte[chave]
    if (Array.isArray(valor)) return valor
  }
  return []
}

/** ISO válido e nada mais — string qualquer não vira Date silenciosamente. */
function instante(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null
  return Number.isNaN(new Date(valor).getTime()) ? null : valor
}

// ------------------------------------------------------------- seções ------

function lerProduto(bruto: unknown): ProdutoCheckout | null {
  if (!ehRegistro(bruto)) return null
  const nome = texto(bruto, 'nome', 'titulo', 'name')
  const preco = centavos(bruto, 'preco') ?? centavos(bruto, 'valor')
  if (nome === null || preco === null || preco < 0) return null

  const ancora = centavos(bruto, 'preco_ancora') ?? centavos(bruto, 'ancora')
  return {
    nome,
    descricao: texto(bruto, 'descricao', 'subtitulo', 'description'),
    imagemUrl: texto(bruto, 'imagem_url', 'imagem', 'image_url'),
    precoCentavos: preco,
    // Âncora só serve riscada: se não for maior que o preço, é ruído.
    ancoraCentavos: ancora !== null && ancora > preco ? ancora : null,
  }
}

/**
 * O bump tem DUAS fontes, e a ordem importa: o preço vem do produto
 * (`bruto.bump`), mas o título e o texto vêm da configuração do checkout
 * (`checkout.bump_titulo` / `bump_texto`). É proposital no banco — o mesmo
 * produto vendido como bump em duas ofertas precisa de dois textos, e o nome
 * que está na nota fiscal não é o que converte. Sem copy configurada, caímos no
 * nome do produto, que é melhor que uma caixa vazia.
 */
function lerBump(bruto: unknown, config: Registro): BumpCheckout | null {
  if (!ehRegistro(bruto)) return null
  const titulo =
    texto(config, 'bump_titulo', 'bumpTitulo') ??
    texto(bruto, 'titulo', 'nome', 'title')
  const preco = centavos(bruto, 'preco') ?? centavos(bruto, 'valor')
  if (titulo === null || preco === null || preco < 0) return null

  const ancora = centavos(bruto, 'preco_ancora') ?? centavos(bruto, 'ancora')
  return {
    titulo,
    descricao:
      texto(config, 'bump_texto', 'bumpTexto') ??
      texto(bruto, 'descricao', 'texto', 'description'),
    precoCentavos: preco,
    ancoraCentavos: ancora !== null && ancora > preco ? ancora : null,
  }
}

function lerDepoimento(bruto: unknown): DepoimentoCheckout | null {
  if (!ehRegistro(bruto)) return null
  const textoDepoimento = texto(bruto, 'texto', 'depoimento', 'mensagem')
  if (textoDepoimento === null) return null
  const nota = inteiro(bruto, 'nota', 'estrelas', 'rating')
  return {
    nome: texto(bruto, 'nome', 'autor', 'cliente') ?? 'Cliente Vertix',
    texto: textoDepoimento,
    loja: texto(bruto, 'loja', 'empresa', 'site'),
    nota: nota !== null && nota >= 1 && nota <= 5 ? nota : null,
    fotoUrl: texto(bruto, 'foto_url', 'foto', 'avatar_url'),
  }
}

function lerProva(bruto: unknown): ProvaCheckout | null {
  if (!ehRegistro(bruto)) {
    // Também aceitamos `prova` como array puro de depoimentos.
    if (!Array.isArray(bruto)) return null
    const soltos = bruto.map(lerDepoimento).filter((d) => d !== null)
    return soltos.length > 0 ? { depoimentos: soltos, selos: [] } : null
  }

  const depoimentos = lista(bruto, 'depoimentos', 'testimonials')
    .map(lerDepoimento)
    .filter((d) => d !== null)
  const selos = lista(bruto, 'selos', 'badges')
    .map((selo) =>
      typeof selo === 'string'
        ? selo.trim()
        : ehRegistro(selo)
          ? (texto(selo, 'texto', 'label', 'nome') ?? '')
          : ''
    )
    .filter((selo) => selo !== '')

  if (depoimentos.length === 0 && selos.length === 0) return null
  return { depoimentos, selos }
}

function lerGarantia(bruto: unknown): GarantiaCheckout | null {
  if (typeof bruto === 'number') {
    return bruto > 0 ? { dias: Math.round(bruto), texto: null } : null
  }
  if (!ehRegistro(bruto)) return null
  const dias = inteiro(bruto, 'dias', 'days', 'prazo_dias')
  if (dias === null || dias <= 0) return null
  return { dias, texto: texto(bruto, 'texto', 'descricao', 'mensagem') }
}

/**
 * Traduz a resposta crua do RPC. Devolve `null` quando falta o essencial
 * (produto com nome e preço) — a página trata isso como checkout indisponível
 * em vez de renderizar uma casca vazia.
 */
export function normalizarCheckout(
  bruto: unknown,
  slugDaUrl: string
): CheckoutInfo | null {
  if (!ehRegistro(bruto)) return null

  const configBruta = ehRegistro(bruto.checkout) ? bruto.checkout : {}
  const produto = lerProduto(bruto.produto)
  if (produto === null) return null

  return {
    checkout: {
      slug: texto(configBruta, 'slug') ?? slugDaUrl,
      titulo: texto(configBruta, 'titulo', 'headline', 'nome'),
      subtitulo: texto(configBruta, 'subtitulo', 'subheadline', 'descricao'),
      exigeDocumento: booleano(
        configBruta,
        'exige_documento',
        'exigeDocumento',
        'documento_obrigatorio'
      ),
      // Não existe flag "tem upsell" no banco: ter upsell é ter um produto
      // apontado. Olhamos a coluna do checkout e, por garantia, o objeto que a
      // RPC devolve na raiz.
      temUpsell:
        booleano(
          configBruta,
          'upsell_produto_id',
          'upsellProdutoId',
          'tem_upsell',
          'temUpsell'
        ) || booleano(bruto, 'upsell', 'upsell_produto'),
    },
    produto,
    bump: lerBump(bruto.bump ?? bruto.bump_produto, configBruta),
    prova: lerProva(bruto.prova),
    garantia: lerGarantia(bruto.garantia),
    cronometroAte: instante(bruto.cronometro_ate),
  }
}
