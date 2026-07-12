import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

interface NoteComposerProps {
  projectId: string
}

export default function NoteComposer({ projectId }: NoteComposerProps) {
  const [texto, setTexto] = useState('')
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const saveNote = useMutation({
    mutationFn: async (descricao: string): Promise<void> => {
      const { error } = await supabase.from('activity_log').insert({
        project_id: projectId,
        user_id: user?.id ?? null,
        tipo: 'nota',
        descricao,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      setTexto('')
      await queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
    },
  })

  const trimmed = texto.trim()
  const canSubmit = trimmed.length > 0 && !saveNote.isPending

  const submit = () => {
    if (canSubmit) saveNote.mutate(trimmed)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div>
      <label htmlFor="nota-interna" className="sr-only">
        Nota interna
      </label>
      <textarea
        id="nota-interna"
        rows={3}
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Adicionar nota interna…"
        className="w-full resize-none rounded-xl border border-white/5 bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        {saveNote.isError ? (
          <p className="text-xs text-red-400" role="alert">
            Não foi possível salvar a nota. Tente novamente.
          </p>
        ) : (
          <span className="text-[11px] font-light text-muted/60">
            ⌘/Ctrl + Enter para salvar
          </span>
        )}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {saveNote.isPending ? 'Salvando…' : 'Salvar nota'}
        </button>
      </div>
    </div>
  )
}
