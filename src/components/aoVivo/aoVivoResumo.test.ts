import { describe, expect, test } from 'vitest'
import { anexarEvento, mesclarSessao } from './aoVivoData'
import {
  bandeira,
  checkoutDoParametro,
  classificarVisitante,
  filtrarPorCheckout,
  comprou,
  descreverEvento,
  duracaoDaSessao,
  funilAoVivo,
  localDaSessao,
  ordenarSessoes,
  origemDaVisita,
  presencaDaSessao,
  resumoAoVivo,
  rotuloDaEtapa,
  tempoDecorrido,
  type EventoAoVivo,
  type SessaoAoVivo,
} from './aoVivoResumo'

/** Testes das contas e rótulos do "Ao vivo" (aoVivoResumo.ts). Vitest. */

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
    navegador: 'Instagram',
    so: 'iOS',
    largura: 390,
    altura: 844,
    agente: null,
    referrer: null,
    utm: {},
    cidade: null,
    estado: null,
    pais: null,
    latitude: null,
    longitude: null,
    eventos: 3,
    updated_at: iso(10),
    ...over,
  }
}

function evento(tipo: string, dados: EventoAoVivo['dados'] = {}, id = 1): EventoAoVivo {
  return { id, sessao_id: 'a1', tipo, dados, criado_em: iso(5) }
}

describe('presencaDaSessao', () => {
  test('bateu há menos de 90 s = está na página agora (ou em outra aba)', () => {
    expect(presencaDaSessao(sessao(), AGORA)).toEqual({
      estado: 'agora',
      label: 'na página agora',
    })
    expect(presencaDaSessao(sessao({ visivel: false }), AGORA).label).toBe('em outra aba')
  })

  test('90 s a 5 min sem bater = parado; depois disso, ou com saiu, foi embora', () => {
    expect(presencaDaSessao(sessao({ ultimo_evento_em: iso(120) }), AGORA)).toEqual({
      estado: 'parada',
      label: 'parado há 2 min',
    })
    expect(presencaDaSessao(sessao({ ultimo_evento_em: iso(600) }), AGORA).estado).toBe('saiu')
    expect(
      presencaDaSessao(sessao({ encerrada_em: iso(30), ultimo_evento_em: iso(30) }), AGORA)
    ).toEqual({ estado: 'saiu', label: 'saiu há 30 s' })
  })
})

describe('classificarVisitante', () => {
  test('bot declarado pela RPC é bot; quem interagiu é pessoa', () => {
    expect(classificarVisitante(sessao({ bot: true, bot_motivo: 'agente' }))).toBe('bot')
    expect(classificarVisitante(sessao())).toBe('pessoa')
  })

  test('sem interação: pessoa nos primeiros 20 s, suspeito depois', () => {
    expect(
      classificarVisitante(
        sessao({ interagiu_em: null, iniciado_em: iso(15), ultimo_evento_em: iso(5) })
      )
    ).toBe('pessoa')
    expect(
      classificarVisitante(
        sessao({ interagiu_em: null, iniciado_em: iso(60), ultimo_evento_em: iso(5) })
      )
    ).toBe('suspeito')
  })
})

describe('rotuloDaEtapa', () => {
  test('descreve o que a pessoa faz agora, com a seção ou o campo', () => {
    expect(rotuloDaEtapa(sessao())).toBe('Acabou de chegar')
    expect(rotuloDaEtapa(sessao({ secao: 'garantia' }))).toBe('Olhando a garantia')
    expect(rotuloDaEtapa(sessao({ etapa: 'dados', foco: 'email' }))).toBe('Digitando o e-mail')
    expect(rotuloDaEtapa(sessao({ etapa: 'pagamento', foco: 'cartao' }))).toBe(
      'Digitando o cartão'
    )
    expect(rotuloDaEtapa(sessao({ etapa: 'pagamento', metodo: 'pix' }))).toBe('Escolheu Pix')
    expect(rotuloDaEtapa(sessao({ etapa: 'pix' }))).toBe('Pix aberto, esperando pagar')
    expect(rotuloDaEtapa(sessao({ etapa: 'aprovado' }))).toBe('Pagamento aprovado')
    expect(rotuloDaEtapa(sessao({ etapa: 'concluido' }))).toBe('Concluiu a compra')
  })
})

