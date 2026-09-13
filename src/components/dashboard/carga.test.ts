import { describe, expect, test } from 'vitest'
import { cargaPorPessoa, projetosAbertos, somarHorasPorProjeto } from './carga'
import type { ProjetoParaCarga } from './carga'

const projeto = (o: Partial<ProjetoParaCarga>): ProjetoParaCarga => ({
  id: 'p',
  nome: 'Projeto',
  status: 'em_desenvolvimento',
  perdido_em: null,
  responsavel_id: 'u1',
  horas_estimadas: null,
  ...o,
})

const PERFIS = [
  { id: 'u1', nome: 'Artur' },
  { id: 'u2', nome: 'Bia' },
]

describe('projetosAbertos', () => {
  test('entregue e perdido não pesam', () => {
    const abertos = projetosAbertos([
      projeto({ id: 'a' }),
      projeto({ id: 'b', status: 'entregue' }),
      projeto({ id: 'c', status: 'lead', perdido_em: '2026-09-01T00:00:00Z' }),
      projeto({ id: 'd', status: 'lead' }),
    ])
    expect(abertos.map((p) => p.id)).toEqual(['a', 'd'])
  })
})

describe('cargaPorPessoa', () => {
  test('soma estimado, realizado e restante por responsável; semanas pela capacidade', () => {
    const horas = somarHorasPorProjeto([
      { project_id: 'a', horas: 10 },
      { project_id: 'a', horas: '2.5' },
      { project_id: 'b', horas: 50 }, // estourou: restante não fica negativo
      { project_id: 'z', horas: 99 }, // projeto entregue: não conta
    ])
    const linhas = cargaPorPessoa(
      [
        projeto({ id: 'a', horas_estimadas: '40' }),
        projeto({ id: 'b', horas_estimadas: 30 }),
        projeto({ id: 'c', responsavel_id: 'u2', horas_estimadas: 100 }),
        projeto({ id: 'd', responsavel_id: 'u2' }), // sem estimativa
        projeto({ id: 'e', responsavel_id: null, horas_estimadas: 8 }),
        projeto({ id: 'z', status: 'entregue', horas_estimadas: 5 }),
      ],
      horas,
      PERFIS,
      40
    )
    expect(linhas.map((l) => l.nome)).toEqual(['Bia', 'Artur', 'Sem responsável'])
    expect(linhas[0]).toMatchObject({ projetos: 2, semEstimativa: 1, estimadas: 100, realizadas: 0, restantes: 100, semanas: 2.5 })
    expect(linhas[1]).toMatchObject({ projetos: 2, semEstimativa: 0, estimadas: 70, realizadas: 62.5, restantes: 27.5, semanas: 0.7 })
    expect(linhas[2]).toMatchObject({ responsavelId: null, projetos: 1, restantes: 8, semanas: 0.2 })
  })

  test('sem capacidade não inventa semanas; responsável desconhecido ganha nome genérico', () => {
    const linhas = cargaPorPessoa([projeto({ id: 'a', responsavel_id: 'u9', horas_estimadas: 10 })], new Map(), PERFIS, 0)
    expect(linhas[0]).toMatchObject({ nome: 'Alguém da equipe', semanas: null, restantes: 10 })
  })

  test('sem projetos abertos, vazio', () => {
    expect(cargaPorPessoa([projeto({ status: 'entregue' })], new Map(), PERFIS, 40)).toEqual([])
  })
})
