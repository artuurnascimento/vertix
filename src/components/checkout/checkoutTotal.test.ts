import { describe, expect, test } from 'vitest'
import {
  calcularTotal,
  formatarCentavos,
  formatarContagem,
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
