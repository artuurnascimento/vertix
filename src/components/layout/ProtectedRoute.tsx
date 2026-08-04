import { Navigate, Outlet } from 'react-router-dom'
import LogoMark from '../ui/LogoMark'
import { useAuth } from '../../lib/auth'

// Domínios de link público têm CSP mais permissiva (SDK do Mercado Pago).
// O painel admin só roda no domínio principal, sob a CSP estrita.
const PUBLIC_LINK_HOSTS = ['pay.vertix.studio', 'go.vertix.studio']

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth()

  if (PUBLIC_LINK_HOSTS.includes(window.location.hostname)) {
    window.location.replace(
      `https://sistema.vertix.studio${window.location.pathname}`
    )
    return null
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <LogoMark className="h-12 w-12 animate-pulse" />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
