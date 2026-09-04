import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import {
  BIO_FORMATOS,
  BIO_FORMATO_LABEL,
  BIO_TIPOS_DESTINO,
  BIO_TIPO_DESTINO_LABEL,
  bioLinkFormToPayload,
  bioLinkSchema,
} from '../../lib/schemas'
import type { BioLinkFormValues } from '../../lib/schemas'

/** Criar e editar um botão do link de bio (padrão do ClientFormModal). */

type BioLinkRow = Tables<'bio_links'>

interface BioLinkModalProps {
  open: boolean
  /** Botão em edição — null/undefined = modo criação. */
  link?: BioLinkRow | null
  /** Posição sugerida para o novo botão (fim da lista). */
  proximaPosicao: number
  onClose: () => void
}

type FieldErrors = Partial<Record<keyof BioLinkFormValues, string>>

const ICONES_SUGERIDOS = [
  'radar',
  'message-circle',
  'store',
  'settings',
  'layout',
  'layers',
]

const EMPTY_VALUES: BioLinkFormValues = {
  rotulo: '',
  descricao: '',
  icone: '',
  formato: 'grade',
  tipo_destino: 'url',
  destino: '',
  mensagem: '',
  ativo: true,
}

function valuesFromLink(link: BioLinkRow): BioLinkFormValues {
  const formato = BIO_FORMATOS.find((f) => f === link.formato) ?? 'grade'
  const tipo = BIO_TIPOS_DESTINO.find((t) => t === link.tipo_destino) ?? 'url'
  return {
    rotulo: link.rotulo,
    descricao: link.descricao ?? '',
    icone: link.icone ?? '',
    formato,
    tipo_destino: tipo,
    destino: link.destino,
    mensagem: link.mensagem ?? '',
    ativo: link.ativo,
  }
}

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:py-2.5 sm:text-sm'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

export default function BioLinkModal({
  open,
  link,
  proximaPosicao,
  onClose,
}: BioLinkModalProps) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<BioLinkFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)

  const isEdit = Boolean(link)

  useEffect(() => {
    if (open) {
      setValues(link ? valuesFromLink(link) : EMPTY_VALUES)
      setErrors({})
      setRootError(null)
    }
  }, [open, link])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const mutation = useMutation({
    mutationFn: async (formValues: BioLinkFormValues) => {
      const payload = bioLinkFormToPayload(formValues)
      if (link) {
        const { error } = await supabase
          .from('bio_links')
          .update(payload)
          .eq('id', link.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('bio_links')
          .insert({ ...payload, posicao: proximaPosicao })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bio-links-admin'] })
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível salvar o botão. Tente novamente.')
    },
  })

  const setField = <K extends keyof BioLinkFormValues>(
    field: K,
    value: BioLinkFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const parsed = bioLinkSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof BioLinkFormValues
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      const primeiro = Object.keys(fieldErrors)[0]
      if (primeiro) {
        const el = event.currentTarget.elements.namedItem(primeiro)
        if (el instanceof HTMLElement) el.focus()
      }
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  const ehConversa = values.tipo_destino === 'whatsapp'

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-bg/70 px-4 py-8 backdrop-blur-sm"
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
            aria-label={isEdit ? 'Editar botão' : 'Novo botão'}
            className="my-auto w-full max-w-md rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {isEdit ? 'Editar botão' : 'Novo botão'}
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  A página pública reflete a mudança na hora, sem publicar de novo.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Texto do botão *</span>
                <input
                  type="text"
                  name="rotulo"
                  value={values.rotulo}
                  onChange={(e) => setField('rotulo', e.target.value)}
                  placeholder="Loja Shopify"
                  className={inputClass}
                />
                {errors.rotulo && (
                  <span className="text-xs text-red-400">{errors.rotulo}</span>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Linha de apoio</span>
                <input
                  type="text"
                  value={values.descricao}
                  onChange={(e) => setField('descricao', e.target.value)}
                  placeholder="Do zero ou migração"
                  className={inputClass}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Formato</span>
                  <select
                    value={values.formato}
                    onChange={(e) =>
                      setField(
                        'formato',
                        e.target.value as BioLinkFormValues['formato']
                      )
                    }
                    className={`${inputClass} appearance-none`}
                  >
                    {BIO_FORMATOS.map((f) => (
                      <option key={f} value={f}>
                        {BIO_FORMATO_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Ícone</span>
                  <select
                    value={values.icone}
                    onChange={(e) => setField('icone', e.target.value)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Nenhum</option>
                    {ICONES_SUGERIDOS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Tipo de destino</span>
                <select
                  value={values.tipo_destino}
                  onChange={(e) =>
                    setField(
                      'tipo_destino',
                      e.target.value as BioLinkFormValues['tipo_destino']
                    )
                  }
                  className={`${inputClass} appearance-none`}
                >
                  {BIO_TIPOS_DESTINO.map((t) => (
                    <option key={t} value={t}>
                      {BIO_TIPO_DESTINO_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>
                  {ehConversa ? 'Número com DDD' : 'Endereço'}
                </span>
                <input
                  type="text"
                  name="destino"
                  value={values.destino}
                  onChange={(e) => setField('destino', e.target.value)}
                  placeholder={
                    ehConversa ? '(62) 99607-6194' : 'https://www.vertix.studio'
                  }
                  className={inputClass}
                />
                {errors.destino && (
                  <span className="text-xs text-red-400">{errors.destino}</span>
                )}
              </label>

              {ehConversa && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Mensagem pronta</span>
                  <textarea
                    rows={2}
                    value={values.mensagem}
                    onChange={(e) => setField('mensagem', e.target.value)}
                    placeholder="Oi, Vertix! Quero falar sobre uma loja Shopify."
                    className={inputClass}
                  />
                  <span className="text-xs font-light text-muted">
                    Deixe vazio para abrir a conversa sem texto.
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={values.ativo}
                  onChange={(e) => setField('ativo', e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                <span className="text-sm font-light text-ink">
                  Mostrar na página
                </span>
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
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mutation.isPending
                    ? 'Salvando…'
                    : isEdit
                      ? 'Salvar alterações'
                      : 'Criar botão'}
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
