/**
 * Aritmética do resumo do pedido e do cronômetro. Tudo puro e em centavos:
 * dinheiro em float é como se perde um centavo por pedido.
 *
 * IMPORTANTE: o total daqui é PRÉVIA. Quem cobra é o servidor, que recalcula
 * produto + bump + cupom + desconto do método com os preços do banco. Se
 * divergir, vale o servidor.
 *
 * A ORDEM DOS DESCONTOS é contrato com o backend e não pode ser invertida:
 *
 *     subtotal  = produto + bump
 *     − cupom                        (primeiro)
 *     − desconto do método (Pix)     (depois, sobre o que sobrou)
 *
 * Inverter a ordem muda o total em alguns centavos, e centavo de diferença
 * entre a tela e a fatura é exatamente o tipo de coisa que vira chamado de
 * suporte e estorno.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarCentavos(centavos: number): string {
  return BRL.format(centavos / 100)
}

const PERCENTUAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** "10", "7,5" — sem casas decimais quando o número é redondo. */
export function formatarPercentual(percentual: number): string {
  return PERCENTUAL.format(percentual)
}

export interface EntradaTotal {
  produtoCentavos: number
  bumpCentavos: number | null
  bumpMarcado: boolean
  descontoCentavos: number
  /**
   * Percentual de desconto do método de pagamento escolhido (hoje só o Pix).
   * Ausente ou 0 = método não muda o preço.
   */
  percentualMetodo?: number | null
}

export interface ResultadoTotal {
  subtotalCentavos: number
  /** Desconto do CUPOM (nunca maior que o subtotal). */
  descontoCentavos: number
  /** Desconto do MÉTODO de pagamento, já sobre o subtotal menos o cupom. */
  descontoMetodoCentavos: number
  totalCentavos: number
}

/** Teto do percentual aceito. Acima disso é erro de configuração, não oferta. */
export const PERCENTUAL_METODO_MAXIMO = 90

/**
 * Piso da cobrança, em centavos. Espelha VALOR_MINIMO_CENTAVOS de
 * supabase/functions/_shared/checkout.ts, que é a fonte: abaixo disso o
 * gateway recusa, e uma tela que promete R$ 0,10 leva a pessoa a preencher o
 * cartão inteiro para tomar erro no fim.
 */
export const VALOR_MINIMO_CENTAVOS = 50

/**
 * Percentual utilizável, ou `null` quando não há desconto nenhum.
 *
 * O teto vale como CLAMP e não como recusa: se o banco trouxer 95, exibir 90
 * mostra um total MAIOR do que o servidor vai cobrar. Errar para o lado de
 * cobrar menos que o anunciado é o único lado seguro dos dois.
 *
 * `Math.trunc` porque o servidor trunca: sem isso um 10.5 no banco daria
 * 10,5% na tela e 10% na cobrança.
 */
export function normalizarPercentualMetodo(
  bruto: number | null | undefined
): number | null {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) return null
  const percentual = Math.min(
    Math.trunc(Math.max(0, bruto)),
    PERCENTUAL_METODO_MAXIMO
  )
  return percentual > 0 ? percentual : null
}

/**
 * Desconto do método sobre uma base em centavos.
 *
 * Cada linha aqui existe para dar EXATAMENTE o mesmo número que
 * `calcularDescontoMetodo` do servidor. Divergir em um centavo significa
 * mostrar R$ 179,99 e cobrar R$ 180,00 — e no caminho mais comum (Pix sem
 * cupom) a tela nunca consulta o servidor, então este é o único número que a
 * pessoa vê antes de autorizar o pagamento.
 *
 * `Math.floor`, não `round`: truncar erra sempre para MENOS desconto, que é o
 * lado seguro de errar, e é o que o servidor faz.
 *
 * O piso é o mesmo do servidor. Sem ele, uma oferta agressiva mostra um total
 * que o gateway vai recusar depois do formulário preenchido.
 */
export function descontoDoMetodo(
  baseCentavos: number,
  percentual: number | null | undefined
): number {
  const pct = normalizarPercentualMetodo(percentual)
  if (pct === null) return 0
  const base = Math.max(0, Math.round(baseCentavos))
  const desconto = Math.floor((base * pct) / 100)
  const maximo = Math.max(0, base - VALOR_MINIMO_CENTAVOS)
  return Math.max(0, Math.min(desconto, maximo))
}

export function calcularTotal({
  produtoCentavos,
  bumpCentavos,
  bumpMarcado,
  descontoCentavos,
  percentualMetodo,
}: EntradaTotal): ResultadoTotal {
  const produto = Math.max(0, Math.round(produtoCentavos))
  const bump =
    bumpMarcado && bumpCentavos !== null
      ? Math.max(0, Math.round(bumpCentavos))
      : 0
  const subtotal = produto + bump

  // Cupom maior que o pedido não gera troco: o piso é zero.
  const desconto = Math.min(
    Math.max(0, Math.round(descontoCentavos)),
    subtotal
  )

  // Cupom PRIMEIRO, método DEPOIS: o percentual do Pix incide sobre o que
  // sobrou, não sobre o subtotal cheio. Mesma ordem do servidor.
  const baseMetodo = subtotal - desconto
  const descontoMetodo = descontoDoMetodo(baseMetodo, percentualMetodo)

  return {
    subtotalCentavos: subtotal,
    descontoCentavos: desconto,
    descontoMetodoCentavos: descontoMetodo,
    totalCentavos: baseMetodo - descontoMetodo,
  }
}

