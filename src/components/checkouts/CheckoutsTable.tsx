import { motion } from 'framer-motion'
import { EyeOff, Pencil, Trash2 } from 'lucide-react'
import { formatCentavos } from '../produtos/precos'
import type { Produto } from '../produtos/produtosData'
import type { Checkout } from './checkoutsData'
import LinkCheckout from './LinkCheckout'

const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10

const dataHoraFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

interface Props {
  checkouts: readonly Checkout[]
  /** Catálogo indexado por id, para mostrar nome e preço do que é vendido. */
  produtosPorId: ReadonlyMap<string, Produto>
  onEditar: (checkout: Checkout) => void
  onExcluir: (checkout: Checkout) => void
}

/**
 * Lista dos checkouts. Checkout inativo aparece esmaecido e com selo — o link
 * dele responde "não encontrado" para quem abrir, e isso precisa ser óbvio
 * aqui antes de alguém divulgar a página.
 */
export default function CheckoutsTable({
  checkouts,
  produtosPorId,
  onEditar,
  onExcluir,
}: Props) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
          <th className="px-6 py-4 font-medium">Página</th>
          <th className="hidden px-4 py-4 font-medium md:table-cell">Produto</th>
          <th className="hidden px-4 py-4 font-medium lg:table-cell">Ofertas</th>
          <th className="hidden px-4 py-4 font-medium xl:table-cell">Cronômetro</th>
          <th className="px-4 py-4 font-medium">Situação</th>
          <th className="px-4 py-4 text-right font-medium">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {checkouts.map((checkout, index) => {
          const produto = produtosPorId.get(checkout.produto_id)
          const ofertas = (
            [
              ['Bump', checkout.bump_produto_id],
              ['Upsell', checkout.upsell_produto_id],
              ['Downsell', checkout.downsell_produto_id],
            ] as const
          ).filter(([, id]) => id !== null)
          const fim =
            checkout.cronometro_ate === null
              ? null
              : new Date(checkout.cronometro_ate)
          const expirado = fim !== null && fim.getTime() <= Date.now()

          return (
            <motion.tr
              key={checkout.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
              }}
              className={[
                'group border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]',
                checkout.ativo ? '' : 'opacity-60',
              ].join(' ')}
            >
              <td className="px-6 py-4">
                <p className="font-medium text-ink">{checkout.titulo}</p>
                <span className="mt-1 inline-flex">
                  <LinkCheckout slug={checkout.slug} compacto />
                </span>
              </td>
              <td className="hidden px-4 py-4 md:table-cell">
                {produto ? (
                  <>
                    <p className="text-ink/90">{produto.nome}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">
                      {formatCentavos(produto.preco_centavos)}
                    </p>
                  </>
                ) : (
                  <span className="text-muted/50">—</span>
                )}
              </td>
              <td className="hidden px-4 py-4 lg:table-cell">
                {ofertas.length === 0 ? (
                  <span className="text-muted/50">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {ofertas.map(([rotulo]) => (
                      <span
                        key={rotulo}
                        className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted"
                      >
                        {rotulo}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className="hidden px-4 py-4 tabular-nums xl:table-cell">
                {fim === null ? (
                  <span className="text-muted/50">—</span>
                ) : (
                  <span className={expirado ? 'text-amber-300' : 'text-muted'}>
                    {dataHoraFormatter.format(fim)}
                    {expirado && ' · encerrado'}
                  </span>
                )}
              </td>
              <td className="px-4 py-4">
                {checkout.ativo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    No ar
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-300">
                    <EyeOff aria-hidden className="h-3 w-3" />
                    Inativo
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${checkout.titulo}`}
                    title="Editar checkout"
                    onClick={() => onEditar(checkout)}
                    className="rounded-lg p-2 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir ${checkout.titulo}`}
                    title="Excluir checkout"
                    onClick={() => onExcluir(checkout)}
                    className="rounded-lg p-2 text-muted/50 opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </motion.tr>
          )
        })}
      </tbody>
    </table>
  )
}
