/**
 * Aritmética do resumo do pedido e do cronômetro. Tudo puro e em centavos:
 * dinheiro em float é como se perde um centavo por pedido.
 *
 * IMPORTANTE: o total daqui é PRÉVIA. Quem cobra é o servidor, que recalcula
 * produto + bump + cupom com os preços do banco. Se divergir, vale o servidor.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarCentavos(centavos: number): string {
  return BRL.format(centavos / 100)
}

export interface EntradaTotal {
  produtoCentavos: number
  bumpCentavos: number | null
  bumpMarcado: boolean
  descontoCentavos: number
}

export interface ResultadoTotal {
  subtotalCentavos: number
  /** Desconto efetivamente aplicado (nunca maior que o subtotal). */
  descontoCentavos: number
  totalCentavos: number
}

export function calcularTotal({
  produtoCentavos,
  bumpCentavos,
  bumpMarcado,
  descontoCentavos,
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

  return {
    subtotalCentavos: subtotal,
    descontoCentavos: desconto,
    totalCentavos: subtotal - desconto,
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
 */
export function resolverTotal(
  previa: ResultadoTotal,
  servidor: {
    subtotalCentavos: number | null
    descontoCentavos: number
    totalCentavos: number | null
  } | null
): ResultadoTotal {
  if (servidor === null || servidor.totalCentavos === null) return previa

  const subtotal = servidor.subtotalCentavos ?? previa.subtotalCentavos
  const total = Math.max(0, servidor.totalCentavos)
  return {
    subtotalCentavos: subtotal,
    // O desconto exibido é sempre a diferença real entre o que a página soma e
    // o que o servidor vai cobrar — assim as três linhas do resumo fecham.
    descontoCentavos: Math.max(0, subtotal - total),
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
