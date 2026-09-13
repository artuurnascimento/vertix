import { describe, expect, test } from 'vitest'
import {
  chaveDoEsforco,
  descricaoDoItem,
  itensDoDiagnostico,
  normalizarProblemas,
  tituloDaProposta,
} from './diagnostico'
import type { EsforcoDaRegra, ProblemaDoDiagnostico } from './diagnostico'

const ESFORCOS: EsforcoDaRegra[] = [
  { regra: 'imagens_pesadas', titulo: 'Imagens pesadas', horas: 3, ativo: true },
  { regra: 'sem_h1', titulo: 'Sem H1', horas: 0.5, ativo: true },
  { regra: 'noindex', titulo: 'noindex', horas: 0.5, ativo: false },
  { regra: 'fontes_demais', titulo: 'Fontes demais', horas: 0, ativo: true },
  { regra: 'impacto_alto', titulo: 'Outro alto', horas: 3, ativo: true },
  { regra: 'impacto_medio', titulo: 'Outro médio', horas: 2, ativo: true },
  { regra: 'impacto_baixo', titulo: 'Outro baixo', horas: 1, ativo: true },
]

const PROBLEMAS: ProblemaDoDiagnostico[] = [
  { title: 'Página sem H1', category: 'seo', impact: 'baixo', regra: 'sem_h1' },
  { title: 'Banner desalinhado no celular', category: 'identidade', impact: 'medio' },
  { title: 'Imagens pesadas na home', category: 'velocidade', impact: 'alto', regra: 'imagens_pesadas' },
  { title: 'Loja bloqueada para o Google', category: 'seo', impact: 'alto', regra: 'noindex' },
  { title: 'Fontes demais', category: 'velocidade', impact: 'baixo', regra: 'fontes_demais' },
  { title: 'Regra que a tabela não conhece', impact: 'alto', regra: 'regra_nova' },
]

describe('itensDoDiagnostico', () => {
  test('um item por problema em ordem de impacto, quantidade = horas, unitário = valor da hora', () => {
    const r = itensDoDiagnostico(PROBLEMAS, ESFORCOS, 150)
    expect(r.itens.map((i) => [i.descricao, i.quantidade, i.valor_unitario])).toEqual([
      ['Velocidade · Imagens pesadas na home', 3, 150],
      // Sem regra na tabela: cai no fallback do impacto.
      ['Regra que a tabela não conhece', 3, 150],
      // Sem regra nenhuma (visual): fallback do impacto.
      ['Identidade · Banner desalinhado no celular', 2, 150],
      ['SEO · Página sem H1', 0.5, 150],
    ])
    // noindex desativada e fontes_demais com zero horas ficam de fora.
    expect(r.pulados).toBe(2)
    expect(r.horas).toBe(8.5)
  })

  test('sem tabela de esforço nenhum item sai — não inventa horas', () => {
    const r = itensDoDiagnostico(PROBLEMAS, [], 150)
    expect(r.itens).toEqual([])
    expect(r.pulados).toBe(PROBLEMAS.length)
  })

  test('problema sem título não vira item vazio', () => {
    const r = itensDoDiagnostico([{ title: '   ', impact: 'alto' }], ESFORCOS, 100)
    expect(r.itens).toEqual([])
    expect(r.pulados).toBe(1)
  })
})

describe('chaveDoEsforco / descricaoDoItem', () => {
  test('regra manda; sem regra, o impacto; sem impacto, médio', () => {
    expect(chaveDoEsforco({ title: 'x', regra: 'lcp_lento', impact: 'baixo' })).toBe('lcp_lento')
    expect(chaveDoEsforco({ title: 'x', impact: 'baixo' })).toBe('impacto_baixo')
    expect(chaveDoEsforco({ title: 'x' })).toBe('impacto_medio')
  })

  test('categoria conhecida vira prefixo; desconhecida, só o título', () => {
    expect(descricaoDoItem({ title: 'Título', category: 'pagina_produto' })).toBe('Página de produto · Título')
    expect(descricaoDoItem({ title: 'Título', category: 'outra' })).toBe('Título')
  })
})

describe('tituloDaProposta', () => {
  test('usa o domínio limpo; sem domínio, o genérico', () => {
    expect(tituloDaProposta('https://minhaloja.com.br/')).toBe('Correção da loja minhaloja.com.br')
    expect(tituloDaProposta('  ')).toBe('Correção da loja')
    expect(tituloDaProposta(null)).toBe('Correção da loja')
  })
})

describe('normalizarProblemas', () => {
  test('descarta o que não tem título e limpa impacto/regra fora do vocabulário', () => {
    const r = normalizarProblemas([
      { title: ' Imagens pesadas ', impact: 'alto', regra: ' imagens_pesadas ', category: 'velocidade', why: 'w' },
      { title: 'Sem impacto válido', impact: 'critico', regra: 7 },
      { title: '' },
      null,
      'texto',
    ])
    expect(r).toEqual([
      { title: 'Imagens pesadas', impact: 'alto', regra: 'imagens_pesadas', category: 'velocidade', why: 'w' },
      { title: 'Sem impacto válido', impact: undefined, regra: undefined, category: undefined, why: undefined },
    ])
    expect(normalizarProblemas(undefined)).toEqual([])
  })
})
