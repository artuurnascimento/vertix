import { z } from 'zod'

/**
 * Deck de apresentação da proposta (proposals.apresentacao jsonb).
 * Validação na fronteira: shape inválido vira null e a página pública cai no
 * layout clássico — nunca quebra o link do cliente. Mesmo padrão de
 * proposalData.ts.
 *
 * Nos títulos, os tokens "✱" e "()" são substituídos pelos glifos da marca
 * pelo renderer (PropostaDeck).
 */

const statSchema = z.object({
  valor: z.string(),
  legenda: z.string(),
})

const cardSchema = z.object({
  titulo: z.string(),
  texto: z.string(),
  /** Número/valor grande no rodapé do card (ex.: "8 etapas"). */
  destaque: z.string().optional(),
})

const barraSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
  /** Largura da barra em % (0–100). */
  pct: z.number().min(0).max(100),
  cor: z.enum(['dark', 'accent']).catch('dark'),
})

const passoSchema = z.object({
  titulo: z.string(),
  texto: z.string(),
})

/** Superfície do slide; cada tipo tem um default coerente com o template. */
const superficieSchema = z.enum(['violeta', 'escuro', 'claro'])

/** Cue de legenda sincronizada: [início, fim] em ms do MP3 + trecho falado. */
const legendaCueSchema = z.object({
  i: z.number(),
  f: z.number(),
  t: z.string(),
})

export type LegendaCue = z.infer<typeof legendaCueSchema>

const baseSlide = {
  tag: z.string(),
  titulo: z.string(),
  intro: z.string().optional(),
  superficie: superficieSchema.optional(),
  /** Roteiro falado do modo apresentação; sem ele, a narração é derivada. */
  narracao: z.string().optional(),
  /** MP3 pré-gerado (voz neural) — quando existe, toca em vez do sintetizador. */
  narracaoAudio: z.string().optional(),
  /** Legenda sincronizada palavra-a-palavra do MP3 (gerada junto com ele). */
  narracaoLegenda: z.array(legendaCueSchema).optional(),
}

const slideSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('capa'),
    titulo: z.string(),
    subtitulo: z.string(),
    narracao: z.string().optional(),
    narracaoAudio: z.string().optional(),
    narracaoLegenda: z.array(legendaCueSchema).optional(),
  }),
  z.object({
    ...baseSlide,
    tipo: z.literal('texto'),
    paragrafos: z.array(z.string()).catch([]),
    stat: statSchema.optional(),
    cards: z.array(cardSchema).optional(),
  }),
  z.object({
    ...baseSlide,
    tipo: z.literal('grafico'),
    barras: z.array(barraSchema),
    fonte: z.string().optional(),
    fluxo: z.array(statSchema).optional(),
    destaque: z.string().optional(),
  }),
  z.object({
    ...baseSlide,
    tipo: z.literal('cards'),
    cards: z.array(cardSchema),
    rodape: z.string().optional(),
  }),
  z.object({
    ...baseSlide,
    tipo: z.literal('modulos'),
    modulos: z.array(passoSchema),
  }),
  z.object({
    ...baseSlide,
    tipo: z.literal('listas'),
    colunas: z.array(z.object({ titulo: z.string(), itens: z.array(z.string()) })),
    destaque: z.string().optional(),
  }),
  z.object({
    ...baseSlide,
    tipo: z.literal('investimento'),
    /** Preço "de" riscado; o preço final vem sempre de proposta.valor_total. */
    precoDe: z.string().optional(),
    notaPreco: z.string().optional(),
    condicoes: z.array(cardSchema).catch([]),
    rodape: z.string().optional(),
  }),
])

const deckSchema = z.object({
  versao: z.literal(1),
  codigo: z.string().optional(),
  clienteLabel: z.string().optional(),
  slides: z.array(slideSchema).min(1),
  aprovacao: z.object({
    tag: z.string().catch('Aprovação'),
    titulo: z.string(),
    texto: z.string(),
    narracao: z.string().optional(),
    narracaoAudio: z.string().optional(),
    narracaoLegenda: z.array(legendaCueSchema).optional(),
  }),
  posAceite: z.object({
    titulo: z.string(),
    banner: z.string().optional(),
    precoDe: z.string().optional(),
    notaPreco: z.string().optional(),
    passos: z.array(passoSchema),
    rodape: z.string().optional(),
  }),
})