describe('origemDaVisita e localDaSessao', () => {
  test('utm manda; depois o click id; depois o referrer; sem nada é direto', () => {
    expect(origemDaVisita(null, { utm_source: 'ig', utm_medium: 'cpc' })).toBe('Meta Ads')
    expect(origemDaVisita(null, { utm_source: 'newsletter' })).toBe('Newsletter')
    expect(origemDaVisita('https://x.com/', { clid: 'facebook' })).toBe('Meta Ads')
    expect(origemDaVisita('https://l.instagram.com/?u=x', {})).toBe('Instagram')
    expect(origemDaVisita('https://scan.vertix.studio/r/abc', null)).toBe('Vertix Scan')
    expect(origemDaVisita('https://www.exemplo.com.br/blog', null)).toBe('exemplo.com.br')
    expect(origemDaVisita(null, null)).toBe('Direto')
  })

  test('cidade · UF, ou o país, ou o aviso de local desconhecido', () => {
    expect(localDaSessao(sessao({ cidade: 'São Paulo', estado: 'SP', pais: 'BR' }))).toBe(
      'São Paulo · SP'
    )
    expect(localDaSessao(sessao({ pais: 'PT' }))).toBe('Portugal')
    expect(localDaSessao(sessao())).toBe('Local não identificado')
    expect(bandeira('br')).toBe('🇧🇷')
    expect(bandeira(null)).toBe('')
  })
})

describe('resumoAoVivo e funilAoVivo', () => {
  const pedidos = new Map([['p1', { status: 'pago', total_centavos: 24400 }]])
  const lista = [
    sessao({ id: 'a' }), // na página agora, só chegou
    sessao({
      id: 'b',
      dados_em: iso(50),
      pagar_em: iso(40),
      aprovado_em: iso(30),
      pedido_id: 'p1',
      ultimo_evento_em: iso(200),
    }),
    sessao({ id: 'c', dados_em: iso(50), ultimo_evento_em: iso(400) }),
    sessao({ id: 'bot', bot: true, bot_motivo: 'agente' }),
    sessao({ id: 'susp', interagiu_em: null, iniciado_em: iso(90), ultimo_evento_em: iso(5) }),
  ]

  test('os números contam só gente', () => {
    expect(resumoAoVivo(lista, AGORA, pedidos)).toEqual({
      agora: 1,
      visitas: 3,
      compraram: 1,
      receitaCentavos: 24400,
      bots: 2,
    })
  })

  test('o funil é cumulativo: quem comprou também preencheu e clicou', () => {
    expect(funilAoVivo(lista, pedidos).map((p) => p.total)).toEqual([3, 2, 1, 1])
  })

  test('comprou pelo pedido pago mesmo sem aprovado_em (Pix confirmado depois)', () => {
    expect(comprou(sessao({ pedido_id: 'p1' }), pedidos)).toBe(true)
    expect(comprou(sessao({ pedido_id: 'p2' }), pedidos)).toBe(false)
  })

  test('ordenação: quem está na página agora vem primeiro, depois o mais recente', () => {
    const ordem = ordenarSessoes(
      [
        sessao({ id: 'velha', ultimo_evento_em: iso(300) }),
        sessao({ id: 'viva', ultimo_evento_em: iso(60) }),
        sessao({ id: 'recente', ultimo_evento_em: iso(100) }),
      ],
      AGORA
    ).map((s) => s.id)
    expect(ordem).toEqual(['viva', 'recente', 'velha'])
  })
})

