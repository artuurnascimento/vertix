import { describe, expect, test } from 'vitest'
import {
  calcularTotal,
  descontoDoMetodo,
  formatarCentavos,
  formatarPercentual,
  formatarContagem,
  normalizarPercentualMetodo,
  resolverTotal,
  restanteMs,
} from './checkoutTotal'
import { normalizarCheckout } from './checkoutTypes'

describe('calcularTotal', () => {
  test('soma o bump ao subtotal apenas quando marcado', () => {
    const base = {
      produtoCentavos: 19700,
      bumpCentavos: 4700,
      descontoCentavos: 0,
    }

    expect(calcularTotal({ ...base, bumpMarcado: false }).totalCentavos).toBe(
      19700
    )
    expect(calcularTotal({ ...base, bumpMarcado: true }).totalCentavos).toBe(
      24400
    )
  })

  test('aplica o desconto do cupom sobre produto e bump', () => {
    const resultado = calcularTotal({
      produtoCentavos: 19700,
      bumpCentavos: 4700,
      bumpMarcado: true,
      descontoCentavos: 4400,
    })

    expect(resultado.subtotalCentavos).toBe(24400)
    expect(resultado.descontoCentavos).toBe(4400)
    expect(resultado.totalCentavos).toBe(20000)
  })

  test('cupom maior que o pedido zera o total sem gerar troco', () => {
    const resultado = calcularTotal({
      produtoCentavos: 5000,
      bumpCentavos: null,
      bumpMarcado: true,
      descontoCentavos: 900000,
    })

    expect(resultado.descontoCentavos).toBe(5000)
    expect(resultado.totalCentavos).toBe(0)
  })

  test('ignora desconto negativo', () => {
    expect(
      calcularTotal({
        produtoCentavos: 5000,
        bumpCentavos: null,
        bumpMarcado: false,
        descontoCentavos: -1000,
      }).totalCentavos
    ).toBe(5000)
  })
})

describe('resolverTotal', () => {
  const previa = {
    subtotalCentavos: 24400,
    descontoCentavos: 2440,
    descontoMetodoCentavos: 0,
    totalCentavos: 21960,
  }

  test('o número do servidor manda sobre a prévia local', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 24400,
      descontoCentavos: 2000,
      totalCentavos: 22400,
    })

    expect(resolvido.totalCentavos).toBe(22400)
    // Desconto exibido = subtotal − total, para as três linhas fecharem.
    expect(resolvido.descontoCentavos).toBe(2000)
  })

  test('sem resposta do servidor a prévia continua valendo', () => {
    expect(resolverTotal(previa, null)).toEqual(previa)
    expect(
      resolverTotal(previa, {
        subtotalCentavos: null,
        descontoCentavos: 0,
        totalCentavos: null,
      })
    ).toEqual(previa)
  })

  test('usa o subtotal local quando o servidor manda só o total', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: null,
      descontoCentavos: 4400,
      totalCentavos: 20000,
    })

    expect(resolvido.subtotalCentavos).toBe(24400)
    expect(resolvido.totalCentavos).toBe(20000)
    expect(resolvido.descontoCentavos).toBe(4400)
  })
})

describe('formatarCentavos', () => {
  test('formata centavos como moeda brasileira', () => {
    //   = espaço não separável que o Intl usa depois do "R$".
    expect(formatarCentavos(19700).replace(/ /g, ' ')).toBe('R$ 197,00')
    expect(formatarCentavos(0).replace(/ /g, ' ')).toBe('R$ 0,00')
  })
})

describe('restanteMs', () => {
  const agora = new Date('2026-09-07T12:00:00.000Z').getTime()

  test('devolve o tempo restante quando o prazo está no futuro', () => {
    expect(restanteMs('2026-09-07T12:30:00.000Z', agora)).toBe(30 * 60 * 1000)
  })

  test('devolve null quando o prazo já passou', () => {
    expect(restanteMs('2026-09-07T11:59:59.000Z', agora)).toBeNull()
  })

  test('devolve null sem prazo ou com data inválida', () => {
    expect(restanteMs(null, agora)).toBeNull()
    expect(restanteMs('nem-data-isso', agora)).toBeNull()
  })
})

describe('formatarContagem', () => {
  test('quebra os milissegundos em horas, minutos e segundos', () => {
    const contagem = formatarContagem((2 * 3600 + 5 * 60 + 9) * 1000)

    expect(contagem.horas).toBe('02')
    expect(contagem.minutos).toBe('05')
    expect(contagem.segundos).toBe('09')
    expect(contagem.descricao).toBe('2 horas, 5 minutos, 9 segundos')
  })
})