export type DeckSlide = z.infer<typeof slideSchema>
export type ProposalDeck = z.infer<typeof deckSchema>

/** Superfície efetiva de um slide (override do JSON ou default por tipo). */
export function slideSurface(slide: DeckSlide): 'violeta' | 'escuro' | 'claro' {
  if (slide.tipo === 'capa') return 'violeta'
  if (slide.superficie) return slide.superficie
  switch (slide.tipo) {
    case 'grafico':
    case 'listas':
      return 'claro'
    case 'cards':
      return 'violeta'
    default:
      return 'escuro'
  }
}

/** Parse do jsonb apresentacao — null/inválido = usar layout clássico. */
export function parseProposalDeck(json: unknown): ProposalDeck | null {
  if (json == null) return null
  const parsed = deckSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

// ---------------------------------------------------------------------------
// Narração do modo apresentação
// ---------------------------------------------------------------------------

/** Remove os glifos da marca — eles são visuais, não se leem em voz alta. */
function semGlifos(texto: string): string {
  return texto
    .replace(/✱|\(\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Roteiro falado de um slide: usa `narracao` quando o autor escreveu uma;
 * senão deriva uma leitura razoável dos campos visíveis.
 */
export function slideNarration(slide: DeckSlide): string {
  if (slide.narracao) return slide.narracao

  if (slide.tipo === 'capa') {
    return `${semGlifos(slide.titulo)}. ${slide.subtitulo}`
  }

  const partes: string[] = [`${semGlifos(slide.titulo)}.`]
  if (slide.intro) partes.push(slide.intro)

  switch (slide.tipo) {
    case 'texto':
      partes.push(...slide.paragrafos)
      if (slide.stat) partes.push(`${slide.stat.valor} ${slide.stat.legenda}`)
      slide.cards?.forEach((c) => partes.push(`${c.titulo}: ${c.texto}`))
      break
    case 'grafico':
      slide.barras.forEach((b) => partes.push(`${b.rotulo}: ${b.valor}.`))
      if (slide.destaque) partes.push(slide.destaque)
      break
    case 'cards':
      slide.cards.forEach((c) => partes.push(`${c.titulo}: ${c.texto}`))
      if (slide.rodape) partes.push(slide.rodape)
      break
    case 'modulos':
      slide.modulos.forEach((m) => partes.push(`${m.titulo}. ${m.texto}`))
      break
    case 'listas':
      slide.colunas.forEach((col) =>
        partes.push(`${col.titulo}: ${col.itens.join(' ')}`)
      )
      if (slide.destaque) partes.push(slide.destaque)
      break
    case 'investimento':
      if (slide.notaPreco) partes.push(slide.notaPreco)
      slide.condicoes.forEach((c) => partes.push(`${c.titulo}: ${c.texto}`))
      if (slide.rodape) partes.push(slide.rodape)
      break
  }

  return partes.filter(Boolean).join(' ')
}

/** Trilha de uma seção: MP3 pré-gerado (quando há) + texto pro fallback. */
export interface NarrationTrack {
  texto: string
  audio?: string
  legenda?: LegendaCue[]
}

/** Trilhas na ordem das seções do deck (slides + aprovação). */
export function deckNarrationTracks(deck: ProposalDeck): NarrationTrack[] {
  return [
    ...deck.slides.map((s) => ({
      texto: slideNarration(s),
      audio: s.narracaoAudio,
      legenda: s.narracaoLegenda,
    })),
    {
      texto:
        deck.aprovacao.narracao ??
        `${semGlifos(deck.aprovacao.titulo)}. ${deck.aprovacao.texto}`,
      audio: deck.aprovacao.narracaoAudio,
      legenda: deck.aprovacao.narracaoLegenda,
    },
  ]
}
