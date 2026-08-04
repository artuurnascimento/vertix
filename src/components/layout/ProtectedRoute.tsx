import { Navigate, Outlet } from 'react-router-dom'
import LogoMark from '../ui/LogoMark'
import { useAuth } from '../../lib/auth'
import { ADMIN_BASE, isPublicLinkHost } from '../../lib/publicUrls'

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth()

  // O painel admin só roda no domínio principal, sob a CSP estrita.
  if (isPublicLinkHost()) {
    window.location.replace(`${ADMIN_BASE}${window.location.pathname}`)
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
