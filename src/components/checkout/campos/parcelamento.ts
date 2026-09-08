/**
 * Parcelamento do cartão: tradução da resposta de `mp.getInstallments()` para
 * o que o select da tela precisa. Puro — sem React, sem rede, sem SDK.
 *
 * REGRA DE DINHEIRO QUE NÃO PODE SER QUEBRADA: juros NÃO entram no nosso
 * total. O que vai para o Mercado Pago é sempre `transaction_amount` = total
 * já descontado (produto + bump − cupom − método). Os juros são do emissor,
 * calculados pelo MP em cima disso e cobrados do comprador. Mandar o
 * `total_amount` de uma opção parcelada como valor da cobrança cobraria juros
 * sobre juros — por isso `totalCentavos` de uma OpcaoParcela existe só para
 * EXIBIR, e nunca deve alimentar payload nenhum.
 *
 * A lista varia por BIN, não por bandeira: medido ao vivo em R$ 197, um Visa
 * devolveu 18 opções e outro Visa da mesma conta devolveu 1. Nada aqui pode
 * assumir 12x, nem cachear por bandeira.
 *
 * Tudo aqui é tolerante a resposta malformada. A venda NUNCA trava por causa
 * do select: qualquer coisa que não dê para ler vira "1x à vista".
 */

import { formatarCentavos } from '../checkoutTotal'

/** Uma linha do select. */
export interface OpcaoParcela {
  /** Vai direto para `formData.installments`. Inteiro ≥ 1, sempre. */
  valor: number
  /** `recommended_message` cru do MP — já vem pronto em pt-BR. */
  rotulo: string
  /** `installment_rate > 0`. É o teste canônico do selo "sem juros". */
  temJuros: boolean
  /** Só para exibir. */
  parcelaCentavos: number
  /** Só para EXIBIR. Nunca vira valor de cobrança. */
  totalCentavos: number
}

export interface ResultadoParcelas {
  opcoes: OpcaoParcela[]
  /** `oferta.issuer.id`. Tipo inconsistente entre endpoints do MP: nunca comparar com `===`. */
  issuerId: string | number | null
  /** `oferta.payment_method_id` — 'visa', 'master', 'elo', 'amex'... */
  paymentMethodId: string | null
  /** `true` quando a lista é o fallback local, não a resposta do MP. */
  fallback: boolean
}

/** Menor parcelamento possível, e o padrão do select (decisão de produto #2). */
export const PARCELA_PADRAO = 1

// ------------------------------------------------------------ leitura crua --

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null
    ? (valor as Record<string, unknown>)
    : null
}

/**
 * Número utilizável ou `null`. Aceita string porque o MP troca de tipo entre
 * endpoints sem avisar (`issuer.id` vem `26` em um e `"26"` em outro) e não há
 * garantia de que os valores monetários sejam sempre `number`.
 */
function numero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

function centavos(reais: number): number {
  return Math.round(reais * 100)
}

// -------------------------------------------------------------- fallback --

/** `(totalCentavos / 100).toFixed(2)` — o `amount` que `getInstallments` exige: REAIS, string, duas casas. */
export function amountEmReais(totalCentavos: number): string {
  return (Math.max(0, Math.round(totalCentavos)) / 100).toFixed(2)
}

/**
 * A opção de escape. É função e não constante porque o rótulo carrega o valor
 * do pedido, e o valor muda com bump, cupom e método.
 */
export function opcaoAVista(totalCentavos: number): OpcaoParcela {
  const total = Math.max(0, Math.round(totalCentavos))
  return {
    valor: PARCELA_PADRAO,
    rotulo: `1x à vista de ${formatarCentavos(total)}`,
    temJuros: false,
    parcelaCentavos: total,
    totalCentavos: total,
  }
}

/**
 * Lista mínima viável. Usada quando o MP falha, demora, devolve vazio ou
 * devolve lixo — e enquanto não há BIN. Uma opção à vista sempre existe, então
 * o formulário nunca fica sem parcela selecionável e a venda passa.
 */
export function parcelasDeFallback(totalCentavos: number): ResultadoParcelas {
  return {
    opcoes: [opcaoAVista(totalCentavos)],
    issuerId: null,
    paymentMethodId: null,
    fallback: true,
  }
}

// ------------------------------------------------------------ mapeamento --

function rotuloPadrao(
  valor: number,
  parcelaCentavos: number,
  totalOpcaoCentavos: number
): string {
  if (valor === 1) return `1x à vista de ${formatarCentavos(parcelaCentavos)}`
  return `${valor}x de ${formatarCentavos(parcelaCentavos)} (${formatarCentavos(totalOpcaoCentavos)})`
}

