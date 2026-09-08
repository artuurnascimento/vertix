/**
 * Regras compartilhadas do checkout próprio (checkout-pagar, checkout-upsell,
 * cupom-validar).
 *
 * Existe por um motivo só: o desconto que a página MOSTRA e o desconto que o
 * cartão SOFRE têm de sair da mesma conta. Se `cupom-validar` e
 * `checkout-pagar` calculassem cada uma a sua, bastaria um arredondamento
 * diferente para o cliente ver "R$ 48,50" na tela e ser cobrado "R$ 48,51" —
 * o tipo de divergência que vira chargeback e some da vista em teste.
 *
 * A conta inteira mora em calcularTotais(), inclusive a ORDEM em que os
 * descontos se aplicam — (produto + bump) → cupom → desconto do método —, que
 * muda o valor final e por isso precisa ser a mesma na tela e na cobrança.
 *
 * O que este módulo NUNCA faz:
 *   • aceitar valor vindo do navegador — preço só sai de `produtos`;
 *   • logar token de cartão, CVV, documento do cliente ou MP_ACCESS_TOKEN.
 */

// ---------------------------------------------------------------------------
// Formas das linhas lidas do banco
// ---------------------------------------------------------------------------

export interface ProdutoRow {
  id: string
  nome: string
  slug: string
  descricao: string | null
  preco_centavos: number
  preco_ancora_centavos: number | null
  tipo: string
  entrega: string
  ativo: boolean
}

export interface CheckoutRow {
  id: string
  slug: string
  titulo: string
  produto_id: string
  bump_produto_id: string | null
  upsell_produto_id: string | null
  downsell_produto_id: string | null
  /**
   * Pontos percentuais de desconto quando o pagamento é por Pix.
   * NULL (nunca configurado) e 0 (configurado e desligado) valem a mesma
   * coisa na conta. Ver a migration 20260908200000 para por que só Pix.
   */
  desconto_pix_percentual: number | null
  ativo: boolean
}

export interface CupomRow {
  id: string
  codigo: string
  tipo: string
  valor: number
  validade: string | null
  limite_uso: number | null
  usos: number
  produto_id: string | null
  ativo: boolean
}

/** Item gravado em pedidos.itens — snapshot, não referência (ver migration). */
export interface PedidoItem {
  produto_id: string
  nome: string
  tipo: string
  preco_centavos: number
  pago: boolean
  /**
   * Como este item é entregue. Copiado do produto no instante da compra pelo
   * mesmo motivo do preço: quem confirma um Pix meia hora depois (checkout-info)
   * precisa saber o que entregar sem reabrir o catálogo — e sem correr o risco
   * de o produto ter mudado de forma de entrega nesse meio-tempo.
   */
  entrega?: string
  mp_payment_id?: string | null
  /**
   * Recebível que cobrou ESTE item, quando ele foi cobrado à parte — é o caso
   * do upsell, que é um pagamento novo no Mercado Pago e por isso vira uma
   * segunda linha no Financeiro. Fica no item, e não no pedido, porque um
   * pedido pode ter itens pagos em cobranças diferentes.
   *
   * Gravado por public.checkout_item_recebivel() (20260908140000), nunca por
   * reescrita do array inteiro: dois itens cobrados ao mesmo tempo se
   * apagariam.
   */
  receivable_id?: string | null
}

// ---------------------------------------------------------------------------
// Constantes de negócio
// ---------------------------------------------------------------------------

/**
 * Piso de cobrança, em centavos. O Mercado Pago recusa transação de valor
 * irrisório, e um cupom de 100% levaria o total a zero — que não é "grátis",
 * é uma chamada que falha depois de o cliente já ter preenchido o cartão.
 * Melhor recusar o cupom antes, com mensagem, do que recusar o pagamento.
 */
export const VALOR_MINIMO_CENTAVOS = 50

/**
 * Teto de sanidade da cobrança. O valor vem do nosso próprio catálogo, mas um
 * preço digitado errado no painel (um zero a mais) não pode virar uma cobrança
 * de seis dígitos no cartão de alguém. Mesmo espírito do teto da scan-comprar.
 */
