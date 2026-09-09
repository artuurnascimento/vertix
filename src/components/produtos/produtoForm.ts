import { z } from 'zod'
import { PRODUTO_ENTREGAS, PRODUTO_TIPOS } from './produtosData'
import type { Produto, ProdutoPayload } from './produtosData'
import { centavosParaCampo, reaisParaCentavos } from './precos'

/**
 * Regras do formulário de produto: slug, preço e âncora. Tudo aqui é função
 * pura para poder ser testado sem montar a tela — é onde moram os erros que
 * custam dinheiro (preço fora de escala, slug repetido).
 */

/** Slug aceito na URL: minúsculas, números e hífens simples. */
export const PADRAO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** "Plano de Correção 2.0" → "plano-de-correcao-2-0". */
export function gerarSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * true quando o slug já pertence a OUTRO registro. O banco também tem índice
 * único, mas avisar antes do submit evita o erro cru do PostgREST.
 */
export function slugDuplicado(
  slug: string,
  existentes: readonly { id: string; slug: string }[],
  idAtual?: string | null
): boolean {
  const alvo = slug.trim().toLowerCase()
  if (alvo === '') return false
  return existentes.some((r) => r.slug === alvo && r.id !== idAtual)
}

export interface ProdutoFormValues {
  nome: string
  slug: string
  descricao: string
  /** Texto digitado em reais ("197,00") — convertido só no payload. */
  preco: string
  precoAncora: string
  tipo: (typeof PRODUTO_TIPOS)[number]
  entrega: (typeof PRODUTO_ENTREGAS)[number]
  /** Tipo de serviço da Vertix. Vazio = não classificado. */
  categoria: string
  ativo: boolean
}

export const EMPTY_PRODUTO: ProdutoFormValues = {
  nome: '',
  slug: '',
  descricao: '',
  preco: '',
  precoAncora: '',
  tipo: 'principal',
  entrega: 'manual',
  categoria: '',
  ativo: true,
}

const precoObrigatorio = (valor: string): boolean => {
  const centavos = reaisParaCentavos(valor)
  return centavos !== null && centavos > 0
}

const precoOpcional = (valor: string): boolean =>
  valor.trim() === '' || precoObrigatorio(valor)

export const produtoSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome do produto.'),
    slug: z
      .string()
      .trim()
      .min(1, 'Informe o slug.')
      .regex(PADRAO_SLUG, 'Use só letras minúsculas, números e hífens.'),
    descricao: z.string().trim(),
    preco: z
      .string()
      .trim()
      .refine(precoObrigatorio, 'Informe um preço maior que zero (ex.: 197,00).'),
    precoAncora: z
      .string()
      .trim()
      .refine(precoOpcional, 'Preço de âncora inválido (ex.: 297,00).'),
    tipo: z.enum(PRODUTO_TIPOS),
    entrega: z.enum(PRODUTO_ENTREGAS),
    // Opcional de propósito: exigir a taxonomia aqui travaria o cadastro de
    // um produto novo por uma decisão gerencial que pode vir depois. O que
    // não estiver classificado aparece como "Sem categoria" em Pedidos.
    categoria: z.string().trim().max(60, 'Categoria muito longa (máx. 60).'),
    ativo: z.boolean(),
  })
  .refine(
    (v) => {
      const ancora = reaisParaCentavos(v.precoAncora)
      const preco = reaisParaCentavos(v.preco)
      if (ancora === null || preco === null) return true
      return ancora > preco
    },
    {
      path: ['precoAncora'],
      message: 'A âncora precisa ser maior que o preço de venda.',
    }
  )

/** Valores do form → linha do banco (reais viram centavos aqui). */
export function produtoFormToPayload(values: ProdutoFormValues): ProdutoPayload {
  const preco = reaisParaCentavos(values.preco)
  if (preco === null) throw new Error('Preço inválido.')
  return {
    nome: values.nome.trim(),
    slug: values.slug.trim().toLowerCase(),
    descricao: values.descricao.trim() === '' ? null : values.descricao.trim(),
    preco_centavos: preco,
    preco_ancora_centavos: reaisParaCentavos(values.precoAncora),
    tipo: values.tipo,
    entrega: values.entrega,
    // Campo vazio vira NULL, não string vazia: `''` seria uma categoria com
    // nome invisível na lista do filtro, separada de "sem categoria".
    categoria: values.categoria.trim() === '' ? null : values.categoria.trim(),
    ativo: values.ativo,
  }
}

/** Linha do banco → valores do form (centavos viram reais aqui). */
export function produtoToFormValues(produto: Produto): ProdutoFormValues {
  return {
    nome: produto.nome,
    slug: produto.slug,
    descricao: produto.descricao ?? '',
    preco: centavosParaCampo(produto.preco_centavos),
    precoAncora: centavosParaCampo(produto.preco_ancora_centavos),
    tipo: produto.tipo,
    entrega: produto.entrega,
    categoria: produto.categoria ?? '',
    ativo: produto.ativo,
  }
}
