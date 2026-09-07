import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ExternalLink, ShoppingBag } from 'lucide-react'
import { formatRelativeTime } from '../../lib/format'
import { planoUrl } from '../leadsRaiox/raioxData'
import {
  compraStatusMeta,
  concorrentesInformados,
  entregaDaCompra,
  formatCentavos,
} from './comprasResumo'
import type { ScanCompra } from './comprasData'

/**
 * Lista das compras do Plano de Correção (padrão visual da ScanLeadsTable).
 * Cada linha: data, loja, comprador (nome e e-mail), valor, status e o
 * estado da entrega — mais o link do plano entregue, os concorrentes do bônus
 * e a reanálise de 30 dias quando existirem.
 *
 * A linha de quem pagou e não recebeu ganha borda e fundo vermelhos: é o
 * único estado desta tela que exige alguém agir agora.
 */

interface ScanComprasTableProps {
  compras: ScanCompra[]
  /** Só para o teste conseguir fixar "agora" ao julgar o atraso da entrega. */
  agora?: Date
}

/** Data curta + hora, no fuso do navegador ("07/09/2026, 14:32"). */
function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScanComprasTable({
  compras,
  agora,
}: ScanComprasTableProps) {
  const prefersReducedMotion = useReducedMotion()

  if (compras.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-light text-muted">
          Nenhuma compra do Plano de Correção neste período.
        </p>
        <p className="mt-1 text-xs font-light text-muted/70">
          Quando um lead comprar, a venda aparece aqui com o estado da entrega.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      <AnimatePresence initial={false}>
        {compras.map((compra) => {
          const status = compraStatusMeta(compra.status)
          const entrega = entregaDaCompra(compra, agora)
          const link = compra.plano_code ? planoUrl(compra.plano_code) : null

          return (
            <motion.li
              key={compra.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              className={
                entrega.alerta
                  ? 'rounded-xl border border-red-400/40 bg-red-500/10'
                  : 'rounded-xl border border-white/5 bg-surface-1'
              }
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium text-ink">
                    {compra.comprador ?? 'Comprador não identificado'}
                    {compra.dominio && (
                      <span className="font-light text-muted">
                        {` · ${compra.dominio}`}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-light text-muted">
                    {compra.email ?? 'sem e-mail'}
                  </p>
                </div>

                <span className="tabular-nums text-sm font-semibold text-ink">
                  {formatCentavos(compra.valor_centavos)}
                </span>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}
                >
                  {status.label}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${entrega.className}`}
                  title={
                    compra.plano_gerado_em
                      ? `Plano gerado em ${dataHora(compra.plano_gerado_em)}`
                      : undefined
                  }
                >
                  {entrega.alerta && <AlertTriangle className="h-3 w-3" />}
                  {entrega.label}
                </span>

                <span
                  className="tabular-nums text-xs font-light text-muted"
                  title={dataHora(compra.criado_em)}
                >
                  {formatRelativeTime(compra.criado_em)}
                </span>

                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver plano
                  </a>
                )}
              </div>

              {/* Bônus e reanálise: só aparecem quando há pagamento a honrar. */}
              {compra.status === 'pago' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-5 py-2.5 text-[11px] font-light text-muted">
                  <span>
                    {concorrentesInformados(compra)
                      ? 'Concorrentes do bônus informados'
                      : 'Concorrentes do bônus pendentes'}
                  </span>
                  <span aria-hidden className="h-3 w-px bg-white/10" />
                  <span>
                    {compra.reanalise_analysis_id
                      ? 'Reanálise de 30 dias já rodou'
                      : compra.reanalise_agendada_em
                        ? `Reanálise agendada para ${dataHora(compra.reanalise_agendada_em)}`
                        : 'Reanálise de 30 dias não agendada'}
                  </span>
                  {compra.recibo_enviado_em && (
                    <>
                      <span aria-hidden className="h-3 w-px bg-white/10" />
                      <span>{`Recibo enviado em ${dataHora(compra.recibo_enviado_em)}`}</span>
                    </>
                  )}
                </div>
              )}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
