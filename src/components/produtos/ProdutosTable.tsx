import { motion } from 'framer-motion'
import { EyeOff, Pencil, Trash2 } from 'lucide-react'
import {
  PRODUTO_ENTREGA_LABEL,
  PRODUTO_TIPO_BADGE,
  PRODUTO_TIPO_LABEL,
} from './produtosData'
import type { Produto } from './produtosData'
import { descontoPercentual, formatCentavos } from './precos'

const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10

interface Props {
  produtos: readonly Produto[]
  onEditar: (produto: Produto) => void
  onExcluir: (produto: Produto) => void
}

/**
 * Lista do catálogo. O produto inativo aparece esmaecido e com selo próprio:
 * vender por engano um produto desligado é o tipo de erro que só aparece no
 * extrato, então ele precisa gritar na lista.
 */
export default function ProdutosTable({ produtos, onEditar, onExcluir }: Props) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
          <th className="px-6 py-4 font-medium">Produto</th>
          <th className="px-4 py-4 font-medium">Preço</th>
          <th className="hidden px-4 py-4 font-medium sm:table-cell">
            Tipo / serviço
          </th>
          <th className="hidden px-4 py-4 font-medium lg:table-cell">Entrega</th>
          <th className="px-4 py-4 font-medium">Situação</th>
          <th className="px-4 py-4 text-right font-medium">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {produtos.map((produto, index) => {
          const desconto = descontoPercentual(
            produto.preco_centavos,
            produto.preco_ancora_centavos
          )
          return (
            <motion.tr
              key={produto.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
              }}
              className={[
                'group border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]',
                produto.ativo ? '' : 'opacity-60',
              ].join(' ')}
            >
              <td className="px-6 py-4">
                <p className="font-medium text-ink">{produto.nome}</p>
                <p className="mt-0.5 font-mono text-xs font-light text-muted">
                  {produto.slug}
                </p>
              </td>
              <td className="px-4 py-4 tabular-nums">
                <span className="font-medium text-ink">
                  {formatCentavos(produto.preco_centavos)}
                </span>
                {produto.preco_ancora_centavos !== null && (
                  <span className="ml-2 text-xs font-light text-muted line-through">
                    {formatCentavos(produto.preco_ancora_centavos)}
                  </span>
                )}
                {desconto !== null && (
                  <span className="ml-1.5 text-xs text-accent">−{desconto}%</span>
                )}
              </td>
              <td className="hidden px-4 py-4 sm:table-cell">
                <span
                  className={[
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                    PRODUTO_TIPO_BADGE[produto.tipo],
                  ].join(' ')}
                >
                  {PRODUTO_TIPO_LABEL[produto.tipo]}
                </span>
                {/*
                  O "—" aparece de propósito quando falta categoria: é a
                  única pista de que aquele produto vai cair em "Sem
                  categoria" no relatório de Pedidos. Esconder a ausência
                  esconderia o trabalho que falta fazer.
                */}
                <p
                  className={[
                    'mt-1 text-xs font-light',
                    produto.categoria ? 'text-muted' : 'text-muted/50',
                  ].join(' ')}
                >
                  {produto.categoria ?? '— sem categoria'}
                </p>
              </td>
              <td className="hidden px-4 py-4 text-muted lg:table-cell">
                {PRODUTO_ENTREGA_LABEL[produto.entrega]}
              </td>
              <td className="px-4 py-4">
                {produto.ativo ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Ativo
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
                    aria-label={`Editar ${produto.nome}`}
                    title="Editar produto"
                    onClick={() => onEditar(produto)}
                    className="rounded-lg p-2 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir ${produto.nome}`}
                    title="Excluir produto"
                    onClick={() => onExcluir(produto)}
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
