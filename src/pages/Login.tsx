import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import LogoMark from '../components/ui/LogoMark'
import { useAuth } from '../lib/auth'
import { ADMIN_BASE, isPublicLinkHost } from '../lib/publicUrls'

export default function Login() {
  const { user, profile, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Login só no domínio principal — pay./go. têm CSP mais permissiva.
  if (isPublicLinkHost()) {
    window.location.replace(ADMIN_BASE)
    return null
  }

  if (!loading && user && profile) {
    return <Navigate to="/admin" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErro(null)
    setSubmitting(true)
    const signInError = await signIn(email.trim(), senha)
    setSubmitting(false)
    if (signInError) {
      setErro(signInError)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 font-kanit">
      {/* Glow ambiente do accent, mesmo vocabulário do hero do site */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 38% at 50% 18%, rgba(108,91,242,0.14), transparent 70%),' +
            'radial-gradient(40% 32% at 78% 82%, rgba(85,70,224,0.08), transparent 72%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-3 pb-8">
          <LogoMark className="h-14 w-14" />
          <div className="text-center">
            <p className="text-2xl font-bold uppercase tracking-[0.3em] text-ink">
              Vertix
            </p>
            <p className="mt-1 text-sm font-light text-muted">
              Painel administrativo
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/5 bg-surface-1 p-8 shadow-[0_24px_80px_-32px_rgba(108,91,242,0.35)]"
        >
          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-muted">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@vertix.com"
                className="rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:text-sm"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-muted">
                Senha
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 sm:text-sm"
              />
            </label>

            {erro && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
                role="alert"
              >
                {erro}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-lg bg-accent py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
