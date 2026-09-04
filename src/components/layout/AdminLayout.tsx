import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileSignature,
  FileText,
  KanbanSquare,
  Link2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Plus,
  Radar,
  ScanSearch,
  Settings,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { motion } from 'framer-motion'
import LogoMark from '../ui/LogoMark'
import QuickSearch from './QuickSearch'
import NotificationBell from './NotificationBell'
import { useAuth } from '../../lib/auth'

const NAV_ITEMS = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/admin/projetos', label: 'Projetos', icon: KanbanSquare, end: false },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays, end: false },
  { to: '/admin/briefings', label: 'Briefings', icon: ClipboardList, end: false },
  { to: '/admin/propostas', label: 'Propostas', icon: FileText, end: false },
  { to: '/admin/contratos', label: 'Contratos', icon: FileSignature, end: false },
  { to: '/admin/financeiro', label: 'Financeiro', icon: Wallet, end: false },
  { to: '/admin/trafego', label: 'Tráfego', icon: Megaphone, end: false },
  { to: '/admin/lojas', label: 'Lojas', icon: Store, end: false },
  { to: '/admin/leads-raiox', label: 'Leads Raio-X', icon: ScanSearch, end: false },
  { to: '/admin/scan', label: 'Vertix Scan', icon: Radar, end: false },
  { to: '/admin/bio', label: 'Link de bio', icon: Link2, end: false },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3, end: false },
  { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy, end: false },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, end: false },
] as const

const SECTION_TITLES: Record<string, string> = {
  '/admin/clientes': 'Clientes',
  '/admin/projetos': 'Projetos',
  '/admin/agenda': 'Agenda',
  '/admin/briefings': 'Briefings',
  '/admin/propostas': 'Propostas',
  '/admin/contratos': 'Contratos',
  '/admin/financeiro': 'Financeiro',
  '/admin/trafego': 'Tráfego',
  '/admin/lojas': 'Lojas',
  '/admin/leads-raiox': 'Leads Raio-X',
  '/admin/scan': 'Vertix Scan',
  '/admin/bio': 'Link de bio',
  '/admin/relatorios': 'Relatórios',
  '/admin/suporte': 'Suporte',
  '/admin/configuracoes': 'Configurações',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  colaborador: 'Colaborador',
}

const ATALHOS = [
  { to: '/admin/clientes', label: 'Novo cliente' },
  { to: '/admin/projetos', label: 'Novo projeto' },
  { to: '/admin/briefings', label: 'Novo briefing' },
  { to: '/admin/propostas', label: 'Nova proposta' },
] as const

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
      <div aria-hidden className="app-ambient pointer-events-none fixed inset-0" />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-white/5 bg-surface-1 md:w-60">
        <div className="flex items-center gap-3 px-4 py-6 md:px-6">
          <LogoMark className="h-8 w-8 shrink-0" />
          <span className="hidden flex-col leading-none md:flex">
            <span className="text-lg font-bold uppercase tracking-[0.25em] text-ink">
              Vertix
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-accent">
              Admin
            </span>
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
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-[0_4px_24px_rgba(108,91,242,0.4)]'
                    : 'text-muted hover:bg-white/5 hover:text-ink',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={[
                      'h-5 w-5 shrink-0 transition-colors duration-200',
                      isActive
                        ? 'text-white'
                        : 'text-muted group-hover:text-ink',
                    ].join(' ')}
                  />
                  <span className="hidden md:inline">{label}</span>
                  {isActive && (
                    <ChevronRight className="ml-auto hidden h-4 w-4 text-white/70 md:block" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Atalhos rápidos */}
        <div className="hidden px-3 pb-4 md:block">
          <div className="rounded-xl border border-white/5 bg-surface-2/60 p-3">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted/70">
              Atalhos rápidos
            </p>
            <div className="flex flex-col gap-0.5">
              {ATALHOS.map(({ to, label }) => (
                <Link
                  key={label}
                  to={to}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:bg-accent/10 hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5 text-accent/70 transition-transform duration-200 group-hover:scale-110" />
                  {label}
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Usuário */}
        <div className="hidden border-t border-white/5 px-4 py-4 md:flex md:items-center md:gap-3">
          <span className="relative shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-2 ring-accent/30">
              {(profile?.nome ?? '?').charAt(0).toUpperCase()}
            </span>
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-1 bg-emerald-400"
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight text-ink">
              {profile?.nome}
            </p>
            <p className="text-[11px] font-light text-muted">
              {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
            </p>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-clip pl-16 md:pl-60">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-bg/80 px-6 py-4 backdrop-blur md:px-10">
          <h2 className="shrink-0 text-base font-semibold text-ink">
            {sectionTitle}
          </h2>

          <div className="hidden flex-1 justify-center px-6 md:flex">
            <QuickSearch />
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
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

        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 md:px-10 md:py-14">
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
