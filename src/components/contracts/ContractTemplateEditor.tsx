import { useMemo, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'

interface ContractTemplateEditorProps {
  template: Tables<'contract_templates'>
  draft: string | null
  onDraftChange: (corpo: string) => void
  onDiscard: () => void
}

const PLACEHOLDERS = [
  '{{cliente}}',
  '{{empresa}}',
  '{{projeto}}',
  '{{valor}}',
  '{{prazo}}',
  '{{data}}',
]

/** Editor simples do corpo de um template de contrato — textarea + dirty-state. */
export default function ContractTemplateEditor({
  template,
  draft,
  onDraftChange,
  onDiscard,
}: ContractTemplateEditorProps) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)

  const corpo = draft ?? template.corpo
  const dirty = useMemo(() => draft !== null && draft !== template.corpo, [draft, template.corpo])

  const mutation = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from('contract_templates')
        .update({ corpo: next })
        .eq('id', template.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contract-templates'] })
      onDiscard()
      setSaveError(null)
    },
    onError: () => {
      setSaveError('Não foi possível salvar o template. Tente novamente.')
    },
  })

  const handleSave = () => {
    setSaveError(null)
    mutation.mutate(corpo)
  }

  const handleDiscard = () => {
    onDiscard()
    setSaveError(null)
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-lg text-xs font-light leading-relaxed text-muted">
          Placeholders disponíveis (substituídos ao gerar o contrato):{' '}
          {PLACEHOLDERS.map((placeholder, index) => (
            <span key={placeholder}>
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-accent">
                {placeholder}
              </code>
              {index < PLACEHOLDERS.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!dirty || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Descartar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Save className="h-4 w-4" />
            {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {saveError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          {saveError}
        </p>
      )}

      <textarea
        value={corpo}
        onChange={(e) => onDraftChange(e.target.value)}
        spellCheck={false}
        rows={22}
        className="mt-5 w-full resize-y rounded-xl border border-white/5 bg-surface-2 px-4 py-3.5 font-mono text-xs leading-relaxed text-ink/90 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
      />
    </div>
  )
}
