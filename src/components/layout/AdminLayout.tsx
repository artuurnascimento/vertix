import { useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Cog,
  FileSignature,
  FileText,
  KanbanSquare,
  Link2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Magnet,
  Megaphone,
  Package,
  Radar,
  Receipt,
  ScanSearch,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Workflow,
  Wallet,
  Menu,
  X,
} from 'lucide-react'
import { MotionConfig } from 'framer-motion'
import LogoMark from '../ui/LogoMark'
import QuickSearch from './QuickSearch'
import NotificationBell from './NotificationBell'
import AvisoAtualizacao from './AvisoAtualizacao'
import { useAuth } from '../../lib/auth'
import '../../styles/vertix-admin.css'

const NAV_GROUPS = [
  {
    titulo: null,
    icone: null,
    itens: [
      { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
    ],
  },
  {
    titulo: 'Comercial',
    icone: Briefcase,
    itens: [
      { to: '/admin/clientes', label: 'Clientes', icon: Users, end: false },
      {
        to: '/admin/briefings',
        label: 'Briefings',
        icon: ClipboardList,
        end: false,
      },
      {
        to: '/admin/propostas',
        label: 'Propostas',
        icon: FileText,
        end: false,
      },
      {
        to: '/admin/contratos',
        label: 'Contratos',
        icon: FileSignature,
        end: false,
      },
    ],
  },
  {
    titulo: 'Operação',
    icone: Workflow,
    itens: [
      {
        to: '/admin/projetos',
        label: 'Projetos',
        icon: KanbanSquare,
        end: false,
      },
      { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays, end: false },
      {
        to: '/admin/financeiro',
        label: 'Financeiro',
        icon: Wallet,
        end: false,
      },
      { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy, end: false },
    ],
  },
  {
    titulo: 'Captação',
    icone: Magnet,
    itens: [
      { to: '/admin/scan', label: 'Vertix Scan', icon: Radar, end: false },
      {
        to: '/admin/leads-raiox',
        label: 'Leads Raio-X',
        icon: ScanSearch,
        end: false,
      },
      { to: '/admin/trafego', label: 'Tráfego', icon: Megaphone, end: false },
      { to: '/admin/bio', label: 'Link de bio', icon: Link2, end: false },
    ],
  },
  {
    titulo: 'Produtos',
    icone: Package,
    itens: [
      { to: '/admin/lojas', label: 'Lojas', icon: Store, end: false },
      { to: '/admin/produtos', label: 'Produtos', icon: Boxes, end: false },
      {
        to: '/admin/checkouts',
        label: 'Checkouts',
        icon: ShoppingCart,
        end: false,
      },
      { to: '/admin/pedidos', label: 'Pedidos', icon: Receipt, end: false },
    ],
  },
  {
    titulo: 'Sistema',
    icone: Cog,
    itens: [
      {
        to: '/admin/relatorios',
        label: 'Relatórios',
        icon: BarChart3,
        end: false,
      },
      {
        to: '/admin/configuracoes',
        label: 'Configurações',
        icon: Settings,
        end: false,
      },
    ],
  },
] as const

const TOP_NAV = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/clientes', label: 'Comercial', icon: Users, end: false },
  { to: '/admin/projetos', label: 'Operação', icon: KanbanSquare, end: false },
  { to: '/admin/financeiro', label: 'Financeiro', icon: Wallet, end: false },
  { to: '/admin/scan', label: 'Captação', icon: Radar, end: false },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  useEffect(() => {
    document.body.classList.add('vx-admin-theme')
    return () => document.body.classList.remove('vx-admin-theme')
  }, [])
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const menu = useRef<HTMLDialogElement>(null)
  const [signOutError, setSignOutError] = useState(false)
  const currentGroup = NAV_GROUPS.find((g) =>
    g.itens.some((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))
  )
  const isGroupActive = (label: string) =>
    label === 'Financeiro'
      ? pathname.startsWith('/admin/financeiro')
      : label === 'Operação'
        ? currentGroup?.titulo === 'Operação' &&
          !pathname.startsWith('/admin/financeiro')
        : label === 'Visão geral'
          ? pathname === '/admin'
          : currentGroup?.titulo === label
  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setSignOutError(true)
    }
  }
  const openMenu = () => menu.current?.showModal()
  const closeMenu = () => menu.current?.close()
  return (
    <MotionConfig reducedMotion="user">
      <div className="vx-admin min-h-screen text-ink">
        <div className="vx-atmosphere" aria-hidden="true" />
        <AvisoAtualizacao />
        <a href="#main-content" className="vx-skip">
          Pular para o conteúdo
        </a>
        <header className="vx-header">
          <Link
            to="/admin"
            className="vx-brand"
            aria-label="Vertix — visão geral"
          >
            <LogoMark className="h-8 w-7" />
            <span>VERTIX</span>
          </Link>
          <nav className="vx-topnav" aria-label="Áreas do sistema">
            {TOP_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={isGroupActive(item.label) ? 'is-active' : ''}
                aria-current={isGroupActive(item.label) ? 'true' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="vx-header-tools">
            <div className="vx-search">
              <QuickSearch />
            </div>
            <NotificationBell />
            <button
              type="button"
              className="vx-avatar"
              onClick={openMenu}
              aria-label="Abrir conta e menu"
            >
              {(profile?.nome ?? '?')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </button>
          </div>
        </header>
        <aside className="vx-rail" aria-label="Atalhos">
          {TOP_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className={isGroupActive(label) ? 'is-active' : ''}
            >
              <Icon size={22} />
            </Link>
          ))}
          <Link to="/admin/agenda" title="Agenda" aria-label="Agenda">
            <CalendarDays size={22} />
          </Link>
          <button
            type="button"
            onClick={openMenu}
            aria-label="Todos os módulos"
            title="Todos os módulos"
          >
            <Menu size={22} />
          </button>
          <Link
            to="/admin/configuracoes"
            className="vx-rail-settings"
            title="Configurações"
            aria-label="Configurações"
          >
            <Settings size={22} />
          </Link>
        </aside>
        <main id="main-content" className="vx-main" tabIndex={-1}>
          {pathname !== '/admin' && (
            <div className="vx-section-nav">
              {/* Só as abas da área: o nome da página é o título dela logo
                  abaixo — repetir aqui era o mesmo nome duas vezes. */}
              <nav aria-label="Módulos desta área">
                {currentGroup?.itens.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end}>
                    {i.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
          <Outlet />
        </main>
        <nav className="vx-bottom-nav" aria-label="Navegação mobile">
          <NavLink to="/admin" end>
            <LayoutDashboard />
            <span>Início</span>
          </NavLink>
          <Link
            to="/admin/clientes"
            className={currentGroup?.titulo === 'Comercial' ? 'active' : ''}
          >
            <Users />
            <span>Comercial</span>
          </Link>
          <Link
            to="/admin/projetos"
            className={pathname.startsWith('/admin/projetos') ? 'active' : ''}
          >
            <KanbanSquare />
            <span>Projetos</span>
          </Link>
          <button type="button" onClick={openMenu}>
            <Menu />
            <span>Mais</span>
          </button>
        </nav>
        <dialog
          ref={menu}
          aria-label="Todos os módulos"
          className="vx-menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMenu()
          }}
        >
          <div className="vx-menu-heading">
            <div>
              <h2>Seu workspace</h2>
              <p>
                {profile?.nome} ·{' '}
                {profile?.role === 'admin' ? 'Admin' : 'Colaborador'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeMenu}
              className="vx-icon-button"
              aria-label="Fechar menu"
            >
              <X />
            </button>
          </div>
          <QuickSearch />
          <nav
            aria-label="Todos os módulos"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) closeMenu()
            }}
          >
            {NAV_GROUPS.map((g) => (
              <section key={g.titulo ?? 'inicio'}>
                <h3>{g.titulo ?? 'Workspace'}</h3>
                <div>
                  {g.itens.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} end={end}>
                      <Icon size={19} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
          </nav>
          <button
            type="button"
            className="vx-quiet-button"
            onClick={handleSignOut}
          >
            <LogOut size={18} /> Sair da conta
          </button>
          {signOutError && (
            <p role="alert">Não foi possível sair. Tente novamente.</p>
          )}
        </dialog>
      </div>
    </MotionConfig>
  )
}
