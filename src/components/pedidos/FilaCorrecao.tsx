import { useState } from 'react'
import { ExternalLink, Mail, MessageCircle, Wrench } from 'lucide-react'
import { buildWhatsAppLink } from '../ui/whatsapp'
import { formatRelativeTime } from '../../lib/format'
import { inputClass } from '../produtos/formUi'
import { STATUS_ENTREGA, useAtualizarEntrega, useEntregas, type EntregaPendente, type StatusEntrega } from './entregasData'

const PLANO_URL = 'https://scan.vertix.studio/plano/'

const TOM_DO_STATUS: Record<StatusEntrega, string> = {
  aguardando_contato: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  em_contato: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  aplicando: 'border-accent/30 bg-accent/10 text-accent',
  concluida: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  cancelada: 'border-white/10 bg-white/5 text-muted',
}

/**
 * A fila "Correção Aplicada": uma linha por contratação, com o produto, o
 * contato (WhatsApp direto, e-mail), o plano, a data e o status — o que a
 * equipe usa até concluir. Concluídas e canceladas ficam recolhidas.
 */
export default function FilaCorrecao() {
  const entregas = useEntregas()
  const atualizar = useAtualizarEntrega()
  const [mostrarFechadas, setMostrarFechadas] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')

  const todas = entregas.data ?? []
  const abertas = todas.filter((e) => e.status !== 'concluida' && e.status !== 'cancelada')
  const fechadas = todas.filter((e) => e.status === 'concluida' || e.status === 'cancelada')
  const visiveis = mostrarFechadas ? todas : abertas

  if (entregas.isLoading || (todas.length === 0 && !entregas.isError)) return null

  const rotulo = (e: EntregaPendente) =>
    e.entrega === 'correcao_criticos' ? 'Correção — 3 críticos' : e.entrega === 'correcao_aplicada' ? 'Correção Aplicada' : (e.produtos?.nome ?? 'Entrega manual')

  return (
    <section aria-labelledby="fila-correcao-heading" className="mt-8 rounded-2xl border border-accent/20 bg-accent/[0.04] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="fila-correcao-heading" className="flex items-center gap-2 font-kanit text-lg font-semibold text-ink">
          <Wrench aria-hidden className="h-5 w-5 text-accent" />
          Correção Aplicada — fila da equipe
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">{abertas.length}</span>
        </h2>
        {fechadas.length > 0 && (
          <button type="button" onClick={() => setMostrarFechadas((v) => !v)} className="text-xs text-muted hover:text-ink">
            {mostrarFechadas ? 'Ocultar concluídas' : `Ver concluídas e canceladas (${fechadas.length})`}
          </button>
        )}
      </div>
      {entregas.isError && <p className="mt-3 text-sm text-red-400">Não foi possível carregar a fila.</p>}
      <ul className="mt-4 flex flex-col gap-2">
        {visiveis.map((e) => {
          const zap = buildWhatsAppLink(
            e.pedidos?.cliente_whatsapp,
            `Oi${e.pedidos ? `, ${e.pedidos.cliente_nome.split(' ')[0]}` : ''}! Aqui é da Vertix — sobre a ${rotulo(e)} que você contratou, vamos combinar o acesso à loja?`
          )
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/5 bg-surface-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {e.pedidos?.cliente_nome ?? 'Cliente'}
                  <span className="ml-2 text-xs font-light text-muted">{rotulo(e)}</span>
                </p>
                <p className="truncate text-xs font-light text-muted">
                  contratada {formatRelativeTime(e.created_at)}
                  {e.contato_em && ` · contato ${formatRelativeTime(e.contato_em)}`}
                  {e.concluida_em && ` · concluída ${formatRelativeTime(e.concluida_em)}`}
                  {e.observacoes && ` · ${e.observacoes}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {zap && (
                  <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink">
                    <MessageCircle aria-hidden className="h-4 w-4" />
                  </a>
                )}
                {e.pedidos?.cliente_email && (
                  <a href={`mailto:${e.pedidos.cliente_email}`} aria-label="E-mail" className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink">
                    <Mail aria-hidden className="h-4 w-4" />
                  </a>
                )}
                {e.pedidos?.plano_code && (
                  <a href={`${PLANO_URL}${e.pedidos.plano_code}`} target="_blank" rel="noopener noreferrer" aria-label="Abrir plano" className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ink">
                    <ExternalLink aria-hidden className="h-4 w-4" />
                  </a>
                )}
                <select
                  aria-label={`Status da entrega de ${e.pedidos?.cliente_nome ?? 'cliente'}`}
                  value={e.status}
                  onChange={(ev) =>
                    atualizar.mutate([e.id, { status: ev.target.value as StatusEntrega }, { status: e.status, contato_em: e.contato_em }])
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${TOM_DO_STATUS[e.status]}`}
                >
                  {STATUS_ENTREGA.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setEditando(editando === e.id ? null : e.id)
                    setObservacao(e.observacoes ?? '')
                  }}
                  className="text-xs text-muted hover:text-ink"
                >
                  {e.observacoes ? 'Editar obs.' : 'Obs.'}
                </button>
              </div>
              {editando === e.id && (
                <form
                  className="flex w-full items-center gap-2"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    atualizar.mutate([e.id, { observacoes: observacao.trim() || null }, { status: e.status, contato_em: e.contato_em }])
                    setEditando(null)
                  }}
                >
                  <input value={observacao} onChange={(ev) => setObservacao(ev.target.value)} placeholder="Observações (acesso, combinados, bloqueios)" className={inputClass} />
                  <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white">
                    Salvar
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
