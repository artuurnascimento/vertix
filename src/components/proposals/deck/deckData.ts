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

const baseSlide = {
  tag: z.string(),
  titulo: z.string(),
  intro: z.string().optional(),
  superficie: superficieSchema.optional(),
}

const slideSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('capa'),
    titulo: z.string(),
    subtitulo: z.string(),
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
