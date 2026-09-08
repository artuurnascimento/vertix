import { describe, expect, it } from 'vitest'
import {
  EMPTY_CHECKOUT,
  campoDataHoraParaIso,
  checkoutFormToPayload,
  checkoutSchema,
  checkoutToFormValues,
  cronometroExpirado,
  isoParaCampoDataHora,
  limparProva,
  ofertaEhOProprioProduto,
  ofertasEmConflito,
  percentualPixValido,
} from './checkoutForm'
import type { CheckoutFormValues } from './checkoutForm'
import { parseProva } from './checkoutsData'
import type { Checkout } from './checkoutsData'

const PRINCIPAL = '11111111-1111-4111-8111-111111111111'
const OUTRO = '22222222-2222-4222-8222-222222222222'

const VALIDO: CheckoutFormValues = {
  ...EMPTY_CHECKOUT,
  produtoId: PRINCIPAL,
  slug: 'plano-de-correcao',
  titulo: 'Corrija sua loja em 7 dias',
}

function erroDe(values: CheckoutFormValues, campo: string): string | undefined {
  const parsed = checkoutSchema.safeParse(values)
  if (parsed.success) return undefined
  return parsed.error.issues.find((i) => i.path[0] === campo)?.message
}

describe('ofertaEhOProprioProduto', () => {
  it('acusa oferta apontando para o produto principal', () => {
    expect(ofertaEhOProprioProduto(PRINCIPAL, PRINCIPAL)).toBe(true)
  })

  it('libera oferta de outro produto ou vazia', () => {
    expect(ofertaEhOProprioProduto(PRINCIPAL, OUTRO)).toBe(false)
    expect(ofertaEhOProprioProduto(PRINCIPAL, '')).toBe(false)
  })

  it('não acusa nada quando o principal ainda não foi escolhido', () => {
    expect(ofertaEhOProprioProduto('', '')).toBe(false)
  })
})

describe('ofertasEmConflito', () => {
  it('lista as três ofertas quando todas repetem o principal', () => {
    expect(
      ofertasEmConflito({
        ...VALIDO,
        bumpProdutoId: PRINCIPAL,
        upsellProdutoId: PRINCIPAL,
        downsellProdutoId: PRINCIPAL,
      })
    ).toEqual(['bump', 'upsell', 'downsell'])
  })

  it('não lista nada numa oferta bem montada', () => {
    expect(ofertasEmConflito({ ...VALIDO, bumpProdutoId: OUTRO })).toEqual([])
  })
})

describe('checkoutSchema', () => {
  it('aceita o mínimo: produto, slug e título', () => {
    expect(checkoutSchema.safeParse(VALIDO).success).toBe(true)
  })

  it('exige produto principal, slug e título', () => {
    expect(erroDe({ ...VALIDO, produtoId: '' }, 'produtoId')).toBe(
      'Escolha o produto principal.'
    )
    expect(erroDe({ ...VALIDO, slug: '' }, 'slug')).toBe(
      'Informe o slug da página.'
    )
    expect(erroDe({ ...VALIDO, titulo: '   ' }, 'titulo')).toBe(
      'Informe o título da página.'
    )
  })

  it('recusa slug fora do padrão de URL', () => {
    expect(erroDe({ ...VALIDO, slug: 'Plano Correção' }, 'slug')).toBe(
      'Use só letras minúsculas, números e hífens.'
    )
  })

  it('recusa bump que é o próprio produto principal', () => {
    expect(
      erroDe({ ...VALIDO, bumpProdutoId: PRINCIPAL }, 'bumpProdutoId')
    ).toBe('O order bump não pode ser o mesmo produto principal.')
  })

  it('recusa upsell e downsell que repetem o principal', () => {
    expect(
      erroDe({ ...VALIDO, upsellProdutoId: PRINCIPAL }, 'upsellProdutoId')
    ).toBe('O upsell não pode ser o mesmo produto principal.')
    expect(
      erroDe({ ...VALIDO, downsellProdutoId: PRINCIPAL }, 'downsellProdutoId')
    ).toBe('O downsell não pode ser o mesmo produto principal.')
  })

  it('aceita ofertas de outros produtos', () => {
    const parsed = checkoutSchema.safeParse({
      ...VALIDO,
      bumpProdutoId: OUTRO,
      upsellProdutoId: OUTRO,
    })
    expect(parsed.success).toBe(true)
  })

  it('recusa garantia em dias que não é número inteiro', () => {
    expect(erroDe({ ...VALIDO, garantiaDias: 'sete' }, 'garantiaDias')).toBe(
      'Informe os dias de garantia em número inteiro.'
    )
    expect(checkoutSchema.safeParse({ ...VALIDO, garantiaDias: '7' }).success).toBe(
      true
    )
  })
})

