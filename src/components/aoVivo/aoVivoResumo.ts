import { formatBRL } from '../../lib/commercial'
import type { Database } from '../../lib/database.types'

/**
 * Contas e rótulos do "Ao vivo" do checkout. Funções PURAS — sem rede, sem
 * React —, testadas em aoVivoResumo.test.ts e usadas por AoVivoTab,
 * SessaoLinha e SessaoDetalhe.
 *
 * A linha de `checkout_sessoes` já traz o estado atual (a RPC decide); aqui
 * só traduzimos para gente: "Digitando o cartão", "Pix aberto, esperando
 * pagar", "São Paulo · SP", "chegou pelo Instagram".
 */

export type SessaoAoVivo = Database['public']['Tables']['checkout_sessoes']['Row']
export type EventoAoVivo = Database['public']['Tables']['checkout_eventos']['Row']

/** O que o painel precisa saber do pedido ligado à sessão. */
export interface PedidoDaSessao {
  status: string
  total_centavos: number
}

// ---------------------------------------------------------------------------
// Presença: está aqui agora?
// ---------------------------------------------------------------------------

/** O navegador bate a cada 25 s; três batidas perdidas = parou. */
export const PRESENCA_AGORA_MS = 90_000
/** Depois disso, sem 'saiu' explícito, consideramos que foi embora. */
export const PRESENCA_PARADA_MS = 5 * 60_000

export type EstadoPresenca = 'agora' | 'parada' | 'saiu'

export interface Presenca {
  estado: EstadoPresenca
  label: string
}

export function presencaDaSessao(s: SessaoAoVivo, agora: Date): Presenca {
  const ultimo = new Date(s.ultimo_evento_em).getTime()
  const silencio = agora.getTime() - ultimo
  if (s.encerrada_em || silencio >= PRESENCA_PARADA_MS) {
    return {
      estado: 'saiu',
      label: `saiu há ${tempoDecorrido(s.encerrada_em ?? s.ultimo_evento_em, agora)}`,
    }
  }
  if (silencio >= PRESENCA_AGORA_MS) {
    return { estado: 'parada', label: `parado há ${tempoDecorrido(s.ultimo_evento_em, agora)}` }
  }
  return { estado: 'agora', label: s.visivel ? 'na página agora' : 'em outra aba' }
}

// ---------------------------------------------------------------------------
// Gente ou bot
// ---------------------------------------------------------------------------

/** Sessão viva há mais que isto sem um toque, rolagem ou tecla não é gente. */
export const SEM_INTERACAO_MS = 20_000

export type TipoVisitante = 'pessoa' | 'bot' | 'suspeito'

/**
 * A RPC marca os bots declarados (agente de crawler/preview, webdriver). O
 * sinal comportamental fecha o resto: preview do WhatsApp e crawler do Meta
 * carregam a página, nunca interagem. Uma pessoa que acabou de chegar ainda
 * não teve tempo de interagir — por isso a janela de 20 s.
 */
export function classificarVisitante(s: SessaoAoVivo): TipoVisitante {
  if (s.bot) return 'bot'
  if (s.interagiu_em) return 'pessoa'
  const atividade =
    new Date(s.ultimo_evento_em).getTime() - new Date(s.iniciado_em).getTime()
  return atividade >= SEM_INTERACAO_MS ? 'suspeito' : 'pessoa'
}

export function motivoDoBot(s: SessaoAoVivo): string {
  switch (s.bot_motivo) {
    case 'webdriver':
      return 'navegador automatizado'
    case 'agente':
      return 'agente de crawler ou preview de link'
    case 'sem_agente':
      return 'sem identificação de navegador'
    case 'sem_idioma':
      return 'navegador sem idioma'
    default:
      return s.bot ? 'classificado como bot' : 'nenhuma interação humana'
  }
}

// ---------------------------------------------------------------------------
// Onde está e o que está fazendo
// ---------------------------------------------------------------------------

export interface SecaoDoCheckout {
  id: string
  label: string
  /** "Olhando o resumo do pedido" — com artigo, para a frase sair natural. */
  frase: string
}

