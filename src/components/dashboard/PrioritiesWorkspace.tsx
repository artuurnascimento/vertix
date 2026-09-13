import { formatBRL, isOverdue } from '../../lib/commercial'
import { formatRelativeTime } from '../../lib/format'
import {
  useDashboardBriefings,
  useDashboardProposals,
  useDashboardReceivables,
} from './useDashboardData'
import WorkspacePanel from './WorkspacePanel'
import type { WorkspaceItem } from './WorkspacePanel'

export default function PrioritiesWorkspace() {
  const receivables = useDashboardReceivables()
  const proposals = useDashboardProposals()
  const briefings = useDashboardBriefings()
  const now = new Date()
  const items: WorkspaceItem[] = [
    ...(receivables.data ?? [])
      .filter((r) => isOverdue(r.status, r.vencimento, now))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .map((r) => ({
        id: `receivable-${r.id}`,
        title: r.descricao,
        subtitle: 'Recebimento atrasado',
        value: formatBRL(r.valor),
        meta: `Venc. ${r.vencimento.split('-').reverse().join('/')}`,
        steps: [
          { label: 'Conta registrada', detail: formatBRL(r.valor), done: true },
          {
            label: 'Vencimento',
            detail: r.vencimento.split('-').reverse().join('/'),
            done: true,
          },
          { label: 'Pagamento', detail: 'Ainda não confirmado', done: false },
        ],
        nextAction:
          'Revisar a cobrança e acompanhar a confirmação do pagamento.',
        actionLabel: 'Abrir cobrança',
        to: `/admin/financeiro?abrir=${r.id}`,
      })),
    ...(proposals.data ?? [])
      .filter((p) => p.status === 'enviada')
      .sort((a, b) =>
        (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at)
      )
      .map((p) => ({
        id: `proposal-${p.id}`,
        title: 'Proposta sem resposta',
        subtitle: 'Aguardando retorno do cliente',
        value: formatBRL(p.valor_total),
        meta: formatRelativeTime(p.sent_at ?? p.created_at),
        steps: [
          {
            label: 'Proposta criada',
            detail: new Date(p.created_at).toLocaleDateString('pt-BR'),
            done: true,
          },
          {
            label: 'Proposta enviada',
            detail: p.sent_at ? formatRelativeTime(p.sent_at) : 'Enviada',
            done: true,
          },
          {
            label: 'Aceite do cliente',
            detail: 'Aguardando resposta',
            done: false,
          },
        ],
        nextAction: 'Revisar a proposta e acompanhar o retorno do cliente.',
        actionLabel: 'Abrir proposta',
        to: `/admin/propostas?abrir=${p.id}`,
      })),
    ...(briefings.data ?? [])
      .filter((b) => b.status === 'enviado')
      .map((b) => ({
        id: `briefing-${b.id}`,
        title: b.projects?.nome ?? 'Briefing aguardando',
        subtitle: 'Aguardando preenchimento',
        value: 'Briefing',
        meta: 'Pendente',
        steps: [
          {
            label: 'Briefing enviado',
            detail: 'Disponível para o cliente',
            done: true,
          },
          { label: 'Preenchimento', detail: 'Aguardando retorno', done: false },
          {
            label: 'Revisão do escopo',
            detail: 'Após o preenchimento',
            done: false,
          },
        ],
        nextAction:
          'Acompanhar o preenchimento para liberar a revisão do escopo.',
        actionLabel: 'Abrir projeto',
        to: `/admin/projetos/${b.project_id}`,
      })),
  ]
  return (
    <WorkspacePanel
      title="Prioridades"
      items={items}
      loading={
        receivables.isLoading || proposals.isLoading || briefings.isLoading
      }
      error={receivables.isError || proposals.isError || briefings.isError}
      emptyText="Tudo em dia"
    />
  )
}
