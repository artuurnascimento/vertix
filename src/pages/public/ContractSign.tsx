import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileSignature, LinkIcon, ShieldCheck } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'
import {
  parseContractByToken,
  parseSignContractResult,
  formatDateTimeBR,
} from '../../components/portal/contractData'
import type { ContractData } from '../../components/portal/contractData'

/**
 * Página pública de assinatura de contrato (Fase 10). Mesmo padrão visual
 * e de estados (loading / link inválido) de Portal.tsx e Proposta.tsx —
 * card central, sem editar as páginas existentes.
 */

/** Código Postgres para uuid malformado — tratado como link inválido. */
const INVALID_UUID_CODE = '22P02'

const EASE_OUT = [0.25, 0.1, 0.25, 1] as const

const inputClass =
  'w-full rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-10 font-kanit sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-[720px]">
        <header className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

function StatusScreen({
  icon,
  title,
  message,
}: {
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        {icon}
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          {message}
        </p>
      </motion.div>
    </Shell>
  )
}

function SuccessCheck() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
      <motion.svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <motion.path
          d="M4 12.5 9.5 18 20 6.5"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        />
      </motion.svg>
    </span>
  )
}

function InvalidLinkScreen() {
  return (
    <StatusScreen
      icon={
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LinkIcon className="h-6 w-6 text-muted" />
        </span>
      }
      title="Link inválido ou expirado"
      message="Este link de contrato não é válido. Peça um novo link para a equipe Vertix."
    />
  )
}

function SignedScreen({ signerName, signedAt }: { signerName: string; signedAt: string }) {
  return (
    <StatusScreen
      icon={<SuccessCheck />}
      title="Contrato assinado"
      message={`Assinado por ${signerName} em ${formatDateTimeBR(signedAt)}.`}
    />
  )
}

function respondErrorMessage(): string {
  return 'Não foi possível registrar sua assinatura. Tente novamente.'
}

function ContractBody({ contract }: { contract: ContractData }) {
  return (
    <div className="mt-8 rounded-2xl border border-white/5 bg-surface-1 p-5 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-8">
      <p className="whitespace-pre-wrap text-sm font-light leading-relaxed text-ink/85">
        {contract.corpo_final}
      </p>
    </div>
  )
}

function AlreadySignedBadge({ contract }: { contract: ContractData }) {
  if (contract.status !== 'assinado' || !contract.signer_name) return null
  return (
    <div className="mt-6 flex items-center gap-3.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
        <ShieldCheck aria-hidden className="h-[18px] w-[18px] text-emerald-300" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          Assinado por {contract.signer_name}
        </p>
        {contract.signed_at && (
          <p className="mt-0.5 text-xs font-light text-muted">
            em {formatDateTimeBR(contract.signed_at)}
          </p>
        )}
      </div>
    </div>
  )
}

interface SignFormProps {
  token: string
  onSigned: (result: { signerName: string; signedAt: string }) => void
}

function SignForm({ token, onSigned }: SignFormProps) {
  const [agreed, setAgreed] = useState(false)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: payload, error } = await supabase.rpc('sign_contract', {
        p_token: token,
        p_signer_name: nome.trim(),
        p_signer_document: documento.trim(),
      })
      if (error) throw new Error(error.message)
      return parseSignContractResult(payload)
    },
    onSuccess: (result) => {
      if (result.success) {
        onSigned({ signerName: nome.trim(), signedAt: new Date().toISOString() })
        return
      }
      setRootError(respondErrorMessage())
    },
    onError: () => {
      setRootError(respondErrorMessage())
    },
  })

  const canSubmit = agreed && nome.trim() !== '' && !mutation.isPending

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '') {
      setNomeError('Informe seu nome completo para assinar.')
      return
    }
    if (!agreed) return
    setNomeError(null)
    setRootError(null)
    mutation.mutate()
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-8"
    >
      <h2 className="text-base font-semibold text-ink">Assinar contrato</h2>
      <p className="mt-1 text-sm font-light text-muted">
        Confirme seus dados para formalizar o aceite deste contrato.
      </p>

      <label className="mt-5 flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">
          Nome completo
          <span aria-hidden className="ml-1 text-accent">
            *
          </span>
        </span>
        <input
          type="text"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value)
            if (nomeError) setNomeError(null)
          }}
          placeholder="Maria da Silva"
          aria-invalid={Boolean(nomeError)}
          className={inputClass}
        />
        {nomeError && <span className="text-xs text-red-400">{nomeError}</span>}
      </label>

      <label className="mt-4 flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">CPF/CNPJ</span>
        <input
          type="text"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="Opcional"
          className={inputClass}
        />
      </label>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-surface-2 text-accent accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <span className="text-sm font-light leading-relaxed text-ink/85">
          Li e concordo com os termos deste contrato.
        </span>
      </label>

      {rootError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          {rootError}
        </p>
      )}

      <motion.button
        type="submit"
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.02, y: -1 } : undefined}
        whileTap={canSubmit ? { scale: 0.98 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <FileSignature aria-hidden className="h-4 w-4" />
        {mutation.isPending ? 'Assinando…' : 'Assinar contrato'}
      </motion.button>
    </form>
  )
}

export default function ContractSign() {
  const { token } = useParams<{ token: string }>()
  const [signedLocally, setSignedLocally] = useState<{
    signerName: string
    signedAt: string
  } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contract', token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc(
        'get_contract_by_token',
        { p_token: token ?? '' }
      )
      if (error) {
        if (error.code === INVALID_UUID_CODE) return null
        throw new Error(error.message)
      }
      return parseContractByToken(payload)
    },
  })

  if (signedLocally) {
    return (
      <SignedScreen
        signerName={signedLocally.signerName}
        signedAt={signedLocally.signedAt}
      />
    )
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="mt-14 sm:mt-20" aria-label="Carregando contrato">
          <div className="h-9 w-64 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface-1" />
        </div>
      </Shell>
    )
  }

  if (isError || !data) return <InvalidLinkScreen />

  const jaAssinado = data.status === 'assinado'

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mt-10 sm:mt-14"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-accent">
          Contrato
        </p>
        <h1 className="hero-heading mt-2 text-3xl font-bold leading-tight sm:text-4xl">
          Contrato — {data.projeto_nome}
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted">
          {data.cliente.nome}
          {data.cliente.empresa && ` — ${data.cliente.empresa}`}
        </p>

        {jaAssinado && <AlreadySignedBadge contract={data} />}

        <ContractBody contract={data} />

        {!jaAssinado && (
          <SignForm token={token ?? ''} onSigned={setSignedLocally} />
        )}
      </motion.div>
    </Shell>
  )
}
