import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Users,
  Wallet,
} from 'lucide-react'
import { motion } from 'framer-motion'
import LogoMark from '../ui/LogoMark'
import { useAuth } from '../../lib/auth'

const NAV_ITEMS = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/admin/projetos', label: 'Projetos', icon: KanbanSquare, end: false },
  { to: '/admin/briefings', label: 'Briefings', icon: ClipboardList, end: false },
  { to: '/admin/propostas', label: 'Propostas', icon: FileText, end: false },
  { to: '/admin/financeiro', label: 'Financeiro', icon: Wallet, end: false },
] as const

const SECTION_TITLES: Record<string, string> = {
  '/admin/clientes': 'Clientes',
  '/admin/projetos': 'Projetos',
  '/admin/briefings': 'Briefings',
  '/admin/propostas': 'Propostas',
  '/admin/financeiro': 'Financeiro',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  colaborador: 'Colaborador',
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const sectionTitle =
    Object.entries(SECTION_TITLES).find(([path]) =>
      location.pathname.startsWith(path)
    )?.[1] ?? 'Visão geral'
  const isAdmin = profile?.role === 'admin'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-bg font-kanit text-ink">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-white/5 bg-surface-1 md:w-60">
        <div className="flex items-center gap-3 px-4 py-6 md:px-6">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="hidden text-lg font-bold uppercase tracking-[0.25em] text-ink md:inline">
            Vertix
          </span>
        </div>

        <nav
          aria-label="Navegação principal"
          className="mt-4 flex flex-1 flex-col gap-1 px-2 md:px-3"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                [
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'bg-accent/10 text-ink'
                    : 'text-muted hover:bg-white/5 hover:text-ink',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                    />
                  )}
                  <Icon
                    className={[
                      'h-5 w-5 shrink-0 transition-colors duration-200',
                      isActive ? 'text-accent' : 'text-muted group-hover:text-ink',
                    ].join(' ')}
                  />
                  <span className="hidden md:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden px-6 pb-6 md:block">
          <p className="text-[10px] uppercase tracking-widest text-muted/60">
            Núcleo operacional
          </p>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-h-screen flex-1 flex-col pl-16 md:pl-60">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-bg/80 px-6 py-4 backdrop-blur md:px-10">
          <h2 className="text-base font-semibold text-ink">{sectionTitle}</h2>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-ink">
                {profile?.nome}
              </p>
            </div>
            <span
              className={[
                'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
                isAdmin
                  ? 'border-accent/25 bg-accent/10 text-accent'
                  : 'border-white/10 bg-white/5 text-muted',
              ].join(' ')}
            >
              {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sair"
              aria-label="Sair"
              className="rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 md:px-10 md:py-14">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