describe('cronômetro', () => {
  it('faz a volta datetime-local → ISO → datetime-local', () => {
    const campo = '2026-12-24T23:59'
    const iso = campoDataHoraParaIso(campo)
    expect(iso).not.toBeNull()
    expect(isoParaCampoDataHora(iso)).toBe(campo)
  })

  it('trata campo vazio como sem cronômetro', () => {
    expect(campoDataHoraParaIso('')).toBeNull()
    expect(isoParaCampoDataHora(null)).toBe('')
  })

  it('avisa quando o prazo já passou (a página não mostra nada depois)', () => {
    const agora = new Date('2026-09-07T12:00:00Z')
    expect(cronometroExpirado('2026-09-01T10:00', agora)).toBe(true)
    expect(cronometroExpirado('2027-01-01T10:00', agora)).toBe(false)
    expect(cronometroExpirado('', agora)).toBe(false)
  })
})

describe('limparProva', () => {
  it('descarta depoimento sem texto e selo em branco', () => {
    const prova = limparProva(
      [
        { nome: 'Ana', texto: ' Vendi mais. ', nota: 5, loja: ' Loja Ana ' , fotoUrl: null},
        { nome: 'Vazio', texto: '   ', nota: null, loja: null , fotoUrl: null},
      ],
      ['Compra segura', '   ']
    )
    expect(prova.depoimentos).toEqual([
      { nome: 'Ana', texto: 'Vendi mais.', nota: 5, loja: 'Loja Ana' , fotoUrl: null},
    ])
    expect(prova.selos).toEqual(['Compra segura'])
  })
})

describe('parseProva', () => {
  it('devolve prova vazia para jsonb solto ou inesperado', () => {
    expect(parseProva(null)).toEqual({ depoimentos: [], selos: [] })
    expect(parseProva({})).toEqual({ depoimentos: [], selos: [] })
    expect(parseProva('texto')).toEqual({ depoimentos: [], selos: [] })
  })

  it('ignora nota fora de 1 a 5 e depoimento sem texto', () => {
    const prova = parseProva({
      depoimentos: [
        { nome: 'Ana', texto: 'Boa', nota: 9 },
        { nome: 'Sem texto' },
      ],
      selos: ['Selo', 3],
    })
    expect(prova.depoimentos).toEqual([
      { nome: 'Ana', texto: 'Boa', nota: null, loja: null , fotoUrl: null},
    ])
    expect(prova.selos).toEqual(['Selo'])
  })
})

describe('checkoutFormToPayload', () => {
  it('transforma texto vazio em null e normaliza o slug', () => {
    const payload = checkoutFormToPayload({
      ...VALIDO,
      slug: ' Plano-De-Correcao ',
      subtitulo: '  ',
      bumpProdutoId: '',
    })
    expect(payload.slug).toBe('plano-de-correcao')
    expect(payload.subtitulo).toBeNull()
    expect(payload.bump_produto_id).toBeNull()
    expect(payload.cronometro_ate).toBeNull()
    expect(payload.garantia_dias).toBeNull()
  })

  it('grava a prova já limpa', () => {
    const payload = checkoutFormToPayload({
      ...VALIDO,
      depoimentos: [{ nome: 'Ana', texto: 'Ótimo', nota: null, loja: '' , fotoUrl: null}],
      selos: ['Compra segura'],
    })
    expect(payload.prova).toEqual({
      depoimentos: [{ nome: 'Ana', texto: 'Ótimo', nota: null, loja: null , fotoUrl: null}],
      selos: ['Compra segura'],
    })
  })
})