/** As seções da página, na ordem em que aparecem (data-secao no CheckoutPage). */
export const SECOES: readonly SecaoDoCheckout[] = [
  { id: 'resumo', label: 'Resumo do pedido', frase: 'o resumo do pedido' },
  { id: 'bump', label: 'Order bump', frase: 'o order bump' },
  { id: 'cupom', label: 'Cupom', frase: 'o campo de cupom' },
  { id: 'dados', label: 'Seus dados', frase: 'o formulário de dados' },
  { id: 'pagamento', label: 'Pagamento', frase: 'a seção de pagamento' },
  { id: 'garantia', label: 'Garantia', frase: 'a garantia' },
  { id: 'avaliacoes', label: 'Avaliações', frase: 'as avaliações' },
  { id: 'selos', label: 'Selos', frase: 'os selos de segurança' },
]

/** A cópia de celular das avaliações tem outro data-secao; é a mesma coisa. */
export function secaoNormalizada(secao: string | null): string | null {
  if (!secao) return null
  return secao === 'avaliacoes-celular' ? 'avaliacoes' : secao
}

export function fraseDaSecao(secao: string | null): string | null {
  const id = secaoNormalizada(secao)
  return SECOES.find((s) => s.id === id)?.frase ?? null
}

const CAMPO: Record<string, string> = {
  nome: 'o nome',
  email: 'o e-mail',
  whatsapp: 'o WhatsApp',
  documento: 'o CPF/CNPJ',
  cartao: 'o cartão',
}

/** O que a pessoa está fazendo AGORA, em uma linha. */
export function rotuloDaEtapa(s: SessaoAoVivo): string {
  switch (s.etapa) {
    case 'concluido':
      return 'Concluiu a compra'
    case 'upsell_aceito':
      return 'Aceitou o upsell'
    case 'upsell':
      return 'Vendo a oferta de upsell'
    case 'aprovado':
      return 'Pagamento aprovado'
    case 'analise':
      return 'Pagamento em análise'
    case 'recusado':
      return 'Pagamento recusado'
    case 'pix':
      return 'Pix aberto, esperando pagar'
    case 'pagando':
      return 'Clicou em pagar'
    case 'pagamento':
      if (s.foco === 'cartao') return 'Digitando o cartão'
      return s.metodo === 'pix' ? 'Escolheu Pix' : 'Escolhendo o pagamento'
    case 'dados':
      return s.foco && CAMPO[s.foco] ? `Digitando ${CAMPO[s.foco]}` : 'Preenchendo os dados'
    default: {
      const frase = fraseDaSecao(s.secao)
      return frase ? `Olhando ${frase}` : 'Acabou de chegar'
    }
  }
}

/** Ordem do funil, para saber "até onde chegou". */
const ORDEM_ETAPA: Record<string, number> = {
  chegou: 0,
  dados: 1,
  pagamento: 2,
  pagando: 3,
  recusado: 3,
  pix: 4,
  analise: 4,
  aprovado: 5,
  upsell: 6,
  upsell_aceito: 7,
  concluido: 8,
}

export function pesoDaEtapa(etapa: string): number {
  return ORDEM_ETAPA[etapa] ?? 0
}

// ---------------------------------------------------------------------------
// De onde veio
// ---------------------------------------------------------------------------

const FONTES: Array<[RegExp, string]> = [
  [/instagram|^ig$/, 'Instagram'],
  [/facebook|fb\.me|^fb$|^meta$/, 'Facebook'],
  [/whatsapp|^wa$/, 'WhatsApp'],
  [/tiktok/, 'TikTok'],
  [/youtube|youtu\.be/, 'YouTube'],
  [/google/, 'Google'],
  [/twitter|t\.co|^x\.com$/, 'X'],
  [/linkedin/, 'LinkedIn'],
  [/^e-?mail$|mail\./, 'E-mail'],
  [/scan\.vertix|^scan$/, 'Vertix Scan'],
  [/vertix/, 'Site Vertix'],
]

function nomeDaFonte(texto: string): string | null {
  const t = texto.toLowerCase()
  return FONTES.find(([re]) => re.test(t))?.[1] ?? null
}

