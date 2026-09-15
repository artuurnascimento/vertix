import { Suspense, lazy } from 'react'
import { SITE_EM_CONSTRUCAO } from './config/site'
import EmConstrucao from './components/em-construcao/EmConstrucao'

// Com o site em construção o App real nem é baixado: só a página de aviso
// entra no bundle inicial. O App vira um chunk separado carregado sob demanda.
const App = lazy(() => import('./App'))

export default function Raiz() {
  if (SITE_EM_CONSTRUCAO) return <EmConstrucao />
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  )
}
