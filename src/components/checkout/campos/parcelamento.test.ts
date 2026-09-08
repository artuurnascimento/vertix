import { describe, expect, test } from 'vitest'
import {
  amountEmReais,
  avisoDeJuros,
  escolherPadrao,
  mapearOpcoes,
  opcaoAVista,
  opcaoPorValor,
  parcelasDeFallback,
} from './parcelamento'
import { formatarCentavos } from '../checkoutTotal'

/** Total do pedido usado em todo o arquivo: R$ 197,00. */
const TOTAL = 19700

/**
 * Forma real da resposta de `getInstallments` medida em R$ 197. Os três
 * `payer_costs` abaixo são fiéis ao que o MP devolve, inclusive o
 * `installment_amount` com dízima e o `recommended_message` já em pt-BR.
 */
function respostaReal() {
  return [
    {
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      issuer: { id: '26', name: 'Visa' },
      payer_costs: [
        {
          installments: 1,
          installment_rate: 0,
          installment_amount: 197,
          total_amount: 197,
          recommended_message: '1 parcela de R$ 197,00 (R$ 197,00)',
          labels: ['CFT_0,00%|TEA_0,00%'],
        },
        {
          installments: 2,
          installment_rate: 3.29,
          installment_amount: 101.75,
          total_amount: 203.5,
          recommended_message: '2 parcelas de R$ 101,75 (R$ 203,50)',
        },
        {
          installments: 12,
          installment_rate: 22.11,
          installment_amount: 20.046666666666667,
          total_amount: 240.56,
          recommended_message: '12 parcelas de R$ 20,05 (R$ 240,56)',
        },
      ],
    },
  ]
}

