import { describe, expect, test } from 'vitest'
import type { SessaoAoVivo } from '../aoVivoResumo'
import { agruparPorLocal, marcadoresDasSessoes, sementeDoId } from './locais'

/** Testes do que o mapa e "Sessões por local" tiram das sessões (locais.ts). */

const AGORA = new Date('2026-09-14T15:00:00Z')
const iso = (segundosAtras: number) =>
  new Date(AGORA.getTime() - segundosAtras * 1000).toISOString()

function sessao(over: Partial<SessaoAoVivo> = {}): SessaoAoVivo {
  return {
    id: 'a1',
    checkout_id: 'c1',
    visitante_id: null,
    iniciado_em: iso(120),
    ultimo_evento_em: iso(10),
    encerrada_em: null,
    visivel: true,
    etapa: 'chegou',
    secao: null,
    foco: null,
    dados_em: null,
    pagar_em: null,
    pagamento_em: null,
    aprovado_em: null,
    obrigado_em: null,
    interagiu_em: iso(100),
    bot: false,
    bot_motivo: null,
    nome: null,
    email: null,
    whatsapp: null,
    documento_preenchido: false,
    metodo: null,
    bump: false,
    cupom: null,
    total_centavos: null,
    pedido_id: null,
    dispositivo: 'celular',
    navegador: 'Safari',
    so: 'iOS',
    largura: 390,
    altura: 844,
    agente: null,
    referrer: null,
    utm: {},
    cidade: 'Curitiba',
    estado: 'PR',
    pais: 'BR',
    latitude: -25.43,
    longitude: -49.27,
    eventos: 3,
    updated_at: iso(10),
    ...over,
  }
}

const pedidos = new Map([['p1', { status: 'pago', total_centavos: 24400 }]])

describe('marcadoresDasSessoes', () => {
  test('agora, pedido e passado — só gente com coordenada', () => {
    const lista = [
      sessao({ id: 'viva', nome: 'Maria' }),
      sessao({ id: 'comprou', pedido_id: 'p1', ultimo_evento_em: iso(900) }),
      sessao({ id: 'foi', ultimo_evento_em: iso(900), email: 'x@y.z' }),
      sessao({ id: 'bot', bot: true }),
      sessao({ id: 'sem-coord', latitude: null, longitude: null }),
    ]
    const marcadores = marcadoresDasSessoes(lista, pedidos, AGORA)
    expect(marcadores.map((m) => [m.id, m.tipo])).toEqual([
      ['viva', 'agora'],
      ['comprou', 'pedido'],
      ['foi', 'passado'],
    ])
    expect(marcadores[0].rotulo).toBe('Maria · Curitiba · PR')
    expect(marcadores[2].rotulo).toBe('x@y.z · Curitiba · PR')
    expect(marcadores[0].semente).toBeGreaterThanOrEqual(0)
    expect(marcadores[0].semente).toBeLessThan(1)
  })

  test('a semente é determinística por id', () => {
    expect(sementeDoId('abc')).toBe(sementeDoId('abc'))
    expect(sementeDoId('abc')).not.toBe(sementeDoId('abd'))
  })
})

describe('agruparPorLocal', () => {
  test('uma linha por lugar, mais visitas primeiro, com agora/compraram e coordenada média', () => {
    const lista = [
      sessao({ id: 'a' }),
      sessao({ id: 'b', latitude: -25.5, longitude: -49.3, ultimo_evento_em: iso(900) }),
      sessao({
        id: 'c',
        cidade: 'Recife',
        estado: 'PE',
        latitude: -8.05,
        longitude: -34.9,
        pedido_id: 'p1',
      }),
      sessao({ id: 'bot', bot: true }),
      sessao({ id: 'sem-local', cidade: null, estado: null, pais: null }),
    ]
    const locais = agruparPorLocal(lista, pedidos, AGORA)
    expect(locais.map((l) => [l.rotulo, l.total, l.agora, l.compraram])).toEqual([
      ['Curitiba · PR', 2, 1, 0],
      ['Recife · PE', 1, 1, 1],
    ])
    expect(locais[0].ids).toEqual(['a', 'b'])
    expect(locais[0].lat).toBeCloseTo(-25.465, 3)
    expect(locais[0].lng).toBeCloseTo(-49.285, 3)
    expect(locais[0].pais).toBe('BR')
  })

  test('sem cidade nem UF, o país vira o lugar', () => {
    const locais = agruparPorLocal(
      [sessao({ cidade: null, estado: null, pais: 'PT' })],
      pedidos,
      AGORA
    )
    expect(locais[0].rotulo).toBe('Portugal')
  })
})