describe('normalizarCheckout', () => {
  // Mesma forma que a RPC get_checkout_info devolve hoje: a copy do bump mora
  // em `checkout.bump_*`, o preço mora no produto de `bump`.
  const bruto = {
    checkout: {
      slug: 'plano-pro',
      titulo: 'Plano Pro',
      exige_documento: true,
      bump_titulo: 'Revisão ao vivo com um especialista',
      bump_texto: '30 minutos de call para destravar o que ficou em dúvida.',
      upsell_produto_id: '0f4d1a2e-0000-4000-8000-000000000001',
    },
    produto: {
      nome: 'Plano Pro',
      preco_centavos: 19700,
      preco_ancora_centavos: 29700,
    },
    bump: { nome: 'Suporte VIP', preco_centavos: 4700 },
    prova: {
      depoimentos: [
        {
          nome: 'Ana',
          texto: 'Mudou meu faturamento.',
          nota: 5,
          loja: 'lojademo.com.br',
        },
      ],
      selos: ['Compra segura'],
    },
    garantia: { dias: 7 },
    cronometro_ate: '2026-09-07T12:30:00.000Z',
  }

  test('traduz a resposta do RPC para o formato da página', () => {
    const info = normalizarCheckout(bruto, 'da-url')

    expect(info?.checkout.slug).toBe('plano-pro')
    expect(info?.checkout.exigeDocumento).toBe(true)
    expect(info?.checkout.temUpsell).toBe(true)
    expect(info?.produto.precoCentavos).toBe(19700)
    expect(info?.produto.ancoraCentavos).toBe(29700)
    expect(info?.bump?.precoCentavos).toBe(4700)
    expect(info?.prova?.depoimentos).toHaveLength(1)
    expect(info?.prova?.depoimentos[0].loja).toBe('lojademo.com.br')
    expect(info?.garantia?.dias).toBe(7)
  })

  test('depoimento sem loja não inventa uma', () => {
    const info = normalizarCheckout(
      {
        produto: { nome: 'Curso', preco_centavos: 100 },
        prova: { depoimentos: [{ nome: 'Bruno', texto: 'Recomendo.' }] },
      },
      'curso'
    )

    expect(info?.prova?.depoimentos[0].loja).toBeNull()
  })

  test('usa o slug da URL quando a resposta não traz um', () => {
    const info = normalizarCheckout({ ...bruto, checkout: {} }, 'da-url')
    expect(info?.checkout.slug).toBe('da-url')
  })

  test('o bump usa a copy do checkout, não o nome do produto', () => {
    const info = normalizarCheckout(bruto, 'da-url')

    expect(info?.bump?.titulo).toBe('Revisão ao vivo com um especialista')
    expect(info?.bump?.descricao).toBe(
      '30 minutos de call para destravar o que ficou em dúvida.'
    )
  })

  test('sem copy configurada o bump cai no nome do produto', () => {
    const info = normalizarCheckout(
      {
        produto: { nome: 'Curso', preco_centavos: 19700 },
        checkout: { slug: 'curso' },
        bump: { nome: 'Suporte VIP', descricao: 'Fila prioritária.', preco_centavos: 4700 },
      },
      'curso'
    )

    expect(info?.bump?.titulo).toBe('Suporte VIP')
    expect(info?.bump?.descricao).toBe('Fila prioritária.')
  })

  test('sem upsell configurado o destino pós-pagamento não é o upsell', () => {
    const info = normalizarCheckout(
      { produto: { nome: 'Curso', preco_centavos: 100 }, checkout: {} },
      'curso'
    )

    expect(info?.checkout.temUpsell).toBe(false)
  })

  test('aceita preço em reais e converte sem perder centavo', () => {
    const info = normalizarCheckout(
      { produto: { nome: 'Curso', preco: 19.9 } },
      'curso'
    )
    expect(info?.produto.precoCentavos).toBe(1990)
  })

  test('descarta âncora que não é maior que o preço', () => {
    const info = normalizarCheckout(
      { produto: { nome: 'Curso', preco_centavos: 19700, preco_ancora_centavos: 19700 } },
      'curso'
    )
    expect(info?.produto.ancoraCentavos).toBeNull()
  })

  test('seções vazias viram null em vez de placeholder', () => {
    const info = normalizarCheckout(
      { produto: { nome: 'Curso', preco_centavos: 100 }, prova: {}, garantia: { dias: 0 } },
      'curso'
    )

    expect(info?.prova).toBeNull()
    expect(info?.garantia).toBeNull()
    expect(info?.bump).toBeNull()
    expect(info?.cronometroAte).toBeNull()
  })

  test('devolve null quando falta produto com nome e preço', () => {
    expect(normalizarCheckout({ checkout: { slug: 'x' } }, 'x')).toBeNull()
    expect(normalizarCheckout(null, 'x')).toBeNull()
  })
})

