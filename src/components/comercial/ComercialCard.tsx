import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { inputClass, labelClass } from '../produtos/formUi'
import { useAtualizarComercial, type CamposComerciais } from './comercialData'
import { MOTIVOS_DE_PERDA, type MotivoDePerda } from './fila'

/** O que o card precisa do projeto — as colunas da migração jornada_fase1. */
export interface ProjetoComercial {
  id: string
  responsavel_id?: string | null
  proxima_acao?: string | null
  proxima_acao_em?: string | null
  valor_estimado?: number | null
  previsao_fechamento?: string | null
  motivo_perda?: string | null
  perdido_em?: string | null
}

interface Props {
  projeto: ProjetoComercial
}

/**
 * O bloco comercial do projeto: responsável, próxima ação (o que e até
 * quando), valor estimado, previsão de fechamento e a perda. Cada campo
 * salva ao sair dele — sem botão "salvar" que a pessoa esquece. É o que
 * alimenta a fila "Hoje" do painel.
 */
export default function ComercialCard({ projeto }: Props) {
  const atualizar = useAtualizarComercial()
  const { data: profiles } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase.from('profiles').select('id, nome').order('nome')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const [campos, setCampos] = useState({
    responsavel_id: projeto.responsavel_id ?? '',
    proxima_acao: projeto.proxima_acao ?? '',
    proxima_acao_em: projeto.proxima_acao_em ?? '',
    valor_estimado: projeto.valor_estimado != null ? String(projeto.valor_estimado) : '',
    previsao_fechamento: projeto.previsao_fechamento ?? '',
  })
  const [motivo, setMotivo] = useState<MotivoDePerda | ''>('')
  useEffect(() => {
    setCampos({
      responsavel_id: projeto.responsavel_id ?? '',
      proxima_acao: projeto.proxima_acao ?? '',
      proxima_acao_em: projeto.proxima_acao_em ?? '',
      valor_estimado: projeto.valor_estimado != null ? String(projeto.valor_estimado) : '',
      previsao_fechamento: projeto.previsao_fechamento ?? '',
    })
  }, [projeto.id, projeto.responsavel_id, projeto.proxima_acao, projeto.proxima_acao_em, projeto.valor_estimado, projeto.previsao_fechamento])

  const salvar = (patch: CamposComerciais) => atualizar.mutate({ projectId: projeto.id, campos: patch })
  const perdido = Boolean(projeto.perdido_em)
  const valorNumero = (v: string) => {
    const n = Number(v.replace(/\./g, '').replace(',', '.'))
    return v.trim() === '' ? null : Number.isFinite(n) && n >= 0 ? n : null
  }

  return (
    <section
      aria-labelledby="comercial-heading"
      className={`rounded-2xl border p-6 ${perdido ? 'border-rose-400/20 bg-rose-500/[0.04]' : 'border-white/5 bg-surface-1'}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="comercial-heading" className="flex items-center gap-2 font-kanit text-lg font-semibold text-ink">
          <Briefcase aria-hidden className="h-5 w-5 text-accent" />
          Comercial
        </h2>
        {perdido ? (
          <button
            type="button"
            onClick={() => salvar({ perdido_em: null, motivo_perda: null })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted hover:bg-white/5 hover:text-ink"
          >
            <Undo2 aria-hidden className="h-3.5 w-3.5" />
            Reabrir oportunidade
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              aria-label="Motivo da perda"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoDePerda | '')}
              className={`${inputClass} w-auto py-1.5 text-xs sm:py-1.5`}
            >
              <option value="">Marcar como perdida…</option>
              {MOTIVOS_DE_PERDA.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
            {motivo && (
              <button
                type="button"
                onClick={() => {
                  salvar({ motivo_perda: motivo, perdido_em: new Date().toISOString(), proxima_acao: null, proxima_acao_em: null })
                  setMotivo('')
                }}
                className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
              >
                Confirmar perda
              </button>
            )}
          </div>
        )}
      </div>

      {perdido && (
        <p className="mb-4 text-sm text-rose-200/90">
          Perdida em {new Date(projeto.perdido_em as string).toLocaleDateString('pt-BR')}
          {projeto.motivo_perda && ` · ${MOTIVOS_DE_PERDA.find((m) => m.valor === projeto.motivo_perda)?.label ?? projeto.motivo_perda}`}.
          Fora do Kanban e da fila; o histórico continua aqui.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Responsável</span>
          <select
            value={campos.responsavel_id}
            onChange={(e) => {
              setCampos({ ...campos, responsavel_id: e.target.value })
              salvar({ responsavel_id: e.target.value || null })
            }}
            className={inputClass}
          >
            <option value="">Ninguém</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Valor estimado (R$)</span>
          <input
            inputMode="decimal"
            value={campos.valor_estimado}
            onChange={(e) => setCampos({ ...campos, valor_estimado: e.target.value })}
            onBlur={() => salvar({ valor_estimado: valorNumero(campos.valor_estimado) })}
            placeholder="0"
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={labelClass}>Próxima ação</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={campos.proxima_acao}
              onChange={(e) => setCampos({ ...campos, proxima_acao: e.target.value })}
              onBlur={() => salvar({ proxima_acao: campos.proxima_acao.trim() || null })}
              placeholder="Ligar para fechar, mandar proposta, cobrar retorno…"
              className={inputClass}
            />
            <input
              type="date"
              aria-label="Até quando"
              value={campos.proxima_acao_em}
              onChange={(e) => {
                setCampos({ ...campos, proxima_acao_em: e.target.value })
                salvar({ proxima_acao_em: e.target.value || null })
              }}
              className={`${inputClass} sm:w-44`}
            />
          </div>
          <span className="text-xs font-light text-muted">
            Vencida, aparece no topo do bloco "Hoje" do painel. Sem data, a oportunidade é listada como "sem próximo passo".
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Previsão de fechamento</span>
          <input
            type="date"
            value={campos.previsao_fechamento}
            onChange={(e) => {
              setCampos({ ...campos, previsao_fechamento: e.target.value })
              salvar({ previsao_fechamento: e.target.value || null })
            }}
            className={inputClass}
          />
        </label>
      </div>
    </section>
  )
}
