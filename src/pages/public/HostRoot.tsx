import { Suspense, lazy } from 'react'
import Login from '../Login'
import { ehHostBio } from '../../lib/publicUrls'

// Sob demanda: quem abre o painel não baixa o código do bio, e vice-versa.
const BioPage = lazy(() => import('./BioPage'))

/**
 * Rota raiz "/" — o domínio decide o que aparece, irmão de HostToken:
 *   vertix.bio/  → link de bio
 *   qualquer outro host → login do painel, como sempre foi
 * A rota longa /bio continua valendo em qualquer host, igual a /p/:token
 * conviver com go.vertix.studio/<token>.
 */

/** Fundo liso enquanto o pedaço do bio chega — sem pisca-pisca branco. */
function Aguardando() {
  return <div className="min-h-screen bg-bg" />
}

/** Bio em qualquer host — usada pela rota longa /bio. */
export function BioRoute() {
  return (
    <Suspense fallback={<Aguardando />}>
      <BioPage />
    </Suspense>
  )
}

export default function HostRoot() {
  if (ehHostBio(window.location.hostname)) return <BioRoute />
  return <Login />
}
