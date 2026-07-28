import { Sparkles, RotateCw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

interface ResumoMeta {
  objetivo?: string
  escopo?: string
  publico?: string
  riscos?: string
  proximos_passos?: string
  fonte?: 'ia' | 'extrativo'
}

interface BriefingResumoProps {
  briefingId: string
  resumoMeta: ResumoMeta | null
}

const BLOCOS: { chave: keyof ResumoMeta; label: string }[] = [
  { chave: 'objetivo', label: 'Objetivo' },
  { chave: 'escopo', label: 'Escopo' },
  { chave: 'publico', label: 'Público' },
  { chave: 'riscos', label: 'Riscos e atenção' },
  { chave: 'proximos_passos', label: 'Próximos passos' },
]

/**
 * Resumo executivo do briefing gerado por IA (edge summarize-briefing).
 * Mostra o resumo já salvo e permite (re)gerar. Fonte 'extrativo' indica
 * fallback sem ANTHROPIC_API_KEY.
 */
export default function BriefingResumo({
  briefingId,
  resumoMeta,
}: BriefingResumoProps) {
  const queryClient = useQueryClient()

  const gerar = useMutation({
    mutationFn: async (): Promise<ResumoMeta> => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        resumo_meta: ResumoMeta
        error?: string
      }>('summarize-briefing', { body: { briefing_id: briefingId } })
      if (error || !data?.ok) {
        throw new Error(data?.error ?? error?.message ?? 'falha')
      }
      return data.resumo_meta
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['briefings'] })
    },
  })

  const meta = gerar.data ?? resumoMeta
  const temResumo = Boolean(meta)

  return (
    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h4 className="text-sm font-semibold text-ink">Resumo IA</h4>
        {meta?.fonte === 'extrativo' && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted">
            sem IA — extrativo
          </span>
        )}
        <button
          type="button"
          onClick={() => gerar.mutate()}
          disabled={gerar.isPending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/20 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {gerar.isPending ? (
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {temResumo ? 'Regerar' : 'Gerar resumo'}
        </button>
      </div>

      {gerar.isError && (
        <p className="mt-3 text-xs text-red-400">
          Não foi possível gerar o resumo. Tente novamente.
        </p>
      )}

      {temResumo ? (
        <dl className="mt-3 space-y-2.5">
          {BLOCOS.map(({ chave, label }) => {
            const valor = meta?.[chave]
            if (!valor) return null
            return (
              <div key={chave}>
                <dt className="text-[11px] font-medium uppercase tracking-widest text-accent/80">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink/90">
                  {valor}
                </dd>
              </div>
            )
          })}
        </dl>
      ) : (
        !gerar.isPending && (
          <p className="mt-3 text-xs font-light text-muted">
            Transforme as respostas em um resumo executivo (objetivo, escopo,
            público, riscos e próximos passos) com um clique.
          </p>
        )
      )}
    </div>
  )
}
