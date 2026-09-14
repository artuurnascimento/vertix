import { Suspense, lazy } from 'react'
import { Navigate } from 'react-router-dom'
import { carregarPagina } from '../../lib/carregarPagina'

// Lazy, como as outras rotas: importados de forma estática, PagarPage e
// Proposta (e o zod que vem com eles) iam parar no bundle principal de
// TODAS as páginas — inclusive do checkout, que nunca os usa.
const PagarPage = lazy(() => carregarPagina(() => import('./PagarPage')))
const Proposta = lazy(() => carregarPagina(() => import('./Proposta')))

/**
 * Rota raiz /:token — o domínio decide o contexto, sem segmento de caminho:
 *   pay.vertix.studio/<token>  → página de pagamento
 *   go.vertix.studio/<token>   → proposta
 * Em qualquer outro host (sistema.), um caminho solto cai no /admin, igual ao
 * curinga. As rotas longas (/pagar/:token, /p/:token) continuam valendo.
 */

const PAY_HOST = 'pay.vertix.studio'
const GO_HOST = 'go.vertix.studio'

export default function HostToken() {
  const host = window.location.hostname

  if (host === PAY_HOST) {
    return (
      <Suspense fallback={null}>
        <PagarPage />
      </Suspense>
    )
  }
  if (host === GO_HOST) {
    return (
      <Suspense fallback={null}>
        <Proposta />
      </Suspense>
    )
  }

  return <Navigate to="/admin" replace />
}