/** "Instagram", "Meta Ads", "Direto", ou o domínio de onde veio. */
export function origemDaVisita(
  referrer: string | null,
  utm: Record<string, unknown> | null
): string {
  const source = typeof utm?.utm_source === 'string' ? utm.utm_source : ''
  const medium = typeof utm?.utm_medium === 'string' ? utm.utm_medium.toLowerCase() : ''
  const clid = typeof utm?.clid === 'string' ? utm.clid : ''
  const pago = /cpc|paid|ads/.test(medium)

  if (source) {
    const nome = nomeDaFonte(source) ?? source.charAt(0).toUpperCase() + source.slice(1)
    if (pago || clid) {
      return nome === 'Facebook' || nome === 'Instagram' ? 'Meta Ads' : `${nome} (anúncio)`
    }
    return nome
  }
  if (clid === 'facebook') return 'Meta Ads'
  if (clid === 'google') return 'Google Ads'
  if (clid === 'tiktok') return 'TikTok Ads'

  if (!referrer) return 'Direto'
  let host = referrer
  try {
    host = new URL(referrer).hostname
  } catch {
    // referrer sem esquema: fica o texto
  }
  return nomeDaFonte(host) ?? host.replace(/^www\./, '')
}

// ---------------------------------------------------------------------------
// Onde a pessoa está (no mundo)
// ---------------------------------------------------------------------------

const PAISES: Record<string, string> = {
  BR: 'Brasil',
  PT: 'Portugal',
  US: 'Estados Unidos',
  AR: 'Argentina',
  ES: 'Espanha',
  FR: 'França',
  DE: 'Alemanha',
  IT: 'Itália',
  GB: 'Reino Unido',
  MX: 'México',
  CL: 'Chile',
  CO: 'Colômbia',
  PY: 'Paraguai',
  UY: 'Uruguai',
}

export function nomeDoPais(codigo: string | null): string | null {
  if (!codigo) return null
  return PAISES[codigo.toUpperCase()] ?? codigo.toUpperCase()
}

