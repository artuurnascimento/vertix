import { describe, expect, test } from 'vitest'
import { formatarPercentual, resumirBio, taxa } from './bioResumo'
import type { EventoBio } from './bioResumo'

const BOTOES = [
  { id: 'zap', rotulo: 'Falar no WhatsApp' },
  { id: 'loja', rotulo: 'Loja Shopify' },
  { id: 'projetos', rotulo: 'Projetos' },
]

function evento(
  tipo: 'visita' | 'clique',
  link_id: string | null = null
): EventoBio {
  return { tipo, link_id, created_at: '2026-09-01T10:00:00Z' }
}

describe('taxa', () => {
  test('cliques por visita em porcentagem', () => {
    expect(taxa(25, 100)).toBe(25)
  })

  test('devolve null sem visitas (indefinido, não Infinity)', () => {
    expect(taxa(3, 0)).toBeNull()
  })

  test('zero clique com visitas é zero, não null', () => {
    expect(taxa(0, 40)).toBe(0)
  })
})

describe('resumirBio', () => {
  test('conta visitas e cliques e calcula a taxa geral', () => {
    const resumo = resumirBio(
      [
        evento('visita'),
        evento('visita'),
        evento('visita'),
        evento('visita'),
        evento('clique', 'zap'),
      ],
      BOTOES
    )
    expect(resumo.visitas).toBe(4)
    expect(resumo.cliques).toBe(1)
    expect(resumo.taxaGeral).toBe(25)
  })

  test('participação dos botões soma cem por cento', () => {
    const resumo = resumirBio(
      [
        evento('visita'),
        evento('clique', 'zap'),
        evento('clique', 'zap'),
        evento('clique', 'loja'),
        evento('clique', 'projetos'),
      ],
      BOTOES
    )
    const soma = resumo.botoes.reduce((acc, b) => acc + (b.participacao ?? 0), 0)
    expect(Math.round(soma)).toBe(100)
  })

  test('ordena do mais clicado para o menos', () => {
    const resumo = resumirBio(
      [
        evento('clique', 'loja'),
        evento('clique', 'loja'),
        evento('clique', 'loja'),
        evento('clique', 'zap'),
      ],
      BOTOES
    )
    expect(resumo.botoes.map((b) => b.id)).toEqual(['loja', 'zap', 'projetos'])
  })

  test('botão sem clique aparece com zero, não some da lista', () => {
    const resumo = resumirBio([evento('visita'), evento('clique', 'zap')], BOTOES)
    const projetos = resumo.botoes.find((b) => b.id === 'projetos')
    expect(projetos?.cliques).toBe(0)
    expect(resumo.botoes).toHaveLength(3)
  })

  test('período sem evento devolve zeros e taxa indefinida', () => {
    const resumo = resumirBio([], BOTOES)
    expect(resumo.visitas).toBe(0)
    expect(resumo.cliques).toBe(0)
    expect(resumo.taxaGeral).toBeNull()
    expect(resumo.botoes.every((b) => b.participacao === null)).toBe(true)
  })

  test('clique de botão já excluído não quebra a soma', () => {
    // O vínculo vira nulo quando o botão é apagado (on delete set null).
    const resumo = resumirBio(
      [evento('visita'), evento('clique', null), evento('clique', 'zap')],
      BOTOES
    )
    expect(resumo.cliques).toBe(2)
    expect(resumo.botoes.find((b) => b.id === 'zap')?.cliques).toBe(1)
  })
})

describe('formatarPercentual', () => {
  test('indefinido vira travessão', () => {
    expect(formatarPercentual(null)).toBe('—')
  })

  test('formata em pt-BR com uma casa', () => {
    expect(formatarPercentual(12.34)).toBe('12,3%')
  })
})
