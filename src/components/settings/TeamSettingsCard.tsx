import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import InviteUserModal from './InviteUserModal'

type Profile = Tables<'profiles'>

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  colaborador: 'Colaborador',
}

interface TeamSettingsCardProps {
  isAdmin: boolean
}

export default function TeamSettingsCard({ isAdmin }: TeamSettingsCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const [inviteOpen, setInviteOpen] = useState(false)

  const { data: profiles, isLoading, isError } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return data
    },
  })

  return (
    <motion.section
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1], delay: prefersReducedMotion ? 0 : 0.1 }}
      className="rounded-2xl border border-white/5 bg-surface-1 p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Equipe</h2>
          <p className="mt-0.5 text-xs font-light text-muted">
            Pessoas com acesso ao painel administrativo.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2"
          >
            <UserPlus className="h-4 w-4" />
            Convidar
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-surface-2"
              style={{ opacity: 1 - i * 0.25 }}
            />
          ))}

        {isError && (
          <p className="rounded-xl border border-white/5 bg-surface-2 px-4 py-6 text-center text-sm text-red-400">
            Não foi possível carregar a equipe. Recarregue a página.
          </p>
        )}

        {!isLoading && !isError && profiles?.length === 0 && (
          <p className="rounded-xl border border-white/5 bg-surface-2 px-4 py-6 text-center text-sm text-muted">
            Nenhum membro cadastrado ainda.
          </p>
        )}

        {!isLoading &&
          !isError &&
          profiles?.map((member) => {
            const roleIsAdmin = member.role === 'admin'
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-surface-2/60 px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-2 ring-accent/30">
                  {member.nome.charAt(0).toUpperCase()}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {member.nome}
                </p>
                <span
                  className={[
                    'shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
                    roleIsAdmin
                      ? 'border-accent/25 bg-accent/10 text-accent'
                      : 'border-white/10 bg-white/5 text-muted',
                  ].join(' ')}
                >
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </div>
            )
          })}
      </div>

      {isAdmin && (
        <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      )}
    </motion.section>
  )
}
