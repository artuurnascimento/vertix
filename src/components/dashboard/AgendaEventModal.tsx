import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Trash2, X } from 'lucide-react'
import {
  AGENDA_CORES,
  dayKey,
  isoToLocalDate,
  isoToLocalTime,
  useAgendaMutations,
  useAgendaProjects,
} from './useAgenda'
import type { AgendaCor, AgendaEvent, AgendaEventFormValues } from './useAgenda'

interface AgendaEventModalProps {
  open: boolean
  /** Evento em edição — null/undefined = modo criação. */
  event?: AgendaEvent | null
  /** Dia pré-selecionado no modo criação. */
  defaultDate: Date
  onClose: () => void
}

type FieldErrors = Partial<Record<'titulo' | 'horario', string>>

const TIME_STEP_MINUTES = 15
const TIME_STEP_SECONDS = TIME_STEP_MINUTES * 60

function emptyValues(defaultDate: Date): AgendaEventFormValues {
  return {
    titulo: '',
    descricao: '',
    data: dayKey(defaultDate),
    horaInicio: '09:00',
    horaFim: '10:00',
    cor: 'accent',
    projectId: '',
  }
}

function valuesFromEvent(event: AgendaEvent): AgendaEventFormValues {
  return {
    titulo: event.titulo,
    descricao: event.descricao ?? '',
    data: isoToLocalDate(event.inicio),
    horaInicio: isoToLocalTime(event.inicio),
    horaFim: isoToLocalTime(event.fim),
    cor: (event.cor as AgendaCor) ?? 'accent',
    projectId: event.project_id ?? '',
  }
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

const COR_SWATCH_CLASSES: Record<AgendaCor, string> = {
  accent: 'bg-accent',
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
}

const COR_RING_CLASSES: Record<AgendaCor, string> = {
  accent: 'ring-accent',
  sky: 'ring-sky-400',
  emerald: 'ring-emerald-400',
  amber: 'ring-amber-400',
}

export default function AgendaEventModal({
  open,
  event,
  defaultDate,
  onClose,
}: AgendaEventModalProps) {
  const { createMutation, updateMutation, deleteMutation } =
    useAgendaMutations()
  const projectsQuery = useAgendaProjects()

  const [values, setValues] = useState<AgendaEventFormValues>(() =>
    emptyValues(defaultDate)
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isEdit = Boolean(event)
  const isSaving = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (open) {
      setValues(event ? valuesFromEvent(event) : emptyValues(defaultDate))
      setErrors({})
      setRootError(null)
      setConfirmingDelete(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event])

  useEffect(() => {
    if (!open) return
    const handleKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const setField = <K extends keyof AgendaEventFormValues>(
    field: K,
    value: AgendaEventFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const validate = (): AgendaEventFormValues | null => {
    const fieldErrors: FieldErrors = {}
    const titulo = values.titulo.trim()
    if (titulo === '') {
      fieldErrors.titulo = 'Informe o título do evento.'
    } else if (titulo.length > 120) {
      fieldErrors.titulo = 'O título pode ter no máximo 120 caracteres.'
    }

    if (values.horaFim <= values.horaInicio) {
      fieldErrors.horario = 'O horário de fim deve ser depois do início.'
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return null
    }
    setErrors({})
    return { ...values, titulo }
  }

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    setRootError(null)
    const parsed = validate()
    if (!parsed) return

    const onSuccess = () => onClose()
    const onError = () =>
      setRootError('Não foi possível salvar o evento. Tente novamente.')

    if (event) {
      updateMutation.mutate(
        { id: event.id, values: parsed },
        { onSuccess, onError }
      )
    } else {
      createMutation.mutate(parsed, { onSuccess, onError })
    }
  }

  const handleDeleteClick = () => {
    if (!event) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    deleteMutation.mutate(event.id, {
      onSuccess: () => onClose(),
      onError: () =>
        setRootError('Não foi possível excluir o evento. Tente novamente.'),
    })
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
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? 'Editar evento' : 'Novo evento'}
            className="w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {isEdit ? 'Editar evento' : 'Novo evento'}
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  {isEdit
                    ? 'Atualize os dados do compromisso.'
                    : 'Adicione um compromisso na agenda.'}
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
                <span className={labelClass}>Título *</span>
                <input
                  type="text"
                  value={values.titulo}
                  onChange={(e) => setField('titulo', e.target.value)}
                  placeholder="Reunião de alinhamento"
                  maxLength={120}
                  className={inputClass}
                />
                {errors.titulo && (
                  <span className="text-xs text-red-400">{errors.titulo}</span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Data *</span>
                <input
                  type="date"
                  value={values.data}
                  onChange={(e) => setField('data', e.target.value)}
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Início *</span>
                  <input
                    type="time"
                    step={TIME_STEP_SECONDS}
                    value={values.horaInicio}
                    onChange={(e) => setField('horaInicio', e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Fim *</span>
                  <input
                    type="time"
                    step={TIME_STEP_SECONDS}
                    value={values.horaFim}
                    onChange={(e) => setField('horaFim', e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              {errors.horario && (
                <span className="-mt-2 text-xs text-red-400">
                  {errors.horario}
                </span>
              )}

              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Cor</span>
                <div className="flex items-center gap-2.5">
                  {AGENDA_CORES.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      aria-label={`Cor ${cor}`}
                      aria-pressed={values.cor === cor}
                      onClick={() => setField('cor', cor)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 ${COR_SWATCH_CLASSES[cor]} ${
                        values.cor === cor
                          ? `ring-2 ring-offset-2 ring-offset-surface-1 ${COR_RING_CLASSES[cor]}`
                          : ''
                      }`}
                    >
                      {values.cor === cor && (
                        <Check className="h-3.5 w-3.5 text-white" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Projeto</span>
                <select
                  value={values.projectId}
                  onChange={(e) => setField('projectId', e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">Nenhum</option>
                  {(projectsQuery.data ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Descrição</span>
                <textarea
                  value={values.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  placeholder="Detalhes do compromisso…"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </label>

              {rootError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                >
                  {rootError}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-3">
                {isEdit ? (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={deleteMutation.isPending}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                      confirmingDelete
                        ? 'bg-red-500/90 text-white hover:bg-red-500'
                        : 'text-muted hover:bg-red-500/10 hover:text-red-400'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteMutation.isPending
                      ? 'Excluindo…'
                      : confirmingDelete
                        ? 'Confirmar exclusão'
                        : 'Excluir'}
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving
                      ? 'Salvando…'
                      : isEdit
                        ? 'Salvar alterações'
                        : 'Criar evento'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