describe('desconto no Pix', () => {
  it('aceita vazio, zero e a faixa até o teto', () => {
    expect(percentualPixValido('')).toBe(true)
    expect(percentualPixValido('   ')).toBe(true)
    expect(percentualPixValido('0')).toBe(true)
    expect(percentualPixValido('10')).toBe(true)
    expect(percentualPixValido('90')).toBe(true)
  })

  it('recusa acima do teto, negativo e não-número', () => {
    expect(percentualPixValido('91')).toBe(false)
    expect(percentualPixValido('100')).toBe(false)
    expect(percentualPixValido('-5')).toBe(false)
    expect(percentualPixValido('10,5')).toBe(false)
    expect(percentualPixValido('dez')).toBe(false)
  })

  it('o schema acusa o percentual fora da faixa', () => {
    expect(erroDe({ ...VALIDO, descontoPixPercentual: '95' }, 'descontoPixPercentual')).toBe(
      'Informe um percentual inteiro de 0 a 90, ou deixe vazio.'
    )
    expect(
      erroDe({ ...VALIDO, descontoPixPercentual: '10' }, 'descontoPixPercentual')
    ).toBeUndefined()
  })

  it('vazio vira null no banco; número vira número', () => {
    expect(
      checkoutFormToPayload({ ...VALIDO, descontoPixPercentual: '' })
        .desconto_pix_percentual
    ).toBeNull()
    expect(
      checkoutFormToPayload({ ...VALIDO, descontoPixPercentual: '10' })
        .desconto_pix_percentual
    ).toBe(10)
  })
})

describe('padrão do resumo do pedido', () => {
  const LINHA: Checkout = {
    id: '33333333-3333-4333-8333-333333333333',
    produto_id: PRINCIPAL,
    slug: 'plano-de-correcao',
    titulo: 'Corrija sua loja em 7 dias',
    subtitulo: null,
    bump_produto_id: null,
    bump_titulo: null,
    bump_texto: null,
    upsell_produto_id: null,
    upsell_titulo: null,
    upsell_texto: null,
    downsell_produto_id: null,
    downsell_titulo: null,
    downsell_texto: null,
    prova: null,
    banner: null,
    garantia_dias: null,
    garantia_texto: null,
    desconto_pix_percentual: null,
    cronometro_ate: null,
    resumo_aberto: false,
    ativo: true,
    created_at: '2026-09-09T12:00:00.000Z',
    updated_at: '2026-09-09T12:00:00.000Z',
  }

  it('checkout novo nasce com o resumo RECOLHIDO', () => {
    expect(EMPTY_CHECKOUT.resumoAberto).toBe(false)
    expect(checkoutFormToPayload(VALIDO).resumo_aberto).toBe(false)
  })

  it('marcado, o payload manda o resumo aberto', () => {
    expect(
      checkoutFormToPayload({ ...VALIDO, resumoAberto: true }).resumo_aberto
    ).toBe(true)
  })

  it('a coluna volta para o formulário como veio', () => {
    expect(checkoutToFormValues(LINHA).resumoAberto).toBe(false)
    expect(
      checkoutToFormValues({ ...LINHA, resumo_aberto: true }).resumoAberto
    ).toBe(true)
  })

  it('linha antiga, sem a coluna, cai em recolhido em vez de undefined', () => {
    // Uma leitura feita antes da migration chega sem o campo. `undefined` num
    // checkbox controlado trocaria o input para não-controlado no meio do uso.
    const semColuna = { ...LINHA } as Partial<Checkout>
    delete semColuna.resumo_aberto
    expect(checkoutToFormValues(semColuna as Checkout).resumoAberto).toBe(false)
  })
})
