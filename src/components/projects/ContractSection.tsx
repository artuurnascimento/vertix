import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, FileSignature, Link2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { calcProposalTotal, formatBRL } from '../../lib/commercial'
import { parseProposalItems } from '../proposals/proposalData'

type Contract = Tables<'contracts'>
type Proposal = Tables<'proposals'>

interface ContractSectionProps {
  projectId: string
  projectNome: string
  tipoServico: string
  clienteNome: string
  clienteEmpresa: string | null
}

const COPIED_FEEDBACK_MS = 2500

const dataExtensaFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function contractUrl(token: string): string {
  return `${window.location.origin}/contrato/${token}`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(value),
    template
  )
}

function formatSignedDate(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(
    date.getUTCMonth() + 1
  ).padStart(2, '0')}`
}

/**
 * Seção "Gerar contrato" — plugada na área de ações do ProjectDetail.
 * Sem contrato: gera a partir do template do tipo_servico e interpola
 * placeholders. Com contrato: mostra status e permite copiar o link.
 */
export default function ContractSection({
  projectId,
  projectNome,
  tipoServico,
  clienteNome,
  clienteEmpresa,
}: ContractSectionProps) {
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const flashCopied = () => {
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contracts', 'project', projectId],
    queryFn: async (): Promise<Contract | null> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })

  const generateMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('corpo')
        .eq('tipo_servico', tipoServico)
        .single()
      if (templateError) throw new Error(templateError.message)

      const { data: acceptedProposal } = await supabase
        .from('proposals')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'aceita')
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle<Proposal>()

      const valor = acceptedProposal
        ? formatBRL(
            calcProposalTotal(
              parseProposalItems(acceptedProposal.itens),
              acceptedProposal.desconto
            )
          )
        : 'a definir'

      const corpoFinal = interpolate(template.corpo, {
        cliente: clienteNome,
        empresa: clienteEmpresa ?? clienteNome,
        projeto: projectNome,
        valor,
        prazo: 'conforme proposta',
        data: dataExtensaFormatter.format(new Date()),
      })

      const { data: created, error: insertError } = await supabase
        .from('contracts')
        .insert({
          project_id: projectId,
          proposal_id: acceptedProposal?.id ?? null,
          corpo_final: corpoFinal,
        })
        .select('token')
        .single()
      if (insertError) throw new Error(insertError.message)

      return created.token
    },
    onSuccess: async (token) => {
      const didCopy = await copyToClipboard(contractUrl(token))
      if (didCopy) flashCopied()
      await queryClient.invalidateQueries({
        queryKey: ['contracts', 'project', projectId],
      })
    },
  })

  const handleCopyExisting = async () => {
    if (!contract) return
    const didCopy = await copyToClipboard(contractUrl(contract.token))
    if (didCopy) flashCopied()
  }

  if (isLoading) {
    return (
      <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-2" />
    )
  }

  if (!contract) {
    return (
      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1 }}
        className="flex flex-col items-end gap-2"
      >
        {generateMutation.isError && (
          <p className="text-xs text-red-400" role="alert">
            Não foi possível gerar o contrato. Tente novamente.
          </p>
        )}
        <button
          type="button"
          disabled={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs font-medium text-ink transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileSignature className="h-3.5 w-3.5 text-accent" />
          {generateMutation.isPending ? 'Gerando…' : 'Gerar contrato'}
        </button>
      </motion.div>
    )
  }

  const isSigned = contract.status === 'assinado' || Boolean(contract.signed_at)

  return (
    <div className="flex flex-col items-end gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${
          isSigned
            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
            : 'border-sky-400/20 bg-sky-400/10 text-sky-300'
        }`}
      >
        {isSigned && contract.signed_at
          ? `Assinado em ${formatSignedDate(contract.signed_at)}`
          : 'Aguardando assinatura'}
      </span>
      <button
        type="button"
        onClick={() => void handleCopyExisting()}
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs font-medium text-ink transition-colors duration-200 hover:border-accent/40 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-300" />
        ) : (
          <Link2 className="h-3.5 w-3.5 text-accent" />
        )}
        {copied ? 'Link copiado!' : 'Copiar link do contrato'}
      </button>
    </div>
  )
}
