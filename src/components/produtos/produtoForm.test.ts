import { describe, expect, it } from 'vitest'
import {
  EMPTY_PRODUTO,
  gerarSlug,
  produtoFormToPayload,
  produtoSchema,
  slugDuplicado,
} from './produtoForm'
import type { ProdutoFormValues } from './produtoForm'

const VALIDO: ProdutoFormValues = {
  ...EMPTY_PRODUTO,
  nome: 'Plano de Correção',
  slug: 'plano-de-correcao',
  descricao: 'Diagnóstico completo da loja.',
  preco: '197,00',
  precoAncora: '297,00',
  tipo: 'principal',
  entrega: 'plano_scan',
  ativo: true,
}

function erroDe(values: ProdutoFormValues, campo: string): string | undefined {
  const parsed = produtoSchema.safeParse(values)
  if (parsed.success) return undefined
  return parsed.error.issues.find((i) => i.path[0] === campo)?.message
}

describe('gerarSlug', () => {
  it('tira acento, caixa alta e pontuação', () => {
    expect(gerarSlug('Plano de Correção')).toBe('plano-de-correcao')
    expect(gerarSlug('Raio-X 2.0 — Vertix')).toBe('raio-x-2-0-vertix')
  })

  it('não deixa hífen sobrando nas pontas', () => {
    expect(gerarSlug('  Upsell!  ')).toBe('upsell')
    expect(gerarSlug('///')).toBe('')
  })
})

describe('slugDuplicado', () => {
  const existentes = [
    { id: 'a', slug: 'plano-de-correcao' },
    { id: 'b', slug: 'upsell-consultoria' },
  ]

  it('acusa slug já usado por outro produto', () => {
    expect(slugDuplicado('plano-de-correcao', existentes)).toBe(true)
  })

  it('não acusa o próprio registro em edição', () => {
    expect(slugDuplicado('plano-de-correcao', existentes, 'a')).toBe(false)
  })

  it('libera slug inédito e ignora vazio', () => {
    expect(slugDuplicado('novo-produto', existentes)).toBe(false)
    expect(slugDuplicado('', existentes)).toBe(false)
  })
})

describe('produtoSchema', () => {
  it('aceita um produto completo', () => {
    expect(produtoSchema.safeParse(VALIDO).success).toBe(true)
  })

  it('exige nome e slug', () => {
    expect(erroDe({ ...VALIDO, nome: '  ' }, 'nome')).toBe(
      'Informe o nome do produto.'
    )
    expect(erroDe({ ...VALIDO, slug: '' }, 'slug')).toBe('Informe o slug.')
  })

  it('recusa slug com maiúscula, espaço ou acento', () => {
    for (const slug of ['Plano', 'plano de correcao', 'correção', 'plano--x']) {
      expect(erroDe({ ...VALIDO, slug }, 'slug')).toBe(
        'Use só letras minúsculas, números e hífens.'
      )
    }
  })

  it('recusa preço vazio, zerado ou impossível de ler', () => {
    for (const preco of ['', '0', '0,00', 'combinar']) {
      expect(erroDe({ ...VALIDO, preco }, 'preco')).toBeDefined()
    }
  })

  it('aceita produto sem âncora', () => {
    expect(produtoSchema.safeParse({ ...VALIDO, precoAncora: '' }).success).toBe(
      true
    )
  })

  it('recusa âncora menor ou igual ao preço (o "de/por" seria mentira)', () => {
    expect(erroDe({ ...VALIDO, precoAncora: '97,00' }, 'precoAncora')).toBe(
      'A âncora precisa ser maior que o preço de venda.'
    )
    expect(erroDe({ ...VALIDO, precoAncora: '197,00' }, 'precoAncora')).toBe(
      'A âncora precisa ser maior que o preço de venda.'
    )
  })
})

describe('categoria — o tipo de serviço que a tela de Pedidos agrupa', () => {
  it('não é obrigatória: produto novo entra sem taxonomia decidida', () => {
    // Exigir a classificação aqui travaria o cadastro por uma decisão
    // gerencial que quase sempre vem depois do produto existir.
    expect(erroDe({ ...VALIDO, categoria: '' }, 'categoria')).toBeUndefined()
  })

  it('vazio vira NULL, não string vazia', () => {
    // `''` seria uma categoria de nome invisível na lista do filtro, contada
    // à parte de "Sem categoria" — dois baldes para a mesma coisa.
    expect(produtoFormToPayload({ ...VALIDO, categoria: '   ' }).categoria)
      .toBeNull()
  })

  it('grava sem os espaços das pontas', () => {
    // 'Tema ' e 'Tema' somariam separado no relatório, e ninguém veria a
    // diferença olhando a lista.
    expect(
      produtoFormToPayload({ ...VALIDO, categoria: '  Tema sob medida  ' })
        .categoria
    ).toBe('Tema sob medida')
  })

  it('recusa texto longo demais para caber num rótulo', () => {
    expect(erroDe({ ...VALIDO, categoria: 'x'.repeat(61) }, 'categoria')).toBe(
      'Categoria muito longa (máx. 60).'
    )
  })
})

describe('produtoFormToPayload', () => {
  it('grava centavos, não reais', () => {
    const payload = produtoFormToPayload(VALIDO)
    expect(payload.preco_centavos).toBe(19700)
    expect(payload.preco_ancora_centavos).toBe(29700)
  })

  it('normaliza slug e transforma texto vazio em null', () => {
    const payload = produtoFormToPayload({
      ...VALIDO,
      slug: '  Plano-De-Correcao ',
      descricao: '   ',
      precoAncora: '',
    })
    expect(payload.slug).toBe('plano-de-correcao')
    expect(payload.descricao).toBeNull()
    expect(payload.preco_ancora_centavos).toBeNull()
  })
})
