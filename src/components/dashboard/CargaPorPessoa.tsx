import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import DashboardCard from './DashboardCard'
import { CardEmptyState, CardErrorState, CardSkeleton } from './CardStates'
import { cargaPorPessoa, somarHorasPorProjeto } from './carga'
import type { PerfilParaCarga, ProjetoParaCarga } from './carga'

const CAPACIDADE_KEY = 'capacidade_semanal_horas'
const CAPACIDADE_PADRAO = 40

function horas(n: number): string {
  return `${String(n).replace('.', ',')}h`
}

/**
 * Carga por pessoa: horas estimadas em aberto por responsável, o que já foi
 * feito e em quantas semanas o restante cabe (capacidade em Configurações).
 * Enquanto a Vertix tiver uma pessoa executando, é a fila em semanas.
 */
export default function CargaPorPessoa() {
  const projetos = useQuery({
    queryKey: ['dashboard', 'carga', 'projetos'],
    queryFn: async (): Promise<ProjetoParaCarga[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nome, status, perdido_em, responsavel_id, horas_estimadas')
      if (error) throw new Error(error.message)
      return data
    },
  })
  const entradas = useQuery({
    queryKey: ['dashboard', 'carga', 'horas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('time_entries').select('project_id, horas')
      if (error) throw new Error(error.message)
      return data
    },
  })
  const perfis = useQuery({
    queryKey: ['dashboard', 'carga', 'perfis'],
    queryFn: async (): Promise<PerfilParaCarga[]> => {
      const { data, error } = await supabase.from('profiles').select('id, nome')
      if (error) throw new Error(error.message)
      return data
    },
  })
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const capacidade = Number(settings.data?.find((s) => s.chave === CAPACIDADE_KEY)?.valor ?? CAPACIDADE_PADRAO) || CAPACIDADE_PADRAO
  const linhas = useMemo(
    () => cargaPorPessoa(projetos.data ?? [], somarHorasPorProjeto(entradas.data ?? []), perfis.data ?? [], capacidade),
    [projetos.data, entradas.data, perfis.data, capacidade]
  )
  const isLoading = projetos.isLoading || entradas.isLoading || perfis.isLoading
  const isError = projetos.isError || entradas.isError || perfis.isError

  return (
    <DashboardCard title="Carga por pessoa" subtitle={`Horas em aberto ÷ ${capacidade}h por semana`}>
      {isLoading && <CardSkeleton rows={2} rowClassName="h-12" />}
      {isError && <CardErrorState />}
      {!isLoading && !isError && linhas.length === 0 && (
        <CardEmptyState icon={Gauge} title="Nada em aberto" description="Nenhum projeto em andamento com responsável." />
      )}
      {!isLoading && !isError && linhas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {linhas.map((l) => {
            const pct = l.estimadas > 0 ? Math.min(100, (l.realizadas / l.estimadas) * 100) : 0
            return (
              <li key={l.responsavelId ?? 'sem'} data-testid={`carga-${l.responsavelId ?? 'sem'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-ink">
                    {l.nome}
                    <span className="ml-2 text-xs font-light text-muted">
                      {l.projetos} {l.projetos === 1 ? 'projeto' : 'projetos'}
                      {l.semEstimativa > 0 && ` · ${l.semEstimativa} sem estimativa`}
                    </span>
                  </p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {l.semanas !== null && l.restantes > 0
                      ? `${String(l.semanas).replace('.', ',')} ${l.semanas === 1 ? 'semana' : 'semanas'}`
                      : l.estimadas > 0
                        ? 'em dia'
                        : '—'}
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-muted">
                  {horas(l.realizadas)} feitas de {horas(l.estimadas)} estimadas · faltam {horas(l.restantes)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </DashboardCard>
  )
}
