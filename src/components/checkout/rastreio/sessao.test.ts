import { describe, expect, test } from 'vitest'
import {
  CHAVE_VISITANTE,
  PREFIXO_SESSAO,
  gerarId,
  sessaoDaVisita,
  sessaoExistente,
  visitanteDaMaquina,
} from './sessao'

/** Testes da identidade da visita (sessao.ts). Arquivo de teste, Vitest. */

function armazemEmMemoria(inicial: Record<string, string> = {}): Storage {
  const dados = new Map(Object.entries(inicial))
  return {
    get length() {
      return dados.size
    },
    key: (i: number) => [...dados.keys()][i] ?? null,
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
    clear: () => dados.clear(),
  }
}

const ID = '3f2b6c8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'

describe('sessaoDaVisita', () => {
  test('cria e guarda uma sessão nova por checkout', () => {
    const s = armazemEmMemoria()
    const r = sessaoDaVisita('plano', s, () => ID)
    expect(r).toEqual({ id: ID, nova: true })
    expect(s.getItem(PREFIXO_SESSAO + 'plano')).toBe(ID)
  })

  test('reaproveita a sessão da aba (F5, upsell, obrigado)', () => {
    const s = armazemEmMemoria({ [PREFIXO_SESSAO + 'plano']: ID })
    expect(sessaoDaVisita('plano', s, () => 'outro')).toEqual({ id: ID, nova: false })
    expect(sessaoExistente('plano', s)).toBe(ID)
    expect(sessaoExistente('outro-checkout', s)).toBeNull()
  })

  test('valor corrompido no storage é ignorado', () => {
    const s = armazemEmMemoria({ [PREFIXO_SESSAO + 'plano']: 'lixo' })
    expect(sessaoDaVisita('plano', s, () => ID).nova).toBe(true)
  })

  test('sem storage a sessão vale só nesta página', () => {
    expect(sessaoDaVisita('plano', null, () => ID)).toEqual({ id: ID, nova: true })
    expect(sessaoExistente('plano', null)).toBeNull()
  })
})

describe('visitanteDaMaquina e gerarId', () => {
  test('o id do navegador persiste entre chamadas', () => {
    const s = armazemEmMemoria()
    const a = visitanteDaMaquina(s)
    expect(visitanteDaMaquina(s)).toBe(a)
    expect(s.getItem(CHAVE_VISITANTE)).toBe(a)
  })

  test('gerarId produz um uuid v4', () => {
    expect(gerarId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(gerarId()).not.toBe(gerarId())
  })
})
