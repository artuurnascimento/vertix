import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Tables } from '../../lib/database.types'
import { PROJECT_TIPOS, projectSchema } from '../../lib/schemas'
import type { ProjectTipo } from '../../lib/schemas'
import { TIPO_SERVICO } from '../../lib/format'

type ProjectSummary = Pick<Tables<'projects'>, 'id' | 'status' | 'updated_at'>

type ClientWithProjects = Tables<'clients'> & {
  projects: ProjectSummary[]
}

interface LockedClient {
  id: string
  nome: string
}

interface ProjectFormModalProps {
  open: boolean
  onClose: () => void
  /** Se fornecido, o cliente vem pré-selecionado e travado (ClientDetail). */
  lockedClient?: LockedClient | null
}

interface FormState {
  nome: string
  tipo_servico: ProjectTipo | ''
  client_id: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

export default function ProjectFormModal({
  open,
  onClose,
  lockedClient,
}: ProjectFormModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [values, setValues] = useState<FormState>({
    nome: '',
    tipo_servico: '',
    client_id: lockedClient?.id ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues({
        nome: '',
        tipo_servico: '',
        client_id: lockedClient?.id ?? '',
      })
      setErrors({})
      setRootError(null)
    }
  }, [open, lockedClient])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Mesma query/key da lista de clientes — compartilha o cache sem conflito.
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    enabled: open && !lockedClient,
    queryFn: async (): Promise<ClientWithProjects[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, projects(id, status, updated_at)')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const mutation = useMutation({
    mutationFn: async (payload: {
      nome: string
      tipo_servico: ProjectTipo
      client_id: string
    }) => {
      const { data: created, error } = await supabase
        .from('projects')
        .insert(payload)
        .select('id, client_id')
        .single()
      if (error) throw new Error(error.message)

      const { error: logError } = await supabase.from('activity_log').insert({
        project_id: created.id,
        user_id: user?.id ?? null,
        tipo: 'status_change',
        descricao: 'Projeto criado (lead)',
      })
      if (logError) throw new Error(logError.message)

      return created
    },
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
        queryClient.invalidateQueries({ queryKey: ['client', created.client_id] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ])
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível criar o projeto. Tente novamente.')
    },
  })

  const setField = (field: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = projectSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Novo projeto"
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Novo projeto</h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  Todo projeto nasce como lead no pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Nome do projeto *</span>
                <input
                  type="text"
                  value={values.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  placeholder="Loja Virtual Acme"
                  className={inputClass}
                />
                {errors.nome && (
                  <span className="text-xs text-red-400">{errors.nome}</span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Tipo de serviço *</span>
                <select
                  value={values.tipo_servico}
                  onChange={(e) => setField('tipo_servico', e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">Selecionar…</option>
                  {PROJECT_TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {TIPO_SERVICO[tipo].label}
                    </option>
                  ))}
                </select>
                {errors.tipo_servico && (
                  <span className="text-xs text-red-400">
                    {errors.tipo_servico}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={`${labelClass} inline-flex items-center gap-1.5`}>
                  Cliente *
                  {lockedClient && (
                    <Lock aria-hidden className="h-3 w-3 text-muted/60" />
                  )}
                </span>
                {lockedClient ? (
                  <div
                    aria-label={`Cliente: ${lockedClient.nome}`}
                    className="w-full cursor-not-allowed rounded-lg border border-white/5 bg-surface-2/60 px-4 py-2.5 text-sm text-muted"
                  >
                    {lockedClient.nome}
                  </div>
                ) : (
                  <select
                    value={values.client_id}
                    onChange={(e) => setField('client_id', e.target.value)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Selecionar…</option>
                    {(clients ?? []).map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.empresa
                          ? `${client.nome} — ${client.empresa}`
                          : client.nome}
                      </option>
                    ))}
                  </select>
                )}
                {errors.client_id && (
                  <span className="text-xs text-red-400">{errors.client_id}</span>
                )}
              </label>

              {rootError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                >
                  {rootError}
                </p>
              )}

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {mutation.isPending ? 'Criando…' : 'Criar projeto'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