describe('desconto por método de pagamento', () => {
  test('sem percentual configurado nada muda no total', () => {
    const resultado = calcularTotal({
      produtoCentavos: 19700,
      bumpCentavos: null,
      bumpMarcado: false,
      descontoCentavos: 0,
      percentualMetodo: null,
    })

    expect(resultado.descontoMetodoCentavos).toBe(0)
    expect(resultado.totalCentavos).toBe(19700)
  })

  test('abate o percentual do subtotal quando não há cupom', () => {
    const resultado = calcularTotal({
      produtoCentavos: 19700,
      bumpCentavos: null,
      bumpMarcado: false,
      descontoCentavos: 0,
      percentualMetodo: 10,
    })

    expect(resultado.subtotalCentavos).toBe(19700)
    expect(resultado.descontoCentavos).toBe(0)
    expect(resultado.descontoMetodoCentavos).toBe(1970)
    expect(resultado.totalCentavos).toBe(17730)
  })

  test('o percentual incide sobre produto + bump', () => {
    const resultado = calcularTotal({
      produtoCentavos: 19700,
      bumpCentavos: 4700,
      bumpMarcado: true,
      descontoCentavos: 0,
      percentualMetodo: 10,
    })

    expect(resultado.subtotalCentavos).toBe(24400)
    expect(resultado.descontoMetodoCentavos).toBe(2440)
    expect(resultado.totalCentavos).toBe(21960)
  })

  // ESTE é o teste que protege o centavo: a ordem cupom → método.
  test('ORDEM: o método incide sobre o subtotal JÁ descontado o cupom', () => {
    const entrada = {
      produtoCentavos: 19700,
      bumpCentavos: null,
      bumpMarcado: false,
      descontoCentavos: 5000,
      percentualMetodo: 10,
    }
    const resultado = calcularTotal(entrada)

    // Certo:  (19700 − 5000) × 10% = 1470  → total 13230
    // Errado: 19700 × 10% = 1970           → total 12730 (R$ 5,00 a menos)
    expect(resultado.descontoCentavos).toBe(5000)
    expect(resultado.descontoMetodoCentavos).toBe(1470)
    expect(resultado.totalCentavos).toBe(13230)
    expect(resultado.totalCentavos).not.toBe(12730)
  })

  test('as três parcelas sempre fecham com o subtotal', () => {
    const resultado = calcularTotal({
      produtoCentavos: 14990,
      bumpCentavos: 3700,
      bumpMarcado: true,
      descontoCentavos: 1869,
      percentualMetodo: 7,
    })

    expect(
      resultado.subtotalCentavos -
        resultado.descontoCentavos -
        resultado.descontoMetodoCentavos
    ).toBe(resultado.totalCentavos)
  })

  test('cupom que zera o pedido não deixa sobra para o método abater', () => {
    const resultado = calcularTotal({
      produtoCentavos: 5000,
      bumpCentavos: null,
      bumpMarcado: false,
      descontoCentavos: 5000,
      percentualMetodo: 10,
    })

    expect(resultado.descontoMetodoCentavos).toBe(0)
    expect(resultado.totalCentavos).toBe(0)
  })

  test('trunca o meio centavo, igual ao servidor', () => {
    // 1990 × 25% = 497,5 → 497, e não 498. O servidor faz Math.floor; se aqui
    // arredondasse para cima, a tela mostraria R$ 14,92 e a fatura viria
    // R$ 14,93. Truncar erra para MENOS desconto, que é o lado seguro.
    expect(descontoDoMetodo(1990, 25)).toBe(497)
  })

  // Estes casos existem porque a divergência de um centavo não aparece em
  // preço redondo: só quando base × percentual cai em meio centavo. Preço
  // terminado em ,95/,97/,99 é a regra num checkout, não a exceção.
  test.each([
    [9990, 5, 499], // 499,5 → 499
    [19799, 10, 1979], // 1979,9 → 1979
    [19999, 10, 1999], // 1999,9 → 1999
    [995, 10, 99], // 99,5 → 99
    [19700, 10, 1970], // exato, não deve mudar
  ])(
    'desconto de %i centavos a %i%% dá %i, o mesmo que o servidor',
    (base, percentual, esperado) => {
      expect(descontoDoMetodo(base, percentual)).toBe(esperado)
    }
  )

  test('o desconto nunca derruba o total abaixo do mínimo do gateway', () => {
    // R$ 4,90 com 90% daria R$ 0,49 — abaixo do piso de R$ 0,50, que o
    // Mercado Pago recusa. O servidor limita o desconto a 440; a tela precisa
    // limitar igual, senão anuncia um preço que a cobrança não aceita.
    expect(descontoDoMetodo(490, 90)).toBe(440)
    expect(descontoDoMetodo(100, 90)).toBe(50)
    expect(descontoDoMetodo(50, 90)).toBe(0)
  })

  test('percentual fracionário é truncado, como o servidor faz', () => {
    // A coluna é smallint: 10.5 no banco vira 10 na cobrança.
    expect(normalizarPercentualMetodo(10.5)).toBe(10)
    expect(normalizarPercentualMetodo(10.9)).toBe(10)
    expect(normalizarPercentualMetodo(0.9)).toBeNull()
  })

  test('percentual fora da faixa vira nada ou é limitado no teto', () => {
    expect(normalizarPercentualMetodo(null)).toBeNull()
    expect(normalizarPercentualMetodo(undefined)).toBeNull()
    expect(normalizarPercentualMetodo(0)).toBeNull()
    expect(normalizarPercentualMetodo(-10)).toBeNull()
    expect(normalizarPercentualMetodo(Number.NaN)).toBeNull()
    // Teto: exibir 90 mostra um total MAIOR do que o servidor cobraria a 95 —
    // o único lado seguro de errar.
    expect(normalizarPercentualMetodo(95)).toBe(90)
    expect(normalizarPercentualMetodo(10)).toBe(10)
  })

  test('formata o percentual sem casa decimal inútil', () => {
    expect(formatarPercentual(10)).toBe('10')
    expect(formatarPercentual(7.5)).toBe('7,5')
  })
})

