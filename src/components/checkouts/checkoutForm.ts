import { z } from 'zod'
import { PADRAO_SLUG } from '../produtos/produtoForm'
import { parseProva } from './checkoutsData'
import type { Checkout, CheckoutPayload, Depoimento, Prova } from './checkoutsData'

/**
 * Regras do formulário de checkout. Funções puras, testáveis sem a tela — em
 * especial as duas armadilhas: um produto não pode ser o próprio bump/upsell/
 * downsell dele mesmo, e o slug precisa ser único.
 */

export interface CheckoutFormValues {
  produtoId: string
  slug: string
  titulo: string
  subtitulo: string
  bumpProdutoId: string
  bumpTitulo: string
  bumpTexto: string
  upsellProdutoId: string
  upsellTitulo: string
  upsellTexto: string
  downsellProdutoId: string
  downsellTitulo: string
  downsellTexto: string
  depoimentos: Depoimento[]
  selos: string[]
  /** Texto do input numérico; '' = sem garantia declarada. */
  garantiaDias: string
  garantiaTexto: string
  /** Texto do input numérico; '' = o Pix não muda o preço. */
  descontoPixPercentual: string
  /** Valor de <input type="datetime-local">; '' = sem cronômetro. */
  cronometroAte: string
  ativo: boolean
}

export const EMPTY_CHECKOUT: CheckoutFormValues = {
  produtoId: '',
  slug: '',
  titulo: '',
  subtitulo: '',
  bumpProdutoId: '',
  bumpTitulo: '',
  bumpTexto: '',
  upsellProdutoId: '',
  upsellTitulo: '',
  upsellTexto: '',
  downsellProdutoId: '',
  downsellTitulo: '',
  downsellTexto: '',
  depoimentos: [],
  selos: [],
  garantiaDias: '',
  garantiaTexto: '',
  descontoPixPercentual: '',
  cronometroAte: '',
  ativo: true,
}

export const OFERTAS = ['bump', 'upsell', 'downsell'] as const
export type Oferta = (typeof OFERTAS)[number]

export const OFERTA_LABEL: Record<Oferta, string> = {
  bump: 'Order bump',
  upsell: 'Upsell',
  downsell: 'Downsell',
}

/**
 * A armadilha do checkout: apontar o bump (ou o upsell, ou o downsell) para o
 * MESMO produto que já é o principal. O cliente veria a oferta de comprar de
 * novo o que acabou de comprar, e o total sairia dobrado.
 */
export function ofertaEhOProprioProduto(
  produtoId: string,
  ofertaId: string
): boolean {
  return produtoId !== '' && produtoId === ofertaId
}

/** Ofertas em conflito com o produto principal, na ordem da tela. */
export function ofertasEmConflito(values: CheckoutFormValues): Oferta[] {
  const ids: Record<Oferta, string> = {
    bump: values.bumpProdutoId,
    upsell: values.upsellProdutoId,
    downsell: values.downsellProdutoId,
  }
  return OFERTAS.filter((oferta) =>
    ofertaEhOProprioProduto(values.produtoId, ids[oferta])
  )
}

