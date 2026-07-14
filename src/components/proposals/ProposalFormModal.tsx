import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { calcProposalTotal, formatBRL } from '../../lib/commercial'
import { getTipoServicoMeta } from '../../lib/format'
import {
  EMPTY_ITEM_DRAFT,
  EMPTY_PARCELA_DRAFT,
  draftFromInstallment,
  draftFromItem,
  installmentFromDraft,
  itemFromDraft,
  proposalSchema,
  toNumber,
} from './proposalSchema'
import type {
  ItemDraft,
  ParcelaDraft,
  ProposalFormValues,
} from './proposalSchema'
import {
  parseProposalInstallments,
  parseProposalItems,
  sumInstallments,
} from './proposalData'
import type { Proposal } from './proposalData'

/** staleTime alto — templates mudam raramente, evita refetch a cada abertura. */
const TEMPLATES_STALE_TIME_MS = 5 * 60 * 1000

interface ProposalTemplate {
  id: string
  tipo_servico: string
  titulo: string
  itens: ItemDraft[]
  condicoes: string
}

interface ProposalFormModalProps {
  open: boolean
  /** Proposta em edição (somente rascunho) — null/undefined = criação. */
  proposal?: Proposal | null
  /** Pré-trava o projeto (uso na seção do projeto). */
  lockedProjectId?: string
  onClose: () => void
}

interface ProjectOption {
  id: string
  nome: string
  tipo_servico: string
  clients: { nome: string } | null
}

/** Algum item já preenchido pelo usuário (descrição não vazia)? */
function hasFilledItems(itens: ItemDraft[]): boolean {
  return itens.some((item) => item.descricao.trim() !== '')
}

/** Diferença tolerada entre soma das parcelas e total (centavos). */
const PARCELAS_TOLERANCE = 0.009

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-3.5 py-2.5 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:text-sm'

const labelClass = 'text-xs font-medium uppercase tracking-widest text-muted'

const addRowButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink'

const removeRowButtonClass =
  'mt-1 shrink-0 rounded-lg p-2 text-muted/50 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30'

type FieldErrors = Record<string, string>

function buildValues(
  projectId: string,
  titulo: string,
  itens: ItemDraft[],
  desconto: string,
  condicoes: string,
  validade: string,
  parcelas: ParcelaDraft[]
): ProposalFormValues {
  return {
    project_id: projectId,
    titulo: titulo.trim(),
    itens: itens.map(itemFromDraft),
    desconto: toNumber(desconto),
    condicoes: condicoes.trim(),
    validade,
    parcelas: parcelas.map(installmentFromDraft),
  }
}

