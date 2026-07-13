import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PartyPopper, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PortalSuccessBurst from './PortalSuccessBurst'

/**
 * Bloco de aprovação de entrega (Fase 15). Só monta quando o projeto está
 * em 'revisao' ou acabou de ser aprovado nesta sessão ('entregue' já exibe
 * o selo via ApprovedSeal, renderizado direto no Portal.tsx).
 */

interface PortalApprovalProps {
  token: string
}

function ApprovedCelebration() {
  const reducedMotion = useReducedMotion()
  return (
    <div className="relative flex flex-col items-center gap-2 py-2 text-center">
      {!reducedMotion && <PortalSuccessBurst />}
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
        <PartyPopper aria-hidden className="h-5 w-5 text-emerald-300" />
      </span>
      <p className="text-sm font-medium text-ink">Entrega aprovada!</p>
      <p className="max-w-xs text-xs font-light leading-relaxed text-muted">
        Obrigado por revisar. A equipe Vertix foi notificada.
      </p>
    </div>
  )
}

export default function PortalApproval({ token }: PortalApprovalProps) {
  const [justApproved, setJustApproved] = useState(false)
  const [rootError, setRootError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('approve_project_stage', {
        p_token: token,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setRootError(null)
      setJustApproved(true)
      queryClient.invalidateQueries({ queryKey: ['portal', token] })
    },
    onError: () => {
      setRootError('Não foi possível registrar sua aprovação. Tente novamente.')
    },
  })

  if (justApproved) return <ApprovedCelebration />

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
          <ShieldCheck aria-hidden className="h-[18px] w-[18px] text-accent" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">
            Seu projeto está pronto para revisão
          </p>
          <p className="mt-1 text-sm font-light leading-relaxed text-muted">
            Confira o resultado e aprove a entrega quando estiver tudo certo.
          </p>
          {rootError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {rootError}
            </p>
          )}
        </div>
      </div>
      <motion.button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        whileHover={mutation.isPending ? undefined : { scale: 1.02, y: -1 }}
        whileTap={mutation.isPending ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? 'Aprovando…' : 'Aprovar entrega'}
      </motion.button>
    </div>
  )
}
