import { Navigate } from 'react-router-dom'
import PagarPage from './PagarPage'
import Proposta from './Proposta'

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

  if (host === PAY_HOST) return <PagarPage />
  if (host === GO_HOST) return <Proposta />

  return <Navigate to="/admin" replace />
}
