import { useMemo } from 'react'
import { Megaphone } from 'lucide-react'
import DashboardCard from '../dashboard/DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from '../dashboard/CardStates'
import { formatBRL } from '../../lib/commercial'
import { useFunilPessoas, useGastoEmAnuncios, useSessoesUtm } from './useReportsData'
import { porCampanha, resumoDaOrigem, tempoAteContratacao } from './origem'

function pct(valor: number | null): string {
  if (valor === null) return '—'
  return `${Math.round(valor * 100)}%`
}

function reais(valor: number | null): string {
  return valor === null ? '—' : formatBRL(valor)
}

function dias(valor: number | null): string {
  if (valor === null) return '—'
  return `${valor} ${valor === 1 ? 'dia' : 'dias'}`
}

/**
 * Funil com origem (jornada, fase 4): por campanha, quantas pessoas
 * chegaram em cada etapa e quanto renderam; em cima, os números que decidem
 * o tráfego — receita por lead, CAC (gasto em anúncios ÷ planos pagos e ÷
 * contratos) e o tempo entre o lead e a contratação maior.
 *
 * O gasto vem de ad_metrics_daily, que é por conta de anúncios e por dia —
 * não por campanha. Por isso o CAC é do todo; a linha por campanha mostra
 * leads, compras, contratos e receita, que já dizem onde o dinheiro rende.
 */
export default function FunilOrigem() {
  const pessoas = useFunilPessoas()
  const sessoes = useSessoesUtm()
  const gasto = useGastoEmAnuncios()

  const isLoading = pessoas.isLoading || sessoes.isLoading || gasto.isLoading
  const isError = pessoas.isError || sessoes.isError || gasto.isError

  const linhas = useMemo(() => porCampanha(pessoas.data ?? [], sessoes.data ?? []), [pessoas.data, sessoes.data])
  const resumo = useMemo(() => resumoDaOrigem(pessoas.data ?? [], gasto.data ?? 0), [pessoas.data, gasto.data])
  const tempo = useMemo(() => tempoAteContratacao(pessoas.data ?? []), [pessoas.data])

  const kpis = [
    { rotulo: 'Receita por lead', valor: reais(resumo.receitaPorLead), nota: `${resumo.leads} leads · ${formatBRL(resumo.receita)}` },
    { rotulo: 'CAC do plano', valor: reais(resumo.cac), nota: resumo.gasto > 0 ? `${formatBRL(resumo.gasto)} ÷ ${resumo.compras} compras` : 'sem gasto em anúncios' },
    { rotulo: 'CAC da implementação', valor: reais(resumo.cacContrato), nota: resumo.gasto > 0 ? `÷ ${resumo.contratos} contratos` : 'sem gasto em anúncios' },
    { rotulo: 'Lead → contrato', valor: dias(tempo.medianaDias), nota: tempo.n > 0 ? `mediana de ${tempo.n} · média ${dias(tempo.mediaDias)}` : 'ninguém contratou ainda' },
  ]

  return (
    <DashboardCard title="Funil por campanha" subtitle="De onde vem quem compra, e quanto custa">
      {isLoading && <CardSkeleton rows={5} rowClassName="h-8" />}
      {isError && <CardErrorState />}

      {!isLoading && !isError && linhas.length === 0 && (
        <CardEmptyState
          icon={Megaphone}
          title="Sem tráfego rastreado"
          description="Quando os links com UTM trouxerem sessões e leads, cada campanha aparece aqui com o que rendeu."
        />
      )}

      {!isLoading && !isError && linhas.length > 0 && (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.rotulo} className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3">
                <dt className="text-[11px] font-medium uppercase tracking-widest text-muted">{k.rotulo}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{k.valor}</dd>
                <dd className="mt-0.5 truncate text-[11px] font-light text-muted">{k.nota}</dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-widest text-muted">
                  <th scope="col" className="pb-2 pr-3 font-medium">Campanha</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-medium">Sessões</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-medium">Leads</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-medium">Compras</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-medium">Contratos</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-medium">Receita</th>
                  <th scope="col" className="pb-2 text-right font-medium">R$/lead</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.chave} data-testid={`campanha-${l.chave}`} className="border-t border-white/5">
                    <td className="py-2 pr-3">
                      <span className="text-ink">{l.campanha}</span>
                      {l.origem !== l.campanha && (
                        <span className="ml-1.5 text-[11px] text-muted">{l.origem}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted">{l.sessoes}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{l.leads}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">
                      {l.compras}
                      <span className="ml-1 text-[11px] text-muted">{pct(l.conversaoCompra)}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">
                      {l.contratos}
                      <span className="ml-1 text-[11px] text-muted">{pct(l.conversaoContrato)}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink">{formatBRL(l.receita)}</td>
                    <td className="py-2 text-right tabular-nums text-muted">{reais(l.receitaPorLead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
