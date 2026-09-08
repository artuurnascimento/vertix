import { catalogoSupabase } from '../produtos/catalogoSupabase'
import { PAGAR_PUBLIC_BASE } from '../../lib/publicUrls'
import type { Banner } from './bannerUpload'

/**
 * Leitura e escrita de public.checkouts — a OFERTA montada sobre um produto
 * (copy, order bump, upsell, downsell, prova social, garantia e cronômetro).
 *
 * Os campos `prova` e `banner` são jsonb de conteúdo de página. A forma abaixo
 * é a mesma que a página pública lê em
 * src/components/checkout/checkoutTypes.ts.
 */

export interface Depoimento {
  nome: string
  texto: string
  /** Nota de 1 a 5 — a página pública mostra estrelas quando existe. */
  nota: number | null
  /** Loja/empresa de quem deu o depoimento. Opcional. */
  loja: string | null
  /**
   * Foto de perfil, já encolhida e hospedada por nós. `null` = sem foto, e a
   * página simplesmente não desenha o círculo.
   *
   * O nome do campo é o mesmo que a página pública lê (`fotoUrl`); o leitor de
   * lá ainda aceita `foto_url`, `foto` e `avatar_url`, para não quebrar prova
   * que tenha sido escrita à mão por SQL.
   */
  fotoUrl: string | null
}

export interface Prova {
  depoimentos: Depoimento[]
  selos: string[]
}

export const PROVA_VAZIA: Prova = { depoimentos: [], selos: [] }

export interface Checkout {
  id: string
  produto_id: string
  slug: string
  titulo: string
  subtitulo: string | null
  bump_produto_id: string | null
  bump_titulo: string | null
  bump_texto: string | null
  upsell_produto_id: string | null
  upsell_titulo: string | null
  upsell_texto: string | null
  downsell_produto_id: string | null
  downsell_titulo: string | null
  downsell_texto: string | null
  prova: unknown
  /**
   * Banner do topo, jsonb como a `prova` e pelo mesmo motivo: conteúdo de
   * página. Forma em bannerUpload.ts (`parseBanner`).
   */
  banner: unknown
  garantia_dias: number | null
  garantia_texto: string | null
  /**
   * Percentual abatido do total quando o cliente paga no Pix. `null` = o
   * método de pagamento não mexe no preço.
   */
  desconto_pix_percentual: number | null
  /** Instante absoluto do fim do cronômetro (ISO) ou null. */
  cronometro_ate: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type CheckoutPayload = Omit<
  Checkout,
  'id' | 'created_at' | 'updated_at' | 'prova' | 'banner'
> & { prova: Prova; banner: Banner }

const COLUNAS =
  'id, produto_id, slug, titulo, subtitulo, bump_produto_id, bump_titulo, bump_texto, upsell_produto_id, upsell_titulo, upsell_texto, downsell_produto_id, downsell_titulo, downsell_texto, prova, banner, garantia_dias, garantia_texto, desconto_pix_percentual, cronometro_ate, ativo, created_at, updated_at'

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function textoOuNull(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

/**
 * jsonb solto do banco → prova com forma conhecida. Tolerante de propósito:
 * o campo pode ter sido escrito por outra tela, por SQL ou por uma versão
 * anterior, e uma prova malformada não pode derrubar o formulário.
 */
export function parseProva(bruto: unknown): Prova {
  if (!ehRegistro(bruto)) return PROVA_VAZIA
  const brutoDepoimentos = Array.isArray(bruto.depoimentos) ? bruto.depoimentos : []
  const depoimentos = brutoDepoimentos.flatMap((item): Depoimento[] => {
    if (!ehRegistro(item)) return []
    const texto = textoOuNull(item.texto)
    if (texto === null) return []
    const nota = typeof item.nota === 'number' ? Math.round(item.nota) : null
    return [
      {
        nome: textoOuNull(item.nome) ?? '',
        texto,
        nota: nota !== null && nota >= 1 && nota <= 5 ? nota : null,
        loja: textoOuNull(item.loja),
        // Os três nomes alternativos são os mesmos que a página pública
        // aceita: prova gravada por SQL à mão costuma usar `foto_url`, e
        // divergir aqui faria a foto sumir ao reabrir o formulário.
        fotoUrl:
          textoOuNull(item.fotoUrl) ??
          textoOuNull(item.foto_url) ??
          textoOuNull(item.foto) ??
          textoOuNull(item.avatar_url),
      },
    ]
  })
  const brutoSelos = Array.isArray(bruto.selos) ? bruto.selos : []
  const selos = brutoSelos
    .map((selo) => (typeof selo === 'string' ? selo.trim() : ''))
    .filter((selo) => selo !== '')
  return { depoimentos, selos }
}

export async function fetchCheckouts(): Promise<Checkout[]> {
  const { data, error } = await catalogoSupabase
    .from('checkouts')
    .select(COLUNAS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Checkout[]
}

export async function criarCheckout(payload: CheckoutPayload): Promise<void> {
  const { error } = await catalogoSupabase.from('checkouts').insert(payload)
  if (error) throw error
}

export async function atualizarCheckout(
  id: string,
  payload: CheckoutPayload
): Promise<void> {
  const { error } = await catalogoSupabase
    .from('checkouts')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

export async function excluirCheckout(id: string): Promise<void> {
  const { error } = await catalogoSupabase.from('checkouts').delete().eq('id', id)
  if (error) throw error
}

/** Endereço público da oferta: o que a equipe copia e manda para o cliente. */
export function urlDoCheckout(slug: string): string {
  // Sempre pay.vertix.studio, nunca o host onde o painel está aberto: quem
  // copia este link vai divulgá-lo, e sistema.vertix.studio é o endereço do
  // administrativo. Os domínios apontam para o mesmo deploy, então a página
  // abre nos dois — mas o que chega ao cliente precisa ser o de pagamento.
  return `${PAGAR_PUBLIC_BASE}/c/${slug}`
}