/** "BR" → 🇧🇷 (dois indicadores regionais). Vazio sem país. */
export function bandeira(codigo: string | null): string {
  if (!codigo || !/^[A-Za-z]{2}$/.test(codigo)) return ''
  return String.fromCodePoint(
    ...codigo.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

export function localDaSessao(s: SessaoAoVivo): string {
  // "Lisboa · Lisboa" não ajuda ninguém: fora do Brasil a região costuma
  // repetir a cidade.
  if (s.cidade && s.estado && s.estado !== s.cidade) return `${s.cidade} · ${s.estado}`
  if (s.cidade) return s.cidade
  return nomeDoPais(s.pais) ?? 'Local não identificado'
}

// ---------------------------------------------------------------------------
// Números do topo e funil
// ---------------------------------------------------------------------------

export function pedidoPago(pedido: PedidoDaSessao | undefined): boolean {
  return pedido?.status === 'pago' || pedido?.status === 'reembolsado'
}

export function comprou(
  s: SessaoAoVivo,
  pedidos: ReadonlyMap<string, PedidoDaSessao>
): boolean {
  if (s.aprovado_em || s.obrigado_em) return true
  return Boolean(s.pedido_id && pedidoPago(pedidos.get(s.pedido_id)))
}

export interface ResumoAoVivo {
  /** Pessoas na página nos últimos 90 s. */
  agora: number
  /** Visitas de gente no período carregado. */
  visitas: number
  compraram: number
  receitaCentavos: number
  bots: number
}

export function resumoAoVivo(
  sessoes: readonly SessaoAoVivo[],
  agora: Date,
  pedidos: ReadonlyMap<string, PedidoDaSessao>
): ResumoAoVivo {
  return sessoes.reduce<ResumoAoVivo>(
    (acc, s) => {
      if (classificarVisitante(s) !== 'pessoa') return { ...acc, bots: acc.bots + 1 }
      const pedido = s.pedido_id ? pedidos.get(s.pedido_id) : undefined
      const venda = comprou(s, pedidos)
      return {
        agora: acc.agora + (presencaDaSessao(s, agora).estado === 'agora' ? 1 : 0),
        visitas: acc.visitas + 1,
        compraram: acc.compraram + (venda ? 1 : 0),
        receitaCentavos:
          acc.receitaCentavos + (venda && pedido ? pedido.total_centavos : 0),
        bots: acc.bots,
      }
    },
    { agora: 0, visitas: 0, compraram: 0, receitaCentavos: 0, bots: 0 }
  )
}

export interface PassoDoFunil {
  id: 'chegaram' | 'dados' | 'pagar' | 'compraram'
  label: string
  total: number
}

/** Só gente. Cada passo conta quem chegou PELO MENOS até ali. */
export function funilAoVivo(
  sessoes: readonly SessaoAoVivo[],
  pedidos: ReadonlyMap<string, PedidoDaSessao>
): PassoDoFunil[] {
  const pessoas = sessoes.filter((s) => classificarVisitante(s) === 'pessoa')
  const compraramTotal = pessoas.filter((s) => comprou(s, pedidos)).length
  return [
    { id: 'chegaram', label: 'Chegaram', total: pessoas.length },
    {
      id: 'dados',
      label: 'Preencheram dados',
      total: pessoas.filter((s) => s.dados_em || s.pagar_em || comprou(s, pedidos)).length,
    },
    {
      id: 'pagar',
      label: 'Clicaram em pagar',
      total: pessoas.filter((s) => s.pagar_em || comprou(s, pedidos)).length,
    },
    { id: 'compraram', label: 'Compraram', total: compraramTotal },
  ]
}

/** Só as visitas de um checkout; sem filtro (null) devolve a lista como está. */
export function filtrarPorCheckout(
  sessoes: readonly SessaoAoVivo[],
  checkoutId: string | null
): readonly SessaoAoVivo[] {
  return checkoutId ? sessoes.filter((s) => s.checkout_id === checkoutId) : sessoes
}

/** Um checkout da lista do painel, no que o "Ao vivo" precisa. */
export interface CheckoutDoAoVivo {
  id: string
  slug: string
  titulo: string
}

/** O checkout apontado pelo `?checkout=<slug>` da URL; slug desconhecido = sem filtro. */
export function checkoutDoParametro(
  slug: string | null,
  checkouts: readonly CheckoutDoAoVivo[]
): CheckoutDoAoVivo | null {
  if (!slug) return null
  return checkouts.find((c) => c.slug === slug) ?? null
}

/** Mais recente primeiro; quem está na página agora vai para o topo. */
export function ordenarSessoes(
  sessoes: readonly SessaoAoVivo[],
  agora: Date
): SessaoAoVivo[] {
  const peso = (s: SessaoAoVivo) => (presencaDaSessao(s, agora).estado === 'agora' ? 1 : 0)
  return [...sessoes].sort(
    (a, b) =>
      peso(b) - peso(a) ||
      new Date(b.ultimo_evento_em).getTime() - new Date(a.ultimo_evento_em).getTime()
  )
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

export type TomDoEvento = 'neutro' | 'bom' | 'ruim' | 'destaque'

export interface EventoDescrito {
  titulo: string
  detalhe: string | null
  tom: TomDoEvento
}

function texto(dados: Record<string, unknown>, chave: string): string | null {
  const v = dados[chave]
  return typeof v === 'string' && v ? v : null
}

function centavos(dados: Record<string, unknown>): string | null {
  const v = dados.total_centavos
  return typeof v === 'number' ? formatBRL(v / 100) : null
}

export function descreverEvento(e: EventoAoVivo): EventoDescrito {
  const d = (
    e.dados && typeof e.dados === 'object' && !Array.isArray(e.dados) ? e.dados : {}
  ) as Record<string, unknown>
  const neutro = (titulo: string, detalhe: string | null = null): EventoDescrito => ({
    titulo,
    detalhe,
    tom: 'neutro',
  })

  switch (e.tipo) {
    case 'entrou': {
      const origem = origemDaVisita(
        texto(d, 'referrer'),
        (d.utm as Record<string, unknown> | undefined) ?? null
      )
      const como = [texto(d, 'dispositivo'), texto(d, 'navegador')].filter(Boolean).join(', ')
      return { titulo: `Chegou · ${origem}`, detalhe: como || null, tom: 'destaque' }
    }
    case 'olhou': {
      const frase = fraseDaSecao(texto(d, 'secao'))
      return neutro(frase ? `Olhando ${frase}` : 'Olhando a página')
    }
    case 'interagiu':
      return neutro(`Primeiro sinal humano (${texto(d, 'tipo_interacao') ?? 'toque'})`)
    case 'digitando': {
      const campo = texto(d, 'campo')
      return neutro(campo && CAMPO[campo] ? `Começou a digitar ${CAMPO[campo]}` : 'Começou a digitar')
    }
    case 'preencheu': {
      const campo = texto(d, 'campo')
      return neutro(campo && CAMPO[campo] ? `Preencheu ${CAMPO[campo]}` : 'Preencheu um campo')
    }
    case 'bump':
      return d.marcado === true
        ? { titulo: 'Marcou o order bump', detalhe: null, tom: 'bom' }
        : neutro('Desmarcou o order bump')
    case 'cupom': {
      const codigo = texto(d, 'codigo')
      if (texto(d, 'acao') === 'removeu') {
        return neutro(`Removeu o cupom${codigo ? ` ${codigo}` : ''}`)
      }
      return d.valido === true
        ? { titulo: `Aplicou o cupom ${codigo ?? ''}`.trim(), detalhe: null, tom: 'bom' }
        : { titulo: `Tentou o cupom ${codigo ?? ''}`.trim(), detalhe: 'inválido', tom: 'ruim' }
    }
    case 'metodo':
      return neutro(
        texto(d, 'metodo') === 'pix' ? 'Escolheu pagar com Pix' : 'Escolheu pagar com cartão'
      )
    case 'clicou_pagar': {
      const valor = centavos(d)
      const metodo = texto(d, 'metodo') === 'pix' ? 'no Pix' : 'no cartão'
      return {
        titulo: `Clicou em pagar${valor ? ` ${valor}` : ''} ${metodo}`,
        detalhe: null,
        tom: 'destaque',
      }
    }
    case 'pagamento': {
      const valor = centavos(d)
      switch (texto(d, 'resultado')) {
        case 'aprovado':
          return { titulo: `Pagamento aprovado${valor ? ` · ${valor}` : ''}`, detalhe: null, tom: 'bom' }
        case 'pix_gerado':
          return {
            titulo: `Pix gerado${valor ? ` · ${valor}` : ''}`,
            detalhe: 'esperando o pagamento',
            tom: 'destaque',
          }
        case 'pendente':
          return neutro('Pagamento em análise no banco')
        case 'falha':
          return { titulo: 'Não conseguiu falar com o servidor de pagamento', detalhe: null, tom: 'ruim' }
        default:
          return { titulo: 'Pagamento recusado', detalhe: texto(d, 'erro'), tom: 'ruim' }
      }
    }
    case 'pix':
      switch (texto(d, 'acao')) {
        case 'copiou':
          return { titulo: 'Copiou o código Pix', detalhe: null, tom: 'bom' }
        case 'fechou':
          return neutro('Fechou o Pix')
        default:
          return neutro('Abriu o QR do Pix')
      }
    case 'upsell': {
      const oferta = texto(d, 'etapa') === 'downsell' ? 'o downsell' : 'o upsell'
      const valor = centavos(d)
      switch (texto(d, 'acao')) {
        case 'aceitou':
          return { titulo: `Aceitou ${oferta}${valor ? ` · ${valor}` : ''}`, detalhe: null, tom: 'bom' }
        case 'recusou':
          return neutro(`Recusou ${oferta}`)
        case 'erro':
          return { titulo: `Falhou ao aceitar ${oferta}`, detalhe: texto(d, 'erro'), tom: 'ruim' }
        default:
          return neutro(`Viu ${oferta}`)
      }
    }
    case 'obrigado':
      return { titulo: 'Chegou à confirmação do pedido', detalhe: null, tom: 'bom' }
    case 'aba':
      return neutro(d.visivel === false ? 'Saiu da aba' : 'Voltou para a aba')
    case 'erro':
      return {
        titulo:
          texto(d, 'erro') === 'dados_invalidos'
            ? 'Tentou pagar com dados faltando'
            : 'Erro na página',
        detalhe: texto(d, 'mensagem'),
        tom: 'ruim',
      }
    case 'saiu':
      return neutro('Fechou a página')
    default:
      return neutro(e.tipo)
  }
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** "8 s", "3 min", "1 h 12 min" — entre um instante e outro. */
export function tempoDecorrido(deIso: string, ate: Date): string {
  const ms = Math.max(0, ate.getTime() - new Date(deIso).getTime())
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h} h ${resto} min` : `${h} h`
}

/** Quanto tempo a visita durou (ou dura, se ainda está na página). */
export function duracaoDaSessao(s: SessaoAoVivo, agora: Date): string {
  const fim =
    presencaDaSessao(s, agora).estado === 'agora' ? agora : new Date(s.ultimo_evento_em)
  return tempoDecorrido(s.iniciado_em, fim)
}

export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatCentavos(centavos: number): string {
  return formatBRL(centavos / 100)
}
