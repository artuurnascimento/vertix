import { describe, expect, it } from 'vitest'
import { ordenarFila, paginar, sinaisDoScan, somarDias, type ItemDaFila } from './fila'

const HOJE = '2026-09-13'
const item = (o: Partial<ItemDaFila>): ItemDaFila => ({
  project_id: 'p',
  projeto: 'Loja',
  status: 'lead',
  client_id: 'c',
  cliente: 'Ana',
  empresa: null,
  responsavel_id: null,
  responsavel: null,
  proxima_acao: null,
  proxima_acao_em: null,
  valor_estimado: null,
  previsao_fechamento: null,
  updated_at: '2026-09-13T10:00:00Z',
  comprou_plano: false,
  pediu_ajuda: null,
  reuniao_em: null,
  relatorio_aberto_em: null,
  tickets_abertos: 0,
  ...o,
})

describe('ordenarFila', () => {
  it('vencidas primeiro, depois hoje, sinais e sem próximo passo; o futuro fica de fora', () => {
    const fila = ordenarFila(
      [
        item({ project_id: 'futuro', proxima_acao_em: '2026-09-20', proxima_acao: 'ligar' }),
        item({ project_id: 'hoje', proxima_acao_em: HOJE, proxima_acao: 'mandar proposta' }),
        item({ project_id: 'vencida', proxima_acao_em: '2026-09-10', proxima_acao: 'ligar' }),
        item({ project_id: 'sinal', comprou_plano: true }),
        item({ project_id: 'parado', status: 'lead', updated_at: '2026-09-01T00:00:00Z' }),
        item({ project_id: 'execucao', status: 'em_desenvolvimento' }),
      ],
      HOJE
    )
    expect(fila.map((f) => f.project_id)).toEqual(['vencida', 'hoje', 'sinal', 'parado'])
    expect(fila[0].secao).toBe('vencidas')
    expect(fila[0].motivo).toBe('ligar — venceu há 3 dias')
    expect(fila[1].motivo).toBe('mandar proposta — para hoje')
    expect(fila[3].motivo).toBe('sem próximo passo há 12 dias')
  })

  it('entre vencidas, valor e intenção desempatam', () => {
    const fila = ordenarFila(
      [
        item({ project_id: 'pequena', proxima_acao_em: '2026-09-11', valor_estimado: 500 }),
        item({ project_id: 'grande', proxima_acao_em: '2026-09-11', valor_estimado: 15000 }),
        item({ project_id: 'quente', proxima_acao_em: '2026-09-11', valor_estimado: 500, comprou_plano: true, pediu_ajuda: 'não sei aplicar' }),
      ],
      HOJE
    )
    expect(fila.map((f) => f.project_id)).toEqual(['quente', 'grande', 'pequena'])
  })

  it('projeto em execução sem sinais não entra na fila', () => {
    expect(ordenarFila([item({ status: 'em_desenvolvimento' })], HOJE)).toEqual([])
  })
})

describe('sinaisDoScan', () => {
  it('lista os sinais em ordem de peso e não repete "abriu o relatório" para quem comprou', () => {
    expect(sinaisDoScan(item({ comprou_plano: true, relatorio_aberto_em: 'x', tickets_abertos: 2 }))).toEqual([
      'comprou o plano',
      '2 tickets abertos',
    ])
    expect(sinaisDoScan(item({ relatorio_aberto_em: 'x' }))).toEqual(['abriu o relatório'])
  })
})

describe('somarDias', () => {
  it('vira o mês e o ano', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(somarDias('2026-12-31', 7)).toBe('2027-01-07')
  })
})

describe('paginar', () => {
  const quinze = Array.from({ length: 15 }, (_, i) => i + 1)

  it('fatia de 6 em 6 e conta de onde até onde', () => {
    expect(paginar(quinze, 1)).toMatchObject({ itens: [1, 2, 3, 4, 5, 6], pagina: 1, totalPaginas: 3, inicio: 1, fim: 6, total: 15 })
    expect(paginar(quinze, 3)).toMatchObject({ itens: [13, 14, 15], pagina: 3, inicio: 13, fim: 15 })
    expect(paginar(quinze, 2, 10).itens).toEqual([11, 12, 13, 14, 15])
  })

  it('página fora do intervalo cai na última ou na primeira — a fila encolhe sem página vazia', () => {
    expect(paginar(quinze, 9)).toMatchObject({ pagina: 3, itens: [13, 14, 15] })
    expect(paginar(quinze, 0)).toMatchObject({ pagina: 1, itens: [1, 2, 3, 4, 5, 6] })
    expect(paginar(quinze, Number.NaN).pagina).toBe(1)
    expect(paginar(quinze, 2.7).pagina).toBe(2)
  })

  it('lista vazia é uma página só, sem posições', () => {
    expect(paginar([], 4)).toEqual({ itens: [], pagina: 1, totalPaginas: 1, inicio: 0, fim: 0, total: 0 })
    expect(paginar([1, 2], 1).totalPaginas).toBe(1)
  })
})