function mapearPayerCost(
  bruto: unknown,
  totalCentavos: number
): OpcaoParcela | null {
  const pc = objeto(bruto)
  if (pc === null) return null

  const valorBruto = numero(pc.installments)
  if (valorBruto === null) return null
  const valor = Math.trunc(valorBruto)
  if (valor < 1) return null

  const parcela = numero(pc.installment_amount)
  const totalOpcao = numero(pc.total_amount)
  // Sem os dois valores não dá para montar rótulo nem selo honesto; a opção
  // some da lista em vez de aparecer com número errado na tela.
  if (parcela === null || totalOpcao === null) return null

  const parcelaCentavos = centavos(parcela)
  const totalOpcaoCentavos = centavos(totalOpcao)

  // `installment_rate > 0` é o teste canônico. Quando a taxa não vem, o selo
  // "sem juros" é uma PROMESSA que não temos como cumprir: na dúvida, compara
  // com o total do carrinho e prefere não prometer.
  const taxa = numero(pc.installment_rate)
  const temJuros =
    taxa !== null ? taxa > 0 : totalOpcaoCentavos > Math.round(totalCentavos)

  return {
    valor,
    rotulo:
      texto(pc.recommended_message) ??
      rotuloPadrao(valor, parcelaCentavos, totalOpcaoCentavos),
    temJuros,
    parcelaCentavos,
    totalCentavos: totalOpcaoCentavos,
  }
}

/**
 * Primeira oferta da resposta. `getInstallments` devolve um ARRAY (uma entrada
 * por método de pagamento do BIN); aceitar também o objeto solto poupa o
 * chamador de decidir se já desembrulhou.
 */
function primeiraOferta(resposta: unknown): Record<string, unknown> | null {
  if (Array.isArray(resposta)) return objeto(resposta[0])
  return objeto(resposta)
}

/**
 * Resposta crua de `getInstallments` → lista do select.
 *
 * `totalCentavos` é o total do PEDIDO (o que a Vertix cobra), usado para o
 * fallback e para inferir juros quando a taxa não vem. Não é usado para
 * calcular nada de cobrança.
 */
export function mapearOpcoes(
  resposta: unknown,
  totalCentavos: number
): ResultadoParcelas {
  const oferta = primeiraOferta(resposta)
  if (oferta === null) return parcelasDeFallback(totalCentavos)

  const brutos = Array.isArray(oferta.payer_costs) ? oferta.payer_costs : []

  const porValor = new Map<number, OpcaoParcela>()
  for (const bruto of brutos) {
    const opcao = mapearPayerCost(bruto, totalCentavos)
    // Primeira ocorrência vence: duplicata do MP não pode trocar o rótulo já
    // escolhido por baixo do usuário.
    if (opcao !== null && !porValor.has(opcao.valor)) {
      porValor.set(opcao.valor, opcao)
    }
  }

  if (porValor.size === 0) return parcelasDeFallback(totalCentavos)

  const opcoes = [...porValor.values()].sort((a, b) => a.valor - b.valor)

  // O id do emissor vai CRU para o payload: `getPaymentMethods` devolve
  // número (26) e `getInstallments` devolve string ("26"). Converter aqui
  // seria inventar um tipo que nenhum dos dois lados combinou.
  const idEmissor = objeto(oferta.issuer)?.id
  const issuerId =
    typeof idEmissor === 'number' && Number.isFinite(idEmissor)
      ? idEmissor
      : texto(idEmissor)

  return {
    opcoes,
    issuerId,
    paymentMethodId: texto(oferta.payment_method_id),
    fallback: false,
  }
}

// --------------------------------------------------------------- seleção --

/**
 * Parcela que deve ficar selecionada depois que a lista muda.
 *
 * Mantém a escolha da pessoa quando ela ainda existe; senão volta para 1x
 * (decisão de produto #2). Seleção órfã — um `12` preso no estado enquanto o
 * select só oferece `1` — é exatamente como o cliente escolhe 12x na tela e é
 * cobrado à vista.
 */
export function escolherPadrao(
  opcoes: readonly OpcaoParcela[],
  anterior?: number | null
): number {
  if (opcoes.length === 0) return PARCELA_PADRAO

  if (typeof anterior === 'number' && Number.isInteger(anterior)) {
    if (opcoes.some((o) => o.valor === anterior)) return anterior
  }

  if (opcoes.some((o) => o.valor === PARCELA_PADRAO)) return PARCELA_PADRAO

  // BIN sem 1x é teórico, mas devolver um valor fora da lista não é opção.
  return opcoes.reduce((menor, o) => (o.valor < menor ? o.valor : menor), opcoes[0].valor)
}

export function opcaoPorValor(
  opcoes: readonly OpcaoParcela[],
  valor: number
): OpcaoParcela | null {
  return opcoes.find((o) => o.valor === valor) ?? null
}

/**
 * Linha permanente abaixo do select quando a opção escolhida tem juros. Sem
 * ela, a tela passa a mostrar dois números diferentes (o total da Vertix e o
 * total com juros do emissor) sem explicar — e isso vira chamado de suporte.
 */
export function avisoDeJuros(totalCentavos: number): string {
  return `Parcelas com juros do emissor. A Vertix cobra ${formatarCentavos(
    Math.max(0, Math.round(totalCentavos))
  )}.`
}