describe('mapearOpcoes', () => {
  test('traduz a resposta real do MP preservando o rótulo cru', () => {
    const { opcoes, fallback } = mapearOpcoes(respostaReal(), TOTAL)

    expect(fallback).toBe(false)
    expect(opcoes.map((o) => o.valor)).toEqual([1, 2, 12])
    expect(opcoes.map((o) => o.rotulo)).toEqual([
      '1 parcela de R$ 197,00 (R$ 197,00)',
      '2 parcelas de R$ 101,75 (R$ 203,50)',
      '12 parcelas de R$ 20,05 (R$ 240,56)',
    ])
  })

  test('temJuros sai de installment_rate > 0, não do número de parcelas', () => {
    const { opcoes } = mapearOpcoes(respostaReal(), TOTAL)

    expect(opcoes.map((o) => o.temJuros)).toEqual([false, true, true])
  })

  test('converte reais para centavos arredondando a dízima da parcela', () => {
    const { opcoes } = mapearOpcoes(respostaReal(), TOTAL)
    const doze = opcaoPorValor(opcoes, 12)

    // 20.046666... → 2005 e não 2004: a mesma conta do rótulo do MP.
    expect(doze?.parcelaCentavos).toBe(2005)
    expect(doze?.totalCentavos).toBe(24056)
  })

  test('o total com juros da opção NUNCA é o total do pedido', () => {
    const { opcoes } = mapearOpcoes(respostaReal(), TOTAL)

    // Guarda de intenção: quem for montar o payload não pode confundir os
    // dois números. R$ 240,56 é do emissor; R$ 197,00 é o que a Vertix cobra.
    expect(opcaoPorValor(opcoes, 12)?.totalCentavos).not.toBe(TOTAL)
    expect(opcaoPorValor(opcoes, 1)?.totalCentavos).toBe(TOTAL)
  })

  test('devolve issuer_id e payment_method_id sem converter o tipo', () => {
    const comString = mapearOpcoes(respostaReal(), TOTAL)
    expect(comString.issuerId).toBe('26')
    expect(comString.paymentMethodId).toBe('visa')

    const comNumero = mapearOpcoes(
      [{ ...respostaReal()[0], issuer: { id: 26 } }],
      TOTAL
    )
    expect(comNumero.issuerId).toBe(26)
  })

  test('issuer ausente vira null em vez de undefined', () => {
    const semIssuer = mapearOpcoes(
      [{ payer_costs: respostaReal()[0].payer_costs }],
      TOTAL
    )

    expect(semIssuer.issuerId).toBeNull()
    expect(semIssuer.paymentMethodId).toBeNull()
  })

  test('aceita a oferta solta, não só dentro do array', () => {
    const { opcoes } = mapearOpcoes(respostaReal()[0], TOTAL)

    expect(opcoes).toHaveLength(3)
  })

  test('BIN de uma opção só continua sendo uma opção só', () => {
    // Visa 45651000 medido ao vivo: 18 opções num BIN, 1 no outro.
    const umaSo = mapearOpcoes(
      [{ payer_costs: [respostaReal()[0].payer_costs[0]] }],
      TOTAL
    )

    expect(umaSo.opcoes).toHaveLength(1)
    expect(umaSo.fallback).toBe(false)
  })

  test('descarta entradas ilegíveis e mantém as boas', () => {
    const { opcoes } = mapearOpcoes(
      [
        {
          payer_costs: [
            null,
            'lixo',
            { installments: 0, installment_amount: 197, total_amount: 197 },
            { installments: 3, total_amount: 197 }, // sem valor da parcela
            { installments: 2, installment_amount: 101.75, total_amount: 203.5 },
          ],
        },
      ],
      TOTAL
    )

    expect(opcoes.map((o) => o.valor)).toEqual([2])
  })

  test('ordena por número de parcelas e ignora duplicata', () => {
    const { opcoes } = mapearOpcoes(
      [
        {
          payer_costs: [
            { installments: 3, installment_amount: 70, total_amount: 210, recommended_message: 'certo' },
            { installments: 1, installment_amount: 197, total_amount: 197 },
            { installments: 3, installment_amount: 99, total_amount: 297, recommended_message: 'duplicata' },
          ],
        },
      ],
      TOTAL
    )

    expect(opcoes.map((o) => o.valor)).toEqual([1, 3])
    expect(opcaoPorValor(opcoes, 3)?.rotulo).toBe('certo')
  })

  test('sem installment_rate, só promete "sem juros" quando o total bate', () => {
    const { opcoes } = mapearOpcoes(
      [
        {
          payer_costs: [
            { installments: 1, installment_amount: 197, total_amount: 197 },
            { installments: 6, installment_amount: 36, total_amount: 216 },
          ],
        },
      ],
      TOTAL
    )

    expect(opcaoPorValor(opcoes, 1)?.temJuros).toBe(false)
    expect(opcaoPorValor(opcoes, 6)?.temJuros).toBe(true)
  })

  test('monta rótulo próprio quando o MP não manda recommended_message', () => {
    const { opcoes } = mapearOpcoes(
      [
        {
          payer_costs: [
            { installments: 1, installment_amount: 197, total_amount: 197 },
            { installments: 2, installment_amount: 101.75, total_amount: 203.5 },
          ],
        },
      ],
      TOTAL
    )

    expect(opcoes[0].rotulo).toBe(`1x à vista de ${formatarCentavos(19700)}`)
    expect(opcoes[1].rotulo).toBe(
      `2x de ${formatarCentavos(10175)} (${formatarCentavos(20350)})`
    )
  })
})

describe('fallback — a venda nunca trava por causa do select', () => {
  const semParcelas: Array<[string, unknown]> = [
    ['resposta nula', null],
    ['resposta indefinida', undefined],
    ['array vazio (erro de rede tratado)', []],
    ['oferta sem payer_costs', [{ payment_method_id: 'visa' }]],
    ['payer_costs vazio', [{ payer_costs: [] }]],
    ['payer_costs não é array', [{ payer_costs: { installments: 12 } }]],
    ['payer_costs só com lixo', [{ payer_costs: [null, { installments: 'x' }] }]],
    ['string no lugar da resposta', 'Internal Server Error'],
  ]

  test.each(semParcelas)('%s cai para 1x à vista', (_nome, resposta) => {
    const resultado = mapearOpcoes(resposta, TOTAL)

    expect(resultado.fallback).toBe(true)
    expect(resultado.opcoes).toHaveLength(1)
    expect(resultado.opcoes[0].valor).toBe(1)
    expect(resultado.opcoes[0].temJuros).toBe(false)
    expect(resultado.opcoes[0].totalCentavos).toBe(TOTAL)
    expect(resultado.issuerId).toBeNull()
    expect(resultado.paymentMethodId).toBeNull()
  })

  test('a opção de escape carrega o total do pedido no rótulo', () => {
    expect(opcaoAVista(TOTAL).rotulo).toBe(
      `1x à vista de ${formatarCentavos(19700)}`
    )
    // O rótulo acompanha bump e cupom: por isso é função, não constante.
    expect(opcaoAVista(24400).rotulo).toBe(
      `1x à vista de ${formatarCentavos(24400)}`
    )
  })

  test('total negativo não vira parcela negativa', () => {
    expect(opcaoAVista(-500).parcelaCentavos).toBe(0)
  })

  test('parcelasDeFallback sempre oferece exatamente uma parcela', () => {
    expect(parcelasDeFallback(0).opcoes.map((o) => o.valor)).toEqual([1])
  })
})