describe('resolverTotal com desconto de método', () => {
  const previa = {
    subtotalCentavos: 19700,
    descontoCentavos: 0,
    descontoMetodoCentavos: 0,
    totalCentavos: 19700,
  }

  test('reparte o abatimento do servidor entre cupom e método', () => {
    // Servidor: 24400 − 4400 (cupom) = 20000, − 10% (Pix) = 18000.
    const resolvido = resolverTotal(
      { ...previa, subtotalCentavos: 24400, totalCentavos: 24400 },
      {
        subtotalCentavos: 24400,
        descontoCentavos: 4400,
        totalCentavos: 18000,
      }
    )

    expect(resolvido.descontoCentavos).toBe(4400)
    expect(resolvido.descontoMetodoCentavos).toBe(2000)
    expect(resolvido.totalCentavos).toBe(18000)
    // Fecha: 24400 − 4400 − 2000 = 18000.
    expect(
      resolvido.subtotalCentavos -
        resolvido.descontoCentavos -
        resolvido.descontoMetodoCentavos
    ).toBe(resolvido.totalCentavos)
  })

  test('sem desconto de método a sobra é zero e a linha some', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 19700,
      descontoCentavos: 1970,
      totalCentavos: 17730,
    })

    expect(resolvido.descontoCentavos).toBe(1970)
    expect(resolvido.descontoMetodoCentavos).toBe(0)
  })

  test('desconto do servidor maior que o abatimento real não vira sobra negativa', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 19700,
      descontoCentavos: 9999999,
      totalCentavos: 17730,
    })

    expect(resolvido.descontoCentavos).toBe(1970)
    expect(resolvido.descontoMetodoCentavos).toBe(0)
  })

  test('só desconto de método: o servidor manda cupom zero', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 19700,
      descontoCentavos: 0,
      totalCentavos: 17730,
    })

    expect(resolvido.descontoCentavos).toBe(0)
    expect(resolvido.descontoMetodoCentavos).toBe(1970)
  })
})