/**
 * Números do servidor quando existirem; a prévia local só cobre a janela em
 * que ainda não houve resposta (ou em que ela não veio completa).
 *
 * Isto NÃO é preciosismo: com cupom percentual, o desconto muda quando o bump
 * é marcado, e recalcular no navegador é reimplementar a regra do backend —
 * duas implementações que divergem no dia em que uma delas mudar. Só o
 * `subtotal` continua vindo daqui quando o servidor não manda: ele é a soma
 * dos preços que a própria página exibe.
 *
 * O `total_centavos` do servidor já vem com CUPOM E MÉTODO aplicados — é por
 * isso que o pedido a /cupom-validar leva o `metodo` junto.
 *
 * CUIDADO com o `descontoCentavos` que chega aqui: na /cupom-validar ele é a
 * SOMA dos dois abatimentos, não só o cupom. Por isso a separação vem nos
 * campos próprios (`descontoCupomCentavos` / `descontoMetodoCentavos`) e é
 * ELES que decidem as duas linhas do resumo. Sem eles — servidor antigo, que
 * não conhece desconto de método — o abatimento inteiro vai para o cupom, que
 * é exatamente o que ele significava antes.
 *
 * Em qualquer caminho o que fecha as contas é a diferença REAL entre subtotal
 * e total: as linhas somam o total mesmo se o arredondamento do backend
 * diferir do nosso.
 */
export function resolverTotal(
  previa: ResultadoTotal,
  servidor: {
    subtotalCentavos: number | null
    descontoCentavos: number
    /** Só do cupom. `null` = servidor sem a separação. */
    descontoCupomCentavos?: number | null
    /** Só do método. `null` = servidor sem a separação. */
    descontoMetodoCentavos?: number | null
    totalCentavos: number | null
  } | null
): ResultadoTotal {
  if (servidor === null || servidor.totalCentavos === null) return previa

  const subtotal = servidor.subtotalCentavos ?? previa.subtotalCentavos
  const total = Math.max(0, servidor.totalCentavos)
  // A diferença real entre o que a página soma e o que o servidor vai cobrar.
  const abatimento = Math.max(0, subtotal - total)

  // Sem separação, o abatimento inteiro é do cupom (comportamento antigo).
  const cupomBruto = servidor.descontoCupomCentavos ?? servidor.descontoCentavos
  const cupom = Math.min(Math.max(0, cupomBruto), abatimento)

  return {
    subtotalCentavos: subtotal,
    descontoCentavos: cupom,
    // O que sobra da diferença é do método. Sobra e campo declarado só
    // divergem se o servidor se contradisser; nesse caso mandam as contas que
    // fecham, não o rótulo — a soma das linhas TEM que dar o total.
    descontoMetodoCentavos: abatimento - cupom,
    totalCentavos: total,
  }
}

// ------------------------------------------------------------ cronômetro --

/**
 * Milissegundos até o instante alvo. `null` quando não há alvo, quando a data
 * é inválida ou quando o prazo JÁ PASSOU — nesse caso a página não mostra
 * cronômetro nenhum. Cronômetro que reinicia a cada visita é mentira, e o
 * visitante que percebe não confia em mais nada da página.
 */
export function restanteMs(
  ate: string | null,
  agora: number = Date.now()
): number | null {
  if (ate === null) return null
  const alvo = new Date(ate).getTime()
  if (Number.isNaN(alvo)) return null
  const restante = alvo - agora
  return restante > 0 ? restante : null
}

export interface ContagemFormatada {
  horas: string
  minutos: string
  segundos: string
  /** Rótulo para leitor de tela ("2 horas, 5 minutos e 9 segundos"). */
  descricao: string
}

function plural(valor: number, singular: string, pluralPalavra: string): string {
  return `${valor} ${valor === 1 ? singular : pluralPalavra}`
}

export function formatarContagem(ms: number): ContagemFormatada {
  const totalSegundos = Math.max(0, Math.floor(ms / 1000))
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)
  const segundos = totalSegundos % 60
  const doisDigitos = (n: number) => String(n).padStart(2, '0')

  return {
    horas: doisDigitos(horas),
    minutos: doisDigitos(minutos),
    segundos: doisDigitos(segundos),
    descricao: [
      plural(horas, 'hora', 'horas'),
      plural(minutos, 'minuto', 'minutos'),
      plural(segundos, 'segundo', 'segundos'),
    ].join(', '),
  }
}