describe('descreverEvento', () => {
  test('cada tipo vira uma frase de gente', () => {
    expect(
      descreverEvento(
        evento('entrou', {
          referrer: 'https://l.instagram.com/',
          dispositivo: 'celular',
          navegador: 'Instagram',
        })
      )
    ).toMatchObject({ titulo: 'Chegou · Instagram', detalhe: 'celular, Instagram', tom: 'destaque' })
    expect(descreverEvento(evento('olhou', { secao: 'pagamento' })).titulo).toBe(
      'Olhando a seção de pagamento'
    )
    expect(descreverEvento(evento('preencheu', { campo: 'email' })).titulo).toBe(
      'Preencheu o e-mail'
    )
    expect(descreverEvento(evento('bump', { marcado: true }))).toMatchObject({
      titulo: 'Marcou o order bump',
      tom: 'bom',
    })
    expect(descreverEvento(evento('cupom', { codigo: 'BF50', valido: false }))).toMatchObject({
      titulo: 'Tentou o cupom BF50',
      detalhe: 'inválido',
      tom: 'ruim',
    })
    expect(
      descreverEvento(evento('clicou_pagar', { metodo: 'pix', total_centavos: 24400 })).titulo
    ).toMatch(/Clicou em pagar R\$\s?244,00 no Pix/)
    expect(
      descreverEvento(evento('pagamento', { resultado: 'aprovado', total_centavos: 24400 }))
    ).toMatchObject({ tom: 'bom' })
    expect(
      descreverEvento(
        evento('pagamento', { resultado: 'recusado', erro: 'cc_rejected_insufficient_amount' })
      )
    ).toMatchObject({
      titulo: 'Pagamento recusado',
      detalhe: 'cc_rejected_insufficient_amount',
      tom: 'ruim',
    })
    expect(descreverEvento(evento('pix', { acao: 'copiou' })).titulo).toBe('Copiou o código Pix')
    expect(
      descreverEvento(evento('upsell', { acao: 'aceitou', etapa: 'downsell', total_centavos: 9700 }))
        .titulo
    ).toMatch(/Aceitou o downsell · R\$\s?97,00/)
    expect(descreverEvento(evento('aba', { visivel: false })).titulo).toBe('Saiu da aba')
    expect(descreverEvento(evento('saiu')).titulo).toBe('Fechou a página')
    expect(descreverEvento(evento('desconhecido')).titulo).toBe('desconhecido')
  })
})

describe('tempo', () => {
  test('tempoDecorrido e duração da sessão', () => {
    expect(tempoDecorrido(iso(8), AGORA)).toBe('8 s')
    expect(tempoDecorrido(iso(190), AGORA)).toBe('3 min')
    expect(tempoDecorrido(iso(4320), AGORA)).toBe('1 h 12 min')
    expect(tempoDecorrido(iso(7200), AGORA)).toBe('2 h')
    // Viva: conta até agora. Parada: conta até o último sinal.
    expect(duracaoDaSessao(sessao(), AGORA)).toBe('2 min')
    expect(
      duracaoDaSessao(sessao({ iniciado_em: iso(600), ultimo_evento_em: iso(400) }), AGORA)
    ).toBe('3 min')
  })
})

describe('filtro por checkout', () => {
  const checkouts = [
    { id: 'c1', slug: 'plano', titulo: 'Plano' },
    { id: 'c2', slug: 'mentoria', titulo: 'Mentoria' },
  ]

  test('filtrarPorCheckout: só as visitas daquele checkout; null é tudo', () => {
    const lista = [sessao({ id: 'a', checkout_id: 'c1' }), sessao({ id: 'b', checkout_id: 'c2' })]
    expect(filtrarPorCheckout(lista, 'c2').map((s) => s.id)).toEqual(['b'])
    expect(filtrarPorCheckout(lista, null)).toBe(lista)
  })

  test('checkoutDoParametro: slug da URL vira o checkout; desconhecido ou vazio é sem filtro', () => {
    expect(checkoutDoParametro('mentoria', checkouts)?.id).toBe('c2')
    expect(checkoutDoParametro('nao-existe', checkouts)).toBeNull()
    expect(checkoutDoParametro(null, checkouts)).toBeNull()
  })
})

describe('cache: mesclarSessao e anexarEvento', () => {
  test('sessão nova entra no topo; existente é substituída no lugar', () => {
    const lista = [sessao({ id: 'a' }), sessao({ id: 'b' })]
    expect(mesclarSessao(lista, sessao({ id: 'c' })).map((s) => s.id)).toEqual(['c', 'a', 'b'])
    const trocada = mesclarSessao(lista, sessao({ id: 'b', etapa: 'pix' }))
    expect(trocada.map((s) => s.id)).toEqual(['a', 'b'])
    expect(trocada[1].etapa).toBe('pix')
  })

  test('evento repetido (fetch cruzou com o Realtime) não duplica', () => {
    const lista = [evento('entrou', {}, 1)]
    expect(anexarEvento(lista, evento('olhou', {}, 2))).toHaveLength(2)
    expect(anexarEvento(lista, evento('entrou', {}, 1))).toHaveLength(1)
  })
})