describe('normalizarCheckout · desconto no Pix', () => {
  test('lê o percentual de dentro do objeto checkout', () => {
    const info = normalizarCheckout(
      {
        produto: { nome: 'Curso', preco_centavos: 19700 },
        checkout: { slug: 'curso', desconto_pix_percentual: 10 },
      },
      'curso'
    )

    expect(info?.checkout.descontoPixPercentual).toBe(10)
  })

  test('aceita o percentual solto na raiz da resposta', () => {
    const info = normalizarCheckout(
      {
        produto: { nome: 'Curso', preco_centavos: 19700 },
        desconto_pix_percentual: 7.5,
      },
      'curso'
    )

    expect(info?.checkout.descontoPixPercentual).toBe(7.5)
  })

  // O campo é novo: enquanto o backend não o devolver, a página segue igual.
  test('campo ausente vira null em vez de quebrar', () => {
    const info = normalizarCheckout(
      { produto: { nome: 'Curso', preco_centavos: 19700 }, checkout: {} },
      'curso'
    )

    expect(info?.checkout.descontoPixPercentual).toBeNull()
    expect(info?.produto.precoCentavos).toBe(19700)
  })

  test('zero, negativo ou lixo não viram desconto', () => {
    for (const bruto of [0, -5, 'dez', null, 150]) {
      const info = normalizarCheckout(
        {
          produto: { nome: 'Curso', preco_centavos: 19700 },
          checkout: { desconto_pix_percentual: bruto },
        },
        'curso'
      )
      expect(info?.checkout.descontoPixPercentual).toBeNull()
    }
  })
})

/**
 * Contrato real da edge function /cupom-validar (supabase/functions):
 * `desconto_centavos` é a SOMA dos dois abatimentos, e a separação vem em
 * `desconto_cupom_centavos` / `desconto_metodo_centavos`. Confundir a soma
 * com o cupom junta as duas linhas do resumo numa só.
 */
describe('resolverTotal · separação vinda do servidor', () => {
  const previa = {
    subtotalCentavos: 24400,
    descontoCentavos: 0,
    descontoMetodoCentavos: 0,
    totalCentavos: 24400,
  }

  test('usa a separação explícita em vez da soma', () => {
    // 24400 − 4400 (cupom) = 20000, − 10% (Pix) = 18000.
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 24400,
      descontoCentavos: 6400, // SOMA: 4400 + 2000
      descontoCupomCentavos: 4400,
      descontoMetodoCentavos: 2000,
      totalCentavos: 18000,
    })

    expect(resolvido.descontoCentavos).toBe(4400)
    expect(resolvido.descontoMetodoCentavos).toBe(2000)
    expect(resolvido.totalCentavos).toBe(18000)
  })

  test('a SOMA não pode vazar para a linha do cupom', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 24400,
      descontoCentavos: 6400,
      descontoCupomCentavos: 4400,
      descontoMetodoCentavos: 2000,
      totalCentavos: 18000,
    })

    // Sem a separação, a linha "Cupom" mostraria 6400 e "Desconto no Pix"
    // sumiria — a pessoa veria um cupom que abate mais do que abate.
    expect(resolvido.descontoCentavos).not.toBe(6400)
  })

  test('cupom inválido com Pix ligado: tudo na linha do método', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 24400,
      descontoCentavos: 2440,
      descontoCupomCentavos: 0,
      descontoMetodoCentavos: 2440,
      totalCentavos: 21960,
    })

    expect(resolvido.descontoCentavos).toBe(0)
    expect(resolvido.descontoMetodoCentavos).toBe(2440)
  })

  test('servidor antigo (sem separação) põe tudo no cupom, como antes', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 24400,
      descontoCentavos: 4400,
      totalCentavos: 20000,
    })

    expect(resolvido.descontoCentavos).toBe(4400)
    expect(resolvido.descontoMetodoCentavos).toBe(0)
  })

  test('as linhas fecham com o total mesmo se o servidor se contradisser', () => {
    const resolvido = resolverTotal(previa, {
      subtotalCentavos: 24400,
      descontoCentavos: 999,
      descontoCupomCentavos: 4400,
      descontoMetodoCentavos: 999999, // incoerente de propósito
      totalCentavos: 18000,
    })

    expect(
      resolvido.subtotalCentavos -
        resolvido.descontoCentavos -
        resolvido.descontoMetodoCentavos
    ).toBe(resolvido.totalCentavos)
  })
})