describe('escolherPadrao — nenhuma seleção órfã sobrevive', () => {
  const { opcoes } = mapearOpcoes(respostaReal(), TOTAL) // 1, 2, 12
  const soAVista = parcelasDeFallback(TOTAL).opcoes

  test('sem escolha anterior, o padrão é 1x', () => {
    expect(escolherPadrao(opcoes)).toBe(1)
    expect(escolherPadrao(opcoes, null)).toBe(1)
    expect(escolherPadrao(opcoes, undefined)).toBe(1)
  })

  test('mantém a escolha da pessoa quando ela ainda existe na lista', () => {
    expect(escolherPadrao(opcoes, 12)).toBe(12)
  })

  test('escolha que sumiu da lista nova volta para 1x', () => {
    // Trocou o cartão: 12x existia no BIN antigo e não existe no novo.
    expect(escolherPadrao(soAVista, 12)).toBe(1)
  })

  test('escolha impossível é recusada mesmo com a lista cheia', () => {
    expect(escolherPadrao(opcoes, 7)).toBe(1)
    expect(escolherPadrao(opcoes, 0)).toBe(1)
    expect(escolherPadrao(opcoes, -3)).toBe(1)
    expect(escolherPadrao(opcoes, 1.5)).toBe(1)
    expect(escolherPadrao(opcoes, Number.NaN)).toBe(1)
  })

  test('lista sem 1x devolve a menor parcela existente, nunca um valor de fora', () => {
    const { opcoes: semAVista } = mapearOpcoes(
      [
        {
          payer_costs: [
            { installments: 6, installment_amount: 36, total_amount: 216 },
            { installments: 3, installment_amount: 70, total_amount: 210 },
          ],
        },
      ],
      TOTAL
    )

    expect(escolherPadrao(semAVista, 12)).toBe(3)
  })

  test('lista vazia devolve 1 — o payload nunca fica sem installments', () => {
    expect(escolherPadrao([], 12)).toBe(1)
    expect(Number.isInteger(escolherPadrao([]))).toBe(true)
  })
})

describe('opcaoPorValor', () => {
  const { opcoes } = mapearOpcoes(respostaReal(), TOTAL)

  test('acha a opção escolhida', () => {
    expect(opcaoPorValor(opcoes, 2)?.valor).toBe(2)
  })

  test('devolve null quando a opção não existe', () => {
    expect(opcaoPorValor(opcoes, 7)).toBeNull()
  })
})

describe('amountEmReais', () => {
  test('manda reais com duas casas, como o SDK exige', () => {
    expect(amountEmReais(19700)).toBe('197.00')
    expect(amountEmReais(24400)).toBe('244.00')
    expect(amountEmReais(5)).toBe('0.05')
    expect(amountEmReais(100000)).toBe('1000.00')
  })

  test('nunca produz valor negativo nem fração de centavo', () => {
    expect(amountEmReais(-1)).toBe('0.00')
    expect(amountEmReais(19700.6)).toBe('197.01')
  })
})

describe('avisoDeJuros', () => {
  test('nomeia o valor que a Vertix cobra, não o do emissor', () => {
    expect(avisoDeJuros(TOTAL)).toBe(
      `Parcelas com juros do emissor. A Vertix cobra ${formatarCentavos(19700)}.`
    )
  })
})
