import { motion } from 'framer-motion'
import { Pencil, TicketPercent, Trash2 } from 'lucide-react'
import { formatDateBR } from '../../lib/commercial'
import { formatCentavos } from '../produtos/precos'
import type { Produto } from '../produtos/produtosData'
import { cupomEsgotado } from './cuponsData'
import type { Cupom } from './cuponsData'

const ROW_STAGGER_S = 0.04
const MAX_STAGGER_ROWS = 10

interface Props {
  cupons: readonly Cupom[]
  produtosPorId: ReadonlyMap<string, Produto>
  onEditar: (cupom: Cupom) => void
  onExcluir: (cupom: Cupom) => void
  onCriar: () => void
}

/** "50%" ou "R$ 50,00" — a unidade de `valor` depende do tipo do cupom. */
function descontoLegivel(cupom: Cupom): string {
  return cupom.tipo === 'percentual'
    ? `${cupom.valor}%`
    : formatCentavos(cupom.valor)
}

/**
 * Lista de cupons com o contador de usos. `usos` é escrito pelo sistema
 * quando o pagamento é aprovado — aqui é só leitura.
 */
export default function CuponsPanel({
  cupons,
  produtosPorId,
  onEditar,
  onExcluir,
  onCriar,
}: Props) {
  if (cupons.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
          <TicketPercent className="h-6 w-6 text-accent" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-ink">Nenhum cupom criado</h2>
        <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
          Cupom é opcional: sem nenhum, o checkout cobra o preço cheio. Crie um
          quando for fazer campanha, com validade e limite de uso definidos.
        </p>
        <button
          type="button"
          onClick={onCriar}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-2"
        >
          Criar primeiro cupom
        </button>
      </div>
    )
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-muted/70">
          <th className="px-6 py-4 font-medium">Código</th>
          <th className="px-4 py-4 font-medium">Desconto</th>
          <th className="hidden px-4 py-4 font-medium sm:table-cell">Usos</th>
          <th className="hidden px-4 py-4 font-medium lg:table-cell">Validade</th>
          <th className="hidden px-4 py-4 font-medium xl:table-cell">Produto</th>
          <th className="px-4 py-4 font-medium">Situação</th>
          <th className="px-4 py-4 text-right font-medium">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {cupons.map((cupom, index) => {
          const esgotado = cupomEsgotado(cupom)
          const produto =
            cupom.produto_id === null ? null : produtosPorId.get(cupom.produto_id)
          return (
            <motion.tr
              key={cupom.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(index, MAX_STAGGER_ROWS) * ROW_STAGGER_S,
              }}
              className={[
                'group border-b border-white/5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.03]',
                esgotado ? 'opacity-60' : '',
              ].join(' ')}
            >
              <td className="px-6 py-4 font-mono font-medium tracking-widest text-ink">
                {cupom.codigo}
              </td>
              <td className="px-4 py-4 tabular-nums text-ink/90">
                {descontoLegivel(cupom)}
              </td>
              <td className="hidden px-4 py-4 tabular-nums sm:table-cell">
                <span className="text-ink">{cupom.usos}</span>
                <span className="text-muted">
                  {cupom.limite_uso === null ? ' de ∞' : ` de ${cupom.limite_uso}`}
                </span>
              </td>
              <td className="hidden px-4 py-4 tabular-nums text-muted lg:table-cell">
                {cupom.validade === null ? 'Não expira' : formatDateBR(cupom.validade)}
              </td>
              <td className="hidden px-4 py-4 text-muted xl:table-cell">
                {produto ? produto.nome : 'Qualquer checkout'}
              </td>
              <td className="px-4 py-4">
                {!cupom.ativo ? (
                  <span className="inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-300">
                    Inativo
                  </span>
                ) : esgotado ? (
                  <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    Esgotado
                  </span>
                ) : (
                  <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                    Válido
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    aria-label={`Editar cupom ${cupom.codigo}`}
                    title="Editar cupom"
                    onClick={() => onEditar(cupom)}
                    className="rounded-lg p-2 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir cupom ${cupom.codigo}`}
                    title="Excluir cupom"
                    onClick={() => onExcluir(cupom)}
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