export const VALOR_MAXIMO_CENTAVOS = 5_000_000

// Validação de e-mail deliberadamente frouxa: só garante forma mínima, porque
// o e-mail é o identificador do comprador e o destino do recibo.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Slug de URL: o que a página pública pode mandar sem virar injeção no filtro. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/

/** Cupom: só o que cabe num código digitável. Já normalizado em maiúsculas. */
export const CUPOM_RE = /^[A-Z0-9._-]{1,40}$/

// ---------------------------------------------------------------------------
// Acesso ao banco (PostgREST com service role — ignora RLS)
// ---------------------------------------------------------------------------

export interface Db {
  select<T>(path: string): Promise<T[]>
  insert<T>(table: string, row: Record<string, unknown>): Promise<T | null>
  update<T>(
    table: string,
    filtro: string,
    patch: Record<string, unknown>
  ): Promise<T[]>
  rpc<T>(nome: string, args: Record<string, unknown>): Promise<T | null>
}

/**
 * Cliente mínimo de PostgREST. Não usamos o supabase-js aqui pelo mesmo motivo
 * das functions existentes: `fetch` direto tem menos superfície, não carrega
 * dependência externa no bundle e deixa cada erro de HTTP visível no log.
 */
export function criarDb(supabaseUrl: string, serviceRoleKey: string): Db {
  const restBase = `${supabaseUrl}/rest/v1`
  const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }
  const writeHeaders = {
    ...authHeaders,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  async function falhar(rotulo: string, res: Response): Promise<never> {
    // O corpo do PostgREST não contém segredo — traz a mensagem do Postgres,
    // que é o que faz a diferença entre "constraint" e "coluna inexistente".
    const corpo = await res.text().catch(() => '')
    console.error(`[checkout] ${rotulo} falhou:`, res.status, corpo.slice(0, 500))
    throw new Error(`db_${rotulo}`)
  }

  return {
    async select<T>(path: string): Promise<T[]> {
      const res = await fetch(`${restBase}/${path}`, { headers: authHeaders })
      if (!res.ok) await falhar('select', res)
      return (await res.json()) as T[]
    },

    async insert<T>(
      table: string,
      row: Record<string, unknown>
    ): Promise<T | null> {
      const res = await fetch(`${restBase}/${table}`, {
        method: 'POST',
        headers: writeHeaders,
        body: JSON.stringify(row),
      })
      if (!res.ok) await falhar('insert', res)
      const linhas = (await res.json()) as T[]
      return linhas[0] ?? null
    },

    async update<T>(
      table: string,
      filtro: string,
      patch: Record<string, unknown>
    ): Promise<T[]> {
      const res = await fetch(`${restBase}/${table}?${filtro}`, {
        method: 'PATCH',
        headers: writeHeaders,
        body: JSON.stringify(patch),
      })
      if (!res.ok) await falhar('update', res)
      return (await res.json()) as T[]
    },

    async rpc<T>(
      nome: string,
      args: Record<string, unknown>
    ): Promise<T | null> {
      const res = await fetch(`${restBase}/rpc/${nome}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      if (!res.ok) await falhar(`rpc_${nome}`, res)
      return (await res.json()) as T
    },
  }
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export interface OfertaResolvida {
  checkout: CheckoutRow
  produto: ProdutoRow
  bump: ProdutoRow | null
  upsell: ProdutoRow | null
  downsell: ProdutoRow | null
}

/**
 * Carrega a oferta ATIVA de um slug com todos os produtos que ela referencia.
 * Devolve null se o checkout não existe, está desativado, ou se o produto
 * principal foi desativado — os três casos são "essa página não vende nada
 * agora", e distinguir os três para quem está de fora só descreve o painel.
 *
 * Produtos opcionais desativados voltam como null: a oferta encolhe, não quebra.
 */
export async function carregarOferta(
  db: Db,
  slug: string
): Promise<OfertaResolvida | null> {
  const checkouts = await db.select<CheckoutRow>(
    `checkouts?slug=eq.${encodeURIComponent(slug)}&ativo=is.true` +
      '&select=id,slug,titulo,produto_id,bump_produto_id,upsell_produto_id,downsell_produto_id,desconto_pix_percentual,ativo' +
      '&limit=1'
  )
  const checkout = checkouts[0]
  if (!checkout) return null

  const ids = [
    checkout.produto_id,
    checkout.bump_produto_id,
    checkout.upsell_produto_id,
    checkout.downsell_produto_id,
  ].filter((id): id is string => typeof id === 'string')

  const produtos = await db.select<ProdutoRow>(
    `produtos?id=in.(${ids.join(',')})&ativo=is.true` +
      '&select=id,nome,slug,descricao,preco_centavos,preco_ancora_centavos,tipo,entrega,ativo'
  )
  const porId = new Map(produtos.map((p) => [p.id, p]))

  const produto = porId.get(checkout.produto_id)
  if (!produto) return null

  const opcional = (id: string | null): ProdutoRow | null =>
    id ? (porId.get(id) ?? null) : null

  return {
    checkout,
    produto,
    bump: opcional(checkout.bump_produto_id),
    upsell: opcional(checkout.upsell_produto_id),
    downsell: opcional(checkout.downsell_produto_id),
  }
}

// ---------------------------------------------------------------------------
// Cupom
// ---------------------------------------------------------------------------

export type CupomAvaliado =
  | { valido: true; cupom: CupomRow; desconto_centavos: number; mensagem: string }
  | { valido: false; desconto_centavos: 0; mensagem: string }

/**
 * Desconto em centavos, com aritmética inteira do início ao fim.
 *
 * `Math.floor` no percentual é decisão de negócio, não descuido: arredondar
 * para baixo faz o desconto ser, no pior caso, um centavo MENOR do que o
 * cliente esperaria — a direção segura. Arredondar para cima cobraria um
 * centavo a menos do que a página prometeu somar, e é a conta que quebra a
 * conciliação com o extrato do Mercado Pago.
 *
 * O teto em `subtotal` garante que nenhum cupom mal cadastrado produza total
 * negativo, mesmo que os checks do banco sejam afrouxados um dia.
 */
export function calcularDesconto(cupom: CupomRow, subtotal: number): number {
  const bruto =
    cupom.tipo === 'percentual'
      ? Math.floor((subtotal * cupom.valor) / 100)
      : cupom.valor
  return Math.max(0, Math.min(bruto, subtotal))
}

/**
 * Valida o cupom DE VERDADE contra o banco: existe, está ativo, dentro da
 * validade, abaixo do limite de uso e vinculado ao produto certo.
 *
 * O limite é conferido aqui só para dar a mensagem certa na tela. Quem
 * realmente impede o uso 11 de um cupom de 10 é a public.cupom_registrar_uso(),
 * chamada no momento da aprovação — entre esta checagem e a cobrança cabe outra
 * venda, e conferir aqui é aviso, não garantia.
 */
export async function avaliarCupom(
  db: Db,
  codigoBruto: string,
  produtoId: string,
  subtotalCentavos: number
): Promise<CupomAvaliado> {
  const codigo = codigoBruto.trim().toUpperCase()
  if (!CUPOM_RE.test(codigo)) {
    return { valido: false, desconto_centavos: 0, mensagem: 'Cupom inválido.' }
  }

  const linhas = await db.select<CupomRow>(
    `cupons?codigo=eq.${encodeURIComponent(codigo)}` +
      '&select=id,codigo,tipo,valor,validade,limite_uso,usos,produto_id,ativo' +
      '&limit=1'
  )
  const cupom = linhas[0]

  // Cupom inexistente e cupom desativado devolvem a MESMA mensagem: separar as
  // duas transformaria o campo num oráculo de quais códigos existem, e o
  // primeiro script a passar por aqui enumeraria a tabela inteira.
  if (!cupom || !cupom.ativo) {
    return { valido: false, desconto_centavos: 0, mensagem: 'Cupom inválido.' }
  }

  if (cupom.validade && new Date(cupom.validade).getTime() <= Date.now()) {
    return { valido: false, desconto_centavos: 0, mensagem: 'Cupom expirado.' }
  }

  if (cupom.limite_uso !== null && cupom.usos >= cupom.limite_uso) {
    return {
      valido: false,
      desconto_centavos: 0,
      mensagem: 'Cupom esgotado.',
    }
  }

  if (cupom.produto_id && cupom.produto_id !== produtoId) {
    return {
      valido: false,
      desconto_centavos: 0,
      mensagem: 'Cupom não vale para este produto.',
    }
  }

  const desconto = calcularDesconto(cupom, subtotalCentavos)

  // Desconto que derruba o total abaixo do piso de cobrança é recusado aqui,
  // com mensagem, em vez de virar uma recusa do gateway depois do cartão
  // preenchido. Ver VALOR_MINIMO_CENTAVOS.
  if (subtotalCentavos - desconto < VALOR_MINIMO_CENTAVOS) {
    return {
      valido: false,
      desconto_centavos: 0,
      mensagem: 'Cupom não pode ser aplicado a este valor.',
    }
  }

  return {
    valido: true,
    cupom,
    desconto_centavos: desconto,
    mensagem: 'Cupom aplicado.',
  }
}

// ---------------------------------------------------------------------------
// Desconto por método de pagamento
// ---------------------------------------------------------------------------

/**
 * Único método que ganha desconto hoje. É o `payment_method_id` do Mercado
 * Pago para Pix — de propósito: assim a MESMA string que decide o desconto é a
 * que vai no corpo da cobrança, e não existe estado em que o servidor conceda
 * desconto de Pix a uma transação que o gateway processou como cartão.
 */
export const METODO_PIX = 'pix'

/**
 * Teto do percentual, igual ao check da coluna (migration 20260908200000).
 * Repetido aqui porque o banco protege contra configuração ruim e este módulo
 * protege contra a coluna já ter sido gravada antes do check existir — o
 * cálculo do dinheiro não pode depender de o banco ter sido migrado na ordem.
 */
export const DESCONTO_METODO_PERCENTUAL_MAXIMO = 90

/**
 * Normaliza o método vindo de fora. O navegador manda 'PIX', 'pix ' ou
 * 'Pix' conforme o componente; nenhuma dessas variações pode virar um desconto
 * a mais nem a menos.
 */
export function normalizarMetodo(bruto: string | null | undefined): string {
  return (bruto ?? '').trim().toLowerCase()
}

/**
 * Desconto do método, em centavos, sobre `baseCentavos`.
 *
 * `baseCentavos` é o subtotal JÁ DESCONTADO DO CUPOM — ver calcularTotais(),
 * que é onde a ordem mora e o único lugar que deveria chamar esta função em
 * regime.
 *
 * Aritmética inteira e `Math.floor` pelo mesmo motivo de calcularDesconto():
 * arredondar para baixo faz o desconto ser, no pior caso, um centavo MENOR do
 * que o cliente esperaria — a direção segura, a que não quebra a conciliação
 * com o extrato do Mercado Pago.
 *
 * O clamp final é a parte que não pode sumir num refactor: o desconto nunca
 * derruba a cobrança abaixo de VALOR_MINIMO_CENTAVOS. Sem ele, uma oferta com
 * cupom agressivo e Pix de 90% produziria um total que o MP recusa DEPOIS de o
 * cliente ter preenchido o formulário — e como esta mesma função alimenta a
 * prévia da tela e a cobrança, o valor clampado é o mesmo nos dois lados.
 */
export function calcularDescontoMetodo(
  checkout: Pick<CheckoutRow, 'desconto_pix_percentual'>,
  metodo: string | null | undefined,
  baseCentavos: number
): number {
  if (normalizarMetodo(metodo) !== METODO_PIX) return 0

  const bruto = checkout.desconto_pix_percentual
  if (typeof bruto !== 'number' || !Number.isFinite(bruto) || bruto <= 0) {
    return 0
  }

  const percentual = Math.min(
    Math.trunc(bruto),
    DESCONTO_METODO_PERCENTUAL_MAXIMO
  )
  const desconto = Math.floor((baseCentavos * percentual) / 100)
  const maximo = Math.max(0, baseCentavos - VALOR_MINIMO_CENTAVOS)

  return Math.max(0, Math.min(desconto, maximo))
}

// ---------------------------------------------------------------------------
// Totais — a ordem em que os descontos se aplicam
// ---------------------------------------------------------------------------

export interface Totais {
  /** produto + bump marcado. Nunca vem do navegador. */
  subtotal_centavos: number
  desconto_cupom_centavos: number
  desconto_metodo_centavos: number
  /**
   * Soma dos dois. É o número gravado em `pedidos.desconto_centavos` e o que
   * mantém a identidade que todo leitor assume: total = subtotal − desconto.
   */
  desconto_centavos: number
  total_centavos: number
}

/**
 * ORDEM DE APLICAÇÃO — a decisão mais importante deste módulo:
 *
 *     (produto + bump)  →  cupom  →  desconto do método
 *
 * O desconto do método incide sobre o subtotal JÁ DESCONTADO DO CUPOM, nunca
 * sobre o subtotal cheio.
 *
 * A ordem MUDA O VALOR FINAL sempre que o cupom é do tipo `fixo`. Com
 * R$ 197 + bump R$ 97 (29400), cupom fixo de R$ 50 (5000) e Pix de 10%:
 *
 *     cupom → método:   29400 − 5000 = 24400;  10% de 24400 = 2440  →  21960
 *     método → cupom:   29400 − 2940 = 26460;  − 5000              →  21460
 *
 * Cinco reais de diferença na mesma venda. Por isso a ordem vive aqui, numa
 * função só, e não repetida na tela e na cobrança: a prévia que o cliente vê
 * em `cupom-validar` e o valor que a `checkout-pagar` manda ao Mercado Pago
 * saem desta mesma chamada. Duas implementações da mesma regra divergiriam no
 * primeiro cupom fixo e a divergência apareceria como chargeback, não como
 * teste vermelho.
 *
 * Por que o cupom vem primeiro: ele é o desconto que o cliente CONQUISTOU
 * (campanha, indicação, recuperação de carrinho) e o desconto do método é um
 * incentivo nosso, oferecido depois de o preço já estar formado. Aplicar o
 * cupom sobre um preço já reduzido pelo Pix entregaria menos do que o cupom
 * promete — "10% off" que vale menos que 10% do preço anunciado é a reclamação
 * que ninguém quer responder.
 */
export function calcularTotais(
  checkout: Pick<CheckoutRow, 'desconto_pix_percentual'>,
  subtotalCentavos: number,
  descontoCupomCentavos: number,
  metodo: string | null | undefined
): Totais {
  const cupom = Math.max(
    0,
    Math.min(descontoCupomCentavos, subtotalCentavos)
  )
  const aposCupom = subtotalCentavos - cupom

  const metodoCentavos = calcularDescontoMetodo(checkout, metodo, aposCupom)

  return {
    subtotal_centavos: subtotalCentavos,
    desconto_cupom_centavos: cupom,
    desconto_metodo_centavos: metodoCentavos,
    desconto_centavos: cupom + metodoCentavos,
    total_centavos: aposCupom - metodoCentavos,
  }
}

// ---------------------------------------------------------------------------
// Entrega
// ---------------------------------------------------------------------------

/** Forma de entrega que gera um Plano de Correção do Vertix Scan. */
export const ENTREGA_PLANO_SCAN = 'plano_scan'

/**
 * Código do plano: 12 caracteres base64url, MESMO formato do plano_code de
 * raiox_compras e do report_code do Scan (9 bytes aleatórios = 72 bits, que
 * dão exatamente 12 chars sem padding). O formato é igual de propósito: assim
 * a rota GET /api/plano/:code do worker do Scan pode servir tanto uma compra
 * do funil quanto um pedido do checkout, sem inventar um segundo formato de
 * link para o cliente.
 */
export function gerarPlanoCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/** O pedido entrega um Plano de Correção? Decidido pelo snapshot, não pelo catálogo. */
export function entregaPlanoScan(itens: PedidoItem[]): boolean {
  return itens.some((item) => item.entrega === ENTREGA_PLANO_SCAN)
}

// ---------------------------------------------------------------------------
// Resposta HTTP
// ---------------------------------------------------------------------------

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
