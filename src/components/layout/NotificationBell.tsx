import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bell,
  ClipboardList,
  FileText,
  LifeBuoy,
  PartyPopper,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/format'
import type { Tables } from '../../lib/database.types'

type Notification = Tables<'notifications'>

const NOTIFICATIONS_LIMIT = 20
const MAX_BADGE_COUNT = 9

interface NotificationTypeMeta {
  icon: typeof UserPlus
  iconClass: string
  boxClass: string
}

const NOTIFICATION_TYPE: Record<string, NotificationTypeMeta> = {
  lead: {
    icon: UserPlus,
    iconClass: 'text-accent',
    boxClass: 'bg-accent/15',
  },
  briefing: {
    icon: ClipboardList,
    iconClass: 'text-sky-300',
    boxClass: 'bg-sky-400/15',
  },
  proposta: {
    icon: FileText,
    iconClass: 'text-emerald-300',
    boxClass: 'bg-emerald-400/15',
  },
  pagamento: {
    icon: Wallet,
    iconClass: 'text-amber-300',
    boxClass: 'bg-amber-400/15',
  },
  ticket: {
    icon: LifeBuoy,
    iconClass: 'text-red-400',
    boxClass: 'bg-red-500/15',
  },
}

const UNKNOWN_TYPE: NotificationTypeMeta = {
  icon: Bell,
  iconClass: 'text-muted',
  boxClass: 'bg-white/5',
}

function getNotificationTypeMeta(tipo: string): NotificationTypeMeta {
  return NOTIFICATION_TYPE[tipo] ?? UNKNOWN_TYPE
}

/**
 * Sino de notificações do header — badge de não lidas, dropdown com lista
 * (últimas 20) e atualização em tempo real via Supabase Realtime.
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(NOTIFICATIONS_LIMIT)
      if (error) throw new Error(error.message)
      return data
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ lida: true })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ lida: true })
        .eq('lida', false)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const unreadCount = notifications?.filter((n) => !n.lida).length ?? 0
  const badgeLabel = unreadCount > MAX_BADGE_COUNT ? '9+' : String(unreadCount)

  const handleItemClick = (notification: Notification) => {
    if (!notification.lida) {
      markAsReadMutation.mutate(notification.id)
    }
    setIsOpen(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notificações (${unreadCount} não lidas)`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Bell className="h-4 w-4" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              aria-live="polite"
              initial={shouldReduceMotion ? undefined : { scale: 0, opacity: 0 }}
              animate={shouldReduceMotion ? undefined : { scale: 1, opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white"
            >
              {badgeLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="dropdown"
            initial={
              shouldReduceMotion
                ? undefined
                : { opacity: 0, scale: 0.95, y: -8 }
            }
            animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-surface-1 shadow-2xl shadow-black/60 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">Notificações</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {(!notifications || notifications.length === 0) && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <PartyPopper className="h-6 w-6 text-muted/50" />
                  <p className="text-sm font-light text-muted">
                    Tudo em dia por aqui
                  </p>
                </div>
              )}

              {notifications && notifications.length > 0 && (
                <ul className="flex flex-col gap-0.5 p-1.5">
                  {notifications.map((notification) => {
                    const meta = getNotificationTypeMeta(notification.tipo)
                    const Icon = meta.icon
                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(notification)}
                          className="flex min-h-11 w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.boxClass}`}
                          >
                            <Icon className={`h-4 w-4 ${meta.iconClass}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`truncate text-sm ${
                                  notification.lida
                                    ? 'text-muted'
                                    : 'font-medium text-ink'
                                }`}
                              >
                                {notification.titulo}
                              </span>
                              {!notification.lida && (
                                <span
                                  aria-hidden
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                                />
                              )}
                            </span>
                            {notification.descricao && (
                              <span className="mt-0.5 block truncate text-xs font-light text-muted">
                                {notification.descricao}
                              </span>
                            )}
                            <span className="mt-0.5 block text-[11px] text-muted/60">
                              {formatRelativeTime(notification.created_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
