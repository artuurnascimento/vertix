import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, Eye, Info, Pencil, Plus, RotateCcw, Save } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import {
  normalizePerguntasForSave,
  parsePerguntas,
  perguntasToJson,
  validatePerguntasDraft,
} from '../../lib/briefing'
import type {
  BriefingPergunta,
  PerguntasDraftValidation,
} from '../../lib/briefing'
import {
  countChanges,
  createPergunta,
  isDraftDirty,
  movePergunta,
} from './draft'
import PerguntaCard from './PerguntaCard'
import TemplatePreview from './TemplatePreview'

interface TemplateEditorProps {
  template: Tables<'briefing_templates'>
  /** Rascunho não salvo deste template — null = sem edições. */
  draft: BriefingPergunta[] | null
  onDraftChange: (perguntas: BriefingPergunta[]) => void
  onDiscard: () => void
}

export default function TemplateEditor({
  template,
  draft,
  onDraftChange,
  onDiscard,
}: TemplateEditorProps) {
  const queryClient = useQueryClient()
  const [validation, setValidation] =
    useState<PerguntasDraftValidation | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const saved = useMemo(
    () => parsePerguntas(template.perguntas),
    [template.perguntas]
  )
  const perguntas = draft ?? saved
  const dirty = isDraftDirty(saved, draft)
  const changes = dirty && draft ? countChanges(saved, draft) : 0

  const mutation = useMutation({
    mutationFn: async (next: BriefingPergunta[]) => {
      const { error } = await supabase
        .from('briefing_templates')
        .update({ perguntas: perguntasToJson(next) })
        .eq('id', template.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['briefing-templates'] })
      onDiscard()
      setValidation(null)
      setSaveError(null)
    },
    onError: () => {
      setSaveError('Não foi possível salvar o template. Tente novamente.')
    },
  })

  const handleChange = (next: BriefingPergunta[]) => {
    onDraftChange(next)
    // Feedback vivo depois da primeira tentativa de salvar com erro.
    if (validation) setValidation(validatePerguntasDraft(next))
  }

  const handleSave = () => {
    setSaveError(null)
    const result = validatePerguntasDraft(perguntas)
    if (!result.success) {
      setValidation(result)
      return
    }
    setValidation(null)
    mutation.mutate(normalizePerguntasForSave(perguntas))
  }

  const handleDiscard = () => {
    onDiscard()
    setValidation(null)
    setSaveError(null)
  }

  const rootMessage =
    saveError ?? (validation && !validation.success ? validation.rootError : null)

  return (
    <div className="mt-6">
      {/* Barra de ações do rascunho */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowPreview((prev) => !prev)}
          aria-pressed={showPreview}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {showPreview ? (
            <Pencil className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {showPreview ? 'Voltar à edição' : 'Visualizar como cliente'}
        </button>

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
            {mutation.isPending
              ? 'Salvando…'
              : dirty
                ? `Salvar alterações (${changes})`
                : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Aviso permanente sobre o efeito das alterações */}
      <p className="mt-4 flex items-start gap-2 text-xs font-light leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/70" />
        Alterações valem para links de briefing ainda não respondidos.
        Perguntas removidas deixam de aparecer nas respostas antigas.
      </p>

      {rootMessage && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          {rootMessage}
        </p>
      )}

      {showPreview ? (
        <div className="mt-5">
          <TemplatePreview perguntas={perguntas} />
        </div>
      ) : (
        <>
          <ul className="mt-5 flex list-none flex-col gap-3 p-0">
            <AnimatePresence initial={false}>
              {perguntas.map((pergunta, index) => (
                <PerguntaCard
                  key={pergunta.id}
                  pergunta={pergunta}
                  index={index}
                  total={perguntas.length}
                  error={validation?.fieldErrors[pergunta.id]}
                  onChange={(next) =>
                    handleChange(
                      perguntas.map((atual) =>
                        atual.id === pergunta.id ? next : atual
                      )
                    )
                  }
                  onMove={(delta) =>
                    handleChange(movePergunta(perguntas, index, delta))
                  }
                  onRemove={() =>
                    handleChange(
                      perguntas.filter((atual) => atual.id !== pergunta.id)
                    )
                  }
                />
              ))}
            </AnimatePresence>
          </ul>

          {perguntas.length === 0 && (
            <div className="mt-5 flex flex-col items-center rounded-xl border border-white/5 bg-surface-1 px-6 py-8 text-center">
              <ClipboardList className="h-6 w-6 text-muted/50" />
              <p className="mt-3 text-sm font-light text-muted">
                Nenhuma pergunta neste template. Adicione pelo menos uma antes
                de salvar.
              </p>
            </div>
          )}

          <motion.div layout transition={{ duration: 0.2 }} className="mt-4">
            <button
              type="button"
              onClick={() => handleChange([...perguntas, createPergunta()])}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="h-4 w-4" />
              Adicionar pergunta
            </button>
          </motion.div>
        </>
      )}
    </div>
  )
}