export default function ProposalFormModal({
  open,
  proposal,
  lockedProjectId,
  onClose,
}: ProposalFormModalProps) {
  const queryClient = useQueryClient()

  const [projectId, setProjectId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [itens, setItens] = useState<ItemDraft[]>([EMPTY_ITEM_DRAFT])
  const [desconto, setDesconto] = useState('')
  const [condicoes, setCondicoes] = useState('')
  const [validade, setValidade] = useState('')
  const [parcelas, setParcelas] = useState<ParcelaDraft[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [rootError, setRootError] = useState<string | null>(null)
  const [confirmingTemplate, setConfirmingTemplate] = useState(false)
  const [templateDismissed, setTemplateDismissed] = useState(false)

  const isEdit = Boolean(proposal)

  useEffect(() => {
    if (!open) return
    if (proposal) {
      setProjectId(proposal.project_id)
      setTitulo(proposal.titulo)
      const parsedItens = parseProposalItems(proposal.itens).map(draftFromItem)
      setItens(parsedItens.length > 0 ? parsedItens : [EMPTY_ITEM_DRAFT])
      setDesconto(proposal.desconto > 0 ? String(proposal.desconto) : '')
      setCondicoes(proposal.condicoes ?? '')
      setValidade(proposal.validade ?? '')
      setParcelas(
        parseProposalInstallments(proposal.parcelas).map(draftFromInstallment)
      )
    } else {
      setProjectId(lockedProjectId ?? '')
      setTitulo('')
      setItens([EMPTY_ITEM_DRAFT])
      setDesconto('')
      setCondicoes('')
      setValidade('')
      setParcelas([])
    }
    setErrors({})
    setRootError(null)
    setConfirmingTemplate(false)
    setTemplateDismissed(false)
  }, [open, proposal, lockedProjectId])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const { data: projectOptions } = useQuery({
    queryKey: ['proposals', 'projects-options'],
    enabled: open,
    queryFn: async (): Promise<ProjectOption[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nome, tipo_servico, clients(nome)')
        .order('nome')
      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: templates } = useQuery({
    queryKey: ['proposal-templates'],
    enabled: open,
    staleTime: TEMPLATES_STALE_TIME_MS,
    queryFn: async (): Promise<ProposalTemplate[]> => {
      const { data, error } = await supabase
        .from('proposal_templates')
        .select('id, tipo_servico, titulo, itens, condicoes')
      if (error) throw new Error(error.message)
      return data.map((row) => ({
        id: row.id,
        tipo_servico: row.tipo_servico,
        titulo: row.titulo,
        itens: parseProposalItems(row.itens).map(draftFromItem),
        condicoes: row.condicoes ?? '',
      }))
    },
  })

  const selectedProject = (projectOptions ?? []).find(
    (option) => option.id === projectId
  )
  const matchingTemplate = selectedProject
    ? (templates ?? []).find(
        (template) => template.tipo_servico === selectedProject.tipo_servico
      )
    : undefined
  const showTemplateBlock = Boolean(
    !isEdit && projectId && matchingTemplate && !templateDismissed
  )

  const applyTemplate = (template: ProposalTemplate) => {
    if (titulo.trim() === '') setTitulo(template.titulo)
    setItens(template.itens.map((item) => ({ ...item })))
    setCondicoes(template.condicoes)
    setConfirmingTemplate(false)
  }

  const handleUseTemplate = (template: ProposalTemplate) => {
    if (hasFilledItems(itens)) {
      setConfirmingTemplate(true)
      return
    }
    applyTemplate(template)
  }

  const mutation = useMutation({
    mutationFn: async (values: ProposalFormValues) => {
      const payload = {
        project_id: values.project_id,
        titulo: values.titulo,
        itens: values.itens.map((item) => ({
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
        })),
        desconto: values.desconto,
        valor_total: calcProposalTotal(values.itens, values.desconto),
        condicoes: values.condicoes === '' ? null : values.condicoes,
        validade: values.validade === '' ? null : values.validade,
        parcelas:
          values.parcelas.length > 0
            ? values.parcelas.map((parcela) => ({
                descricao: parcela.descricao,
                valor: parcela.valor,
                vencimento: parcela.vencimento,
              }))
            : null,
        status: 'rascunho',
      }
      if (proposal) {
        const { error } = await supabase
          .from('proposals')
          .update(payload)
          .eq('id', proposal.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('proposals').insert(payload)
        if (error) throw new Error(error.message)
      }
      return values.project_id
    },
    onSuccess: async (mutatedProjectId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({
          queryKey: ['activity', mutatedProjectId],
        }),
      ])
      onClose()
    },
    onError: () => {
      setRootError('Não foi possível salvar a proposta. Tente novamente.')
    },
  })

  const liveTotal = calcProposalTotal(
    itens.map(itemFromDraft),
    toNumber(desconto)
  )
  const liveSubtotal = calcProposalTotal(itens.map(itemFromDraft), 0)
  const parcelasSum = sumInstallments(parcelas.map(installmentFromDraft))
  const parcelasDivergem =
    parcelas.length > 0 && Math.abs(parcelasSum - liveTotal) > PARCELAS_TOLERANCE

  const setItemField = (index: number, field: keyof ItemDraft, value: string) => {
    setItens((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const setParcelaField = (
    index: number,
    field: keyof ParcelaDraft,
    value: string
  ) => {
    setParcelas((prev) =>
      prev.map((parcela, i) =>
        i === index ? { ...parcela, [field]: value } : parcela
      )
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRootError(null)
    const values = buildValues(
      projectId,
      titulo,
      itens,
      desconto,
      condicoes,
      validade,
      parcelas
    )
    const parsed = proposalSchema.safeParse(values)
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      const firstTopLevelField = ['project_id', 'titulo'].find(
        (field) => fieldErrors[field]
      )
      if (firstTopLevelField) {
        const el = event.currentTarget.elements.namedItem(firstTopLevelField)
        if (el instanceof HTMLElement) el.focus()
      }
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  const rowError = (prefix: string, index: number, fields: string[]) => {
    for (const field of fields) {
      const message = errors[`${prefix}.${index}.${field}`]
      if (message) return message
    }
    return null
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 py-6 backdrop-blur-sm"
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
            aria-label={isEdit ? 'Editar proposta' : 'Nova proposta'}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/5 bg-surface-1 p-7 font-kanit shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {isEdit ? 'Editar proposta' : 'Nova proposta'}
                </h2>
                <p className="mt-0.5 text-xs font-light text-muted">
                  {isEdit
                    ? 'Ajuste o rascunho antes de enviar ao cliente.'
                    : 'Monte itens, condições e parcelas — salva como rascunho.'}
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

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Projeto *</span>
                  <select
                    name="project_id"
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value)
                      setTemplateDismissed(false)
                      setConfirmingTemplate(false)
                    }}
                    disabled={Boolean(lockedProjectId) || isEdit}
                    className={`${inputClass} appearance-none disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <option value="">Selecionar…</option>
                    {(projectOptions ?? []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.nome}
                        {option.clients ? ` — ${option.clients.nome}` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.project_id && (
                    <span className="text-xs text-red-400">
                      {errors.project_id}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Título *</span>
                  <input
                    type="text"
                    name="titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Loja virtual — fase 1"
                    className={inputClass}
                  />
                  {errors.titulo && (
                    <span className="text-xs text-red-400">{errors.titulo}</span>
                  )}
                </label>
              </div>

              {/* Modelo de proposta (só na criação, quando há template do tipo do projeto) */}
              {showTemplateBlock && matchingTemplate && (
                <div className="flex flex-col gap-2.5 rounded-xl border border-accent/25 bg-accent/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <div>
                        <p className="text-sm font-medium text-ink">
                          Começar de um modelo
                        </p>
                        <p className="mt-0.5 text-xs font-light text-muted">
                          {getTipoServicoMeta(selectedProject?.tipo_servico ?? '')
                            .label}{' '}
                          — {matchingTemplate.titulo}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateDismissed(true)
                        setConfirmingTemplate(false)
                      }}
                      aria-label="Ignorar sugestão de modelo"
                      className="rounded-lg p-1.5 text-muted/60 transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {confirmingTemplate ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5">
                      <span className="text-xs leading-relaxed text-amber-300">
                        Substituir itens atuais?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingTemplate(false)}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate(matchingTemplate)}
                          className="rounded-lg bg-amber-400/90 px-3 py-1.5 text-xs font-semibold text-bg transition-colors duration-150 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                        >
                          Substituir itens
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUseTemplate(matchingTemplate)}
                      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Usar modelo "{matchingTemplate.titulo}"
                    </button>
                  )}
                </div>
              )}

              {/* Itens */}
              <fieldset className="rounded-xl border border-white/5 bg-surface-2/40 p-4">
                <legend className={`${labelClass} px-1`}>Itens *</legend>
                <div className="flex flex-col gap-3">
                  {itens.map((item, index) => {
                    const subtotal =
                      toNumber(item.quantidade) * toNumber(item.valor_unitario)
                    const error = rowError('itens', index, [
                      'descricao',
                      'quantidade',
                      'valor_unitario',
                    ])
                    return (
                      <div key={index} className="flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) =>
                              setItemField(index, 'descricao', e.target.value)
                            }
                            placeholder="Descrição do item"
                            aria-label={`Descrição do item ${index + 1}`}
                            className={`${inputClass} flex-1`}
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantidade}
                            onChange={(e) =>
                              setItemField(index, 'quantidade', e.target.value)
                            }
                            placeholder="Qtd"
                            aria-label={`Quantidade do item ${index + 1}`}
                            className={`${inputClass} w-16 px-2 text-center sm:w-20`}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.valor_unitario}
                            onChange={(e) =>
                              setItemField(
                                index,
                                'valor_unitario',
                                e.target.value
                              )
                            }
                            placeholder="Valor unit."
                            aria-label={`Valor unitário do item ${index + 1}`}
                            className={`${inputClass} w-24 sm:w-32`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItens((prev) =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                            disabled={itens.length === 1}
                            aria-label={`Remover item ${index + 1}`}
                            className={removeRowButtonClass}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between pl-1">
                          {error ? (
                            <span className="text-xs text-red-400">{error}</span>
                          ) : (
                            <span />
                          )}
                          <span className="text-xs tabular-nums text-muted">
                            Subtotal:{' '}
                            <span className="font-medium text-ink/80">
                              {formatBRL(subtotal)}
                            </span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {errors.itens && (
                  <p className="mt-2 text-xs text-red-400">{errors.itens}</p>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setItens((prev) => [...prev, { ...EMPTY_ITEM_DRAFT }])
                  }
                  className={`${addRowButtonClass} mt-3`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar item
                </button>
              </fieldset>

              {/* Desconto + Total ao vivo */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <label className="flex w-40 flex-col gap-1.5">
                  <span className={labelClass}>Desconto (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    placeholder="0,00"
                    className={inputClass}
                  />
                  {errors.desconto && (
                    <span className="text-xs text-red-400">
                      {errors.desconto}
                    </span>
                  )}
                </label>
                <div className="text-right">
                  {toNumber(desconto) > 0 && (
                    <p className="text-xs font-light tabular-nums text-muted">
                      Subtotal {formatBRL(liveSubtotal)} − desconto{' '}
                      {formatBRL(toNumber(desconto))}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs uppercase tracking-widest text-muted">
                    Total
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-accent">
                    {formatBRL(liveTotal)}
                  </p>
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Condições</span>
                <textarea
                  value={condicoes}
                  onChange={(e) => setCondicoes(e.target.value)}
                  rows={3}
                  placeholder="Prazo de entrega, forma de pagamento, o que está incluso…"
                  className={`${inputClass} min-h-20 resize-y leading-relaxed`}
                />
              </label>

              <label className="flex w-full max-w-48 flex-col gap-1.5">
                <span className={labelClass}>Validade</span>
                <input
                  type="date"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                />
              </label>

              {/* Parcelas */}
              <fieldset className="rounded-xl border border-white/5 bg-surface-2/40 p-4">
                <legend className={`${labelClass} px-1`}>Parcelas</legend>
                {parcelas.length === 0 && (
                  <p className="text-xs font-light text-muted">
                    Opcional — ao aceitar, cada parcela vira uma conta a
                    receber.
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {parcelas.map((parcela, index) => {
                    const error = rowError('parcelas', index, [
                      'descricao',
                      'valor',
                      'vencimento',
                    ])
                    return (
                      <div key={index} className="flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <input
                            type="text"
                            value={parcela.descricao}
                            onChange={(e) =>
                              setParcelaField(index, 'descricao', e.target.value)
                            }
                            placeholder="Entrada (50%)"
                            aria-label={`Descrição da parcela ${index + 1}`}
                            className={`${inputClass} flex-1`}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={parcela.valor}
                            onChange={(e) =>
                              setParcelaField(index, 'valor', e.target.value)
                            }
                            placeholder="Valor"
                            aria-label={`Valor da parcela ${index + 1}`}
                            className={`${inputClass} w-24 sm:w-32`}
                          />
                          <input
                            type="date"
                            value={parcela.vencimento}
                            onChange={(e) =>
                              setParcelaField(
                                index,
                                'vencimento',
                                e.target.value
                              )
                            }
                            aria-label={`Vencimento da parcela ${index + 1}`}
                            className={`${inputClass} w-36 [color-scheme:dark] sm:w-40`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setParcelas((prev) =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                            aria-label={`Remover parcela ${index + 1}`}
                            className={removeRowButtonClass}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {error && (
                          <span className="pl-1 text-xs text-red-400">
                            {error}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setParcelas((prev) => [...prev, { ...EMPTY_PARCELA_DRAFT }])
                  }
                  className={`${addRowButtonClass} mt-3`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar parcela
                </button>
                {parcelasDivergem && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      A soma das parcelas ({formatBRL(parcelasSum)}) difere do
                      total da proposta ({formatBRL(liveTotal)}).
                    </span>
                  </p>
                )}
              </fieldset>

              {rootError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                >
                  {rootError}
                </p>
              )}

              <div className="mt-1 flex justify-end gap-3">
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
                      : 'Criar rascunho'}
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
