import { describe, expect, test } from 'vitest'
import {
  agruparPorEvento, contextoSemMigalhas, filtrar, filtrosParaBusca, haQuanto, lerFiltros,
  mesclar, migalhasDe, relacionadas, resumo, slugDoCheckout, FILTROS_PADRAO, type LinhaDeLog,
} from './logs'

const agora = new Date('2026-09-14T12:00:00Z')
const iso = (minAtras: number) => new Date(agora.getTime() - minAtras * 60_000).toISOString()

let seq = 0
function linha(over: Partial<LinhaDeLog> = {}): LinhaDeLog {
  seq += 1
  return {
    id: seq, criado_em: iso(5), ultima_em: iso(5), ocorrencias: 1, nivel: 'erro', origem: 'navegador',
    fonte: 'CheckoutPage', evento: 'render_quebrou', mensagem: 'TypeError: x', detalhes: {}, contexto: {},
    requisicao_id: null, sessao_id: null, usuario_id: null, versao: 'abc', impressao: 'h' + seq,
    ...over,
  }
}

describe('filtros ↔ URL', () => {
  test('lê níveis, origem, fonte, período e busca; ignora lixo', () => {
    const f = lerFiltros(new URLSearchParams('nivel=fatal,erro,xx&origem=edge&fonte=checkout-pagar&periodo=7d&q=mp'))
    expect(f).toEqual({ niveis: ['fatal', 'erro'], origem: 'edge', fonte: 'checkout-pagar', periodo: '7d', busca: 'mp' })
    expect(lerFiltros(new URLSearchParams('nivel=zz&origem=marte'))).toEqual(FILTROS_PADRAO)
  })
  test('escreve só o que difere do padrão', () => {
    expect(filtrosParaBusca(FILTROS_PADRAO).toString()).toBe('')
    expect(filtrosParaBusca({ ...FILTROS_PADRAO, fonte: 'x', periodo: '1h' }).toString()).toBe('fonte=x&periodo=1h')
  })
})

describe('filtrar', () => {
  test('nível, origem, fonte, período e busca em mensagem/evento/ids', () => {
    const linhas = [
      linha({ nivel: 'info' }),
      linha({ origem: 'edge', fonte: 'checkout-pagar', mensagem: 'MP recusou', requisicao_id: 'req-1' }),
      linha({ ultima_em: iso(60 * 30) }),
      linha({ evento: 'chunk_sumiu' }),
    ]
    expect(filtrar(linhas, FILTROS_PADRAO, agora).map((l) => l.id)).toEqual([linhas[1].id, linhas[3].id])
    expect(filtrar(linhas, { ...FILTROS_PADRAO, origem: 'edge' }, agora)).toHaveLength(1)
    expect(filtrar(linhas, { ...FILTROS_PADRAO, busca: 'REQ-1' }, agora)).toHaveLength(1)
    expect(filtrar(linhas, { ...FILTROS_PADRAO, busca: 'chunk' }, agora)).toHaveLength(1)
    expect(filtrar(linhas, { ...FILTROS_PADRAO, periodo: 'tudo', niveis: ['erro', 'info'] }, agora)).toHaveLength(4)
  })
})

describe('mesclar', () => {
  test('substitui pela id, mantém ordem por ultima_em desc e o teto', () => {
    const a = linha({ ultima_em: iso(10) })
    const b = linha({ ultima_em: iso(1) })
    const bNovo = { ...b, ocorrencias: 5, ultima_em: iso(0) }
    const r = mesclar([b, a], bNovo)
    expect(r.map((l) => [l.id, l.ocorrencias])).toEqual([[b.id, 5], [a.id, 1]])
  })
})

describe('agruparPorEvento e resumo', () => {
  test('soma ocorrências por fonte+evento, pior nível vence, mais frequente primeiro', () => {
    const g = agruparPorEvento([
      linha({ ocorrencias: 3 }), linha({ ocorrencias: 4, nivel: 'fatal' }),
      linha({ fonte: 'checkout-pagar', evento: 'mp_falhou', ocorrencias: 2 }),
    ])
    expect(g.map((x) => [x.fonte, x.evento, x.nivel, x.ocorrencias, x.linhas])).toEqual([
      ['CheckoutPage', 'render_quebrou', 'fatal', 7, 2],
      ['checkout-pagar', 'mp_falhou', 'erro', 2, 1],
    ])
  })
  test('resumo conta ocorrências por nível e fontes com erro', () => {
    expect(resumo([
      { nivel: 'erro', fonte: 'a', ocorrencias: 3 }, { nivel: 'fatal', fonte: 'b', ocorrencias: 1 },
      { nivel: 'aviso', fonte: 'a', ocorrencias: 10 }, { nivel: 'info', fonte: 'c', ocorrencias: 100 },
    ])).toEqual({ erros: 3, fatais: 1, avisos: 10, fontesComErro: 2 })
  })
})

describe('detalhe', () => {
  test('relacionadas: mesma requisição ou mesma sessão, sem ela mesma', () => {
    const alvo = linha({ requisicao_id: 'r1', sessao_id: 's1' })
    const outras = [linha({ requisicao_id: 'r1' }), linha({ sessao_id: 's1' }), linha({ requisicao_id: 'r2' })]
    expect(relacionadas([alvo, ...outras], alvo).map((l) => l.id)).toEqual([outras[0].id, outras[1].id])
  })
  test('slugDoCheckout e migalhas do contexto', () => {
    expect(slugDoCheckout({ rota: '/c/plano-correcao?a=1' })).toBe('plano-correcao')
    expect(slugDoCheckout({ rota: '/admin/logs' })).toBeNull()
    expect(slugDoCheckout('x')).toBeNull()
    expect(migalhasDe({ migalhas: [{ t: 1, tipo: 'clique', texto: 'button: Pagar', dados: { x: 1 } }, 'lixo', { t: 'x' }] })).toEqual([
      { t: 1, tipo: 'clique', texto: 'button: Pagar', dados: { x: 1 } }, { t: 0, tipo: 'outro', texto: '' },
    ])
    expect(contextoSemMigalhas({ rota: '/x', migalhas: [] })).toEqual({ rota: '/x' })
  })
  test('haQuanto', () => {
    expect(haQuanto(iso(0), agora)).toBe('agora')
    expect(haQuanto(iso(3), agora)).toBe('há 3 min')
    expect(haQuanto(iso(60 * 5), agora)).toBe('há 5 h')
    expect(haQuanto(iso(60 * 24 * 3), agora)).toBe('há 3 dias')
  })
})
