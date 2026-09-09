import { describe, expect, it } from 'vitest'
import { categoriasDoCatalogo } from './produtosData'
import type { Produto } from './produtosData'

/**
 * `categoriasDoCatalogo` alimenta o `datalist` do formulário de produto, e o
 * que ele existe para evitar é divergência de nome: sem sugestão, "Tema" e
 * "tema sob medida" viram duas categorias que somam separado no relatório de
 * Pedidos — e o erro só aparece quando o número não bate.
 */

const produto = (categoria: string | null, id = 'p1'): Produto =>
  ({
    id,
    nome: 'Produto',
    slug: 'produto',
    descricao: null,
    preco_centavos: 19700,
    preco_ancora_centavos: null,
    tipo: 'principal',
    entrega: 'manual',
    categoria,
    ativo: true,
    created_at: '2026-09-08T12:00:00.000Z',
    updated_at: '2026-09-08T12:00:00.000Z',
  }) satisfies Produto

describe('categoriasDoCatalogo', () => {
  it('lista sem repetir e em ordem alfabética', () => {
    expect(
      categoriasDoCatalogo([
        produto('Tema sob medida'),
        produto('App', 'p2'),
        produto('Tema sob medida', 'p3'),
      ])
    ).toEqual(['App', 'Tema sob medida'])
  })

  it('ignora quem ainda não foi classificado', () => {
    // Sugerir vazio na lista seria oferecer "sem categoria" como se fosse um
    // serviço da Vertix.
    expect(
      categoriasDoCatalogo([produto(null), produto('   ', 'p2')])
    ).toEqual([])
  })

  it('sugere a versão já gravada, sem os espaços das pontas', () => {
    expect(categoriasDoCatalogo([produto(' Consultoria ')])).toEqual([
      'Consultoria',
    ])
  })

  it('ordena com as regras do português, não por código de caractere', () => {
    // 'Á' vem depois de 'Z' em ordem de byte; na estante, vem antes.
    expect(
      categoriasDoCatalogo([produto('Zap', 'p1'), produto('Área', 'p2')])
    ).toEqual(['Área', 'Zap'])
  })
})