// ---------------------------------------------------------------------------
// Cronômetro: <input type="datetime-local"> ↔ timestamptz
// ---------------------------------------------------------------------------

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO do banco → "2026-09-30T23:59" no fuso de quem está olhando. */
export function isoParaCampoDataHora(iso: string | null): string {
  if (iso === null) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return [
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`,
    `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`,
  ].join('T')
}

/** "2026-09-30T23:59" (hora local) → ISO UTC. Null quando vazio ou inválido. */
export function campoDataHoraParaIso(valor: string): string | null {
  if (valor.trim() === '') return null
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  return data.toISOString()
}

/** true quando o prazo informado já passou — a página não mostraria nada. */
export function cronometroExpirado(valor: string, agora = new Date()): boolean {
  const iso = campoDataHoraParaIso(valor)
  return iso !== null && new Date(iso) <= agora
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const idOpcional = z.union([z.uuid(), z.literal('')])

const inteiroOpcional = (valor: string): boolean =>
  valor.trim() === '' || /^\d+$/.test(valor.trim())

/**
 * Teto do desconto por método. Existe porque o desconto sai da economia da
 * TAXA do Pix, e nenhuma taxa chega perto disso: acima daqui o número quase
 * sempre é um dígito a mais digitado sem querer, e quem paga a diferença é a
 * margem da venda.
 */
export const DESCONTO_PIX_MAXIMO = 90

export function percentualPixValido(valor: string): boolean {
  const limpo = valor.trim()
  if (limpo === '') return true
  if (!/^\d+$/.test(limpo)) return false
  return Number(limpo) <= DESCONTO_PIX_MAXIMO
}

export const checkoutSchema = z
  .object({
    produtoId: z.uuid('Escolha o produto principal.'),
    slug: z
      .string()
      .trim()
      .min(1, 'Informe o slug da página.')
      .regex(PADRAO_SLUG, 'Use só letras minúsculas, números e hífens.'),
    titulo: z.string().trim().min(1, 'Informe o título da página.'),
    subtitulo: z.string(),
    bumpProdutoId: idOpcional,
    bumpTitulo: z.string(),
    bumpTexto: z.string(),
    upsellProdutoId: idOpcional,
    upsellTitulo: z.string(),
    upsellTexto: z.string(),
    downsellProdutoId: idOpcional,
    downsellTitulo: z.string(),
    downsellTexto: z.string(),
    depoimentos: z.array(
      z.object({
        nome: z.string(),
        texto: z.string(),
        nota: z.number().int().min(1).max(5).nullable(),
        loja: z.string().nullable(),
      })
    ),
    selos: z.array(z.string()),
    garantiaDias: z
      .string()
      .refine(inteiroOpcional, 'Informe os dias de garantia em número inteiro.'),
    garantiaTexto: z.string(),
    descontoPixPercentual: z
      .string()
      .refine(
        percentualPixValido,
        `Informe um percentual inteiro de 0 a ${DESCONTO_PIX_MAXIMO}, ou deixe vazio.`
      ),
    cronometroAte: z
      .string()
      .refine(
        (v) => v.trim() === '' || campoDataHoraParaIso(v) !== null,
        'Data e hora do cronômetro inválidas.'
      ),
    ativo: z.boolean(),
  })
  .superRefine((values, ctx) => {
    for (const oferta of ofertasEmConflito(values)) {
      ctx.addIssue({
        code: 'custom',
        path: [`${oferta}ProdutoId`],
        message: `O ${OFERTA_LABEL[oferta].toLowerCase()} não pode ser o mesmo produto principal.`,
      })
    }
  })

// ---------------------------------------------------------------------------
// Conversões form ↔ banco
// ---------------------------------------------------------------------------

function limpo(texto: string): string | null {
  return texto.trim() === '' ? null : texto.trim()
}

/** Descarta depoimento sem texto e selo vazio — lixo não vai para o jsonb. */
export function limparProva(
  depoimentos: readonly Depoimento[],
  selos: readonly string[]
): Prova {
  return {
    depoimentos: depoimentos
      .filter((d) => d.texto.trim() !== '')
      .map((d) => ({
        nome: d.nome.trim(),
        texto: d.texto.trim(),
        nota: d.nota,
        loja: d.loja === null || d.loja.trim() === '' ? null : d.loja.trim(),
      })),
    selos: selos.map((s) => s.trim()).filter((s) => s !== ''),
  }
}

export function checkoutFormToPayload(
  values: CheckoutFormValues
): CheckoutPayload {
  const dias = values.garantiaDias.trim()
  const descontoPix = values.descontoPixPercentual.trim()
  return {
    produto_id: values.produtoId,
    slug: values.slug.trim().toLowerCase(),
    titulo: values.titulo.trim(),
    subtitulo: limpo(values.subtitulo),
    bump_produto_id: limpo(values.bumpProdutoId),
    bump_titulo: limpo(values.bumpTitulo),
    bump_texto: limpo(values.bumpTexto),
    upsell_produto_id: limpo(values.upsellProdutoId),
    upsell_titulo: limpo(values.upsellTitulo),
    upsell_texto: limpo(values.upsellTexto),
    downsell_produto_id: limpo(values.downsellProdutoId),
    downsell_titulo: limpo(values.downsellTitulo),
    downsell_texto: limpo(values.downsellTexto),
    prova: limparProva(values.depoimentos, values.selos),
    garantia_dias: dias === '' ? null : Number(dias),
    garantia_texto: limpo(values.garantiaTexto),
    desconto_pix_percentual: descontoPix === '' ? null : Number(descontoPix),
    cronometro_ate: campoDataHoraParaIso(values.cronometroAte),
    ativo: values.ativo,
  }
}

export function checkoutToFormValues(checkout: Checkout): CheckoutFormValues {
  const prova = parseProva(checkout.prova)
  return {
    produtoId: checkout.produto_id,
    slug: checkout.slug,
    titulo: checkout.titulo,
    subtitulo: checkout.subtitulo ?? '',
    bumpProdutoId: checkout.bump_produto_id ?? '',
    bumpTitulo: checkout.bump_titulo ?? '',
    bumpTexto: checkout.bump_texto ?? '',
    upsellProdutoId: checkout.upsell_produto_id ?? '',
    upsellTitulo: checkout.upsell_titulo ?? '',
    upsellTexto: checkout.upsell_texto ?? '',
    downsellProdutoId: checkout.downsell_produto_id ?? '',
    downsellTitulo: checkout.downsell_titulo ?? '',
    downsellTexto: checkout.downsell_texto ?? '',
    depoimentos: prova.depoimentos,
    selos: prova.selos,
    garantiaDias:
      checkout.garantia_dias === null ? '' : String(checkout.garantia_dias),
    garantiaTexto: checkout.garantia_texto ?? '',
    descontoPixPercentual:
      checkout.desconto_pix_percentual === null ||
      checkout.desconto_pix_percentual === undefined
        ? ''
        : String(checkout.desconto_pix_percentual),
    cronometroAte: isoParaCampoDataHora(checkout.cronometro_ate),
    ativo: checkout.ativo,
  }
}
