import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import SplashScreen from './components/ui/SplashScreen'
import FronteiraDeErro from './components/ui/FronteiraDeErro'
import { isPublicLinkHost } from './lib/publicUrls'
import { carregarPagina } from './lib/carregarPagina'
import HostToken from './pages/public/HostToken'
import HostRoot, { BioRoute } from './pages/public/HostRoot'

/**
 * Telas carregadas sob demanda: sem isso, quem abre uma pagina publica
 * (link de bio, proposta, pagamento) baixa o painel inteiro junto.
 */
// A moldura do painel também: ela traz o framer-motion e o CSS do admin, que
// o checkout e as outras páginas públicas não usam. O <Suspense> lá embaixo
// já cobre; o primeiro /admin paga uma ida a mais, escondida pelo Splash.
const AdminLayout = lazy(() => carregarPagina(() => import('./components/layout/AdminLayout')))
const Dashboard = lazy(() => carregarPagina(() => import('./pages/Dashboard')))
const Clientes = lazy(() => carregarPagina(() => import('./pages/Clientes')))
const ClientDetail = lazy(() => carregarPagina(() => import('./pages/ClientDetail')))
const Projetos = lazy(() => carregarPagina(() => import('./pages/Projetos')))
const ProjectDetail = lazy(() => carregarPagina(() => import('./pages/ProjectDetail')))
const Agenda = lazy(() => carregarPagina(() => import('./pages/Agenda')))
const Propostas = lazy(() => carregarPagina(() => import('./pages/Propostas')))
const Briefings = lazy(() => carregarPagina(() => import('./pages/Briefings')))
const Financeiro = lazy(() => carregarPagina(() => import('./pages/Financeiro')))
const Relatorios = lazy(() => carregarPagina(() => import('./pages/Relatorios')))
const Automacoes = lazy(() => carregarPagina(() => import('./pages/Automacoes')))
const Contratos = lazy(() => carregarPagina(() => import('./pages/Contratos')))
const Suporte = lazy(() => carregarPagina(() => import('./pages/Suporte')))
const Configuracoes = lazy(() => carregarPagina(() => import('./pages/Configuracoes')))
const Trafego = lazy(() => carregarPagina(() => import('./pages/Trafego')))
const Lojas = lazy(() => carregarPagina(() => import('./pages/Lojas')))
const LeadsRaiox = lazy(() => carregarPagina(() => import('./pages/LeadsRaiox')))
const VertixScan = lazy(() => carregarPagina(() => import('./pages/VertixScan')))
const BioAdmin = lazy(() => carregarPagina(() => import('./pages/Bio')))
const BriefingForm = lazy(() => carregarPagina(() => import('./pages/public/BriefingForm')))
const Proposta = lazy(() => carregarPagina(() => import('./pages/public/Proposta')))
const Portal = lazy(() => carregarPagina(() => import('./pages/public/Portal')))
const ContractSign = lazy(() => carregarPagina(() => import('./pages/public/ContractSign')))
const NpsSurvey = lazy(() => carregarPagina(() => import('./pages/public/NpsSurvey')))
const PagarPage = lazy(() => carregarPagina(() => import('./pages/public/PagarPage')))
const CheckoutPage = lazy(() => carregarPagina(() => import('./pages/public/CheckoutPage')))
const UpsellPage = lazy(() => carregarPagina(() => import('./pages/public/UpsellPage')))
const ObrigadoPage = lazy(() => carregarPagina(() => import('./pages/public/ObrigadoPage')))
const TermosPage = lazy(() => carregarPagina(() => import('./pages/public/TermosPage')))
const PrivacidadePage = lazy(() => carregarPagina(() => import('./pages/public/PrivacidadePage')))
const Produtos = lazy(() => carregarPagina(() => import('./pages/Produtos')))
const Checkouts = lazy(() => carregarPagina(() => import('./pages/Checkouts')))
const Pedidos = lazy(() => carregarPagina(() => import('./pages/Pedidos')))

const SPLASH_SESSION_KEY = 'vx-splash-shown'

function splashAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markSplashShown(): void {
  try {
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1')
  } catch {
    // Storage indisponível (modo privado restrito) — splash repete, sem quebrar.
  }
}

/** Splash só na superfície do painel (login + /admin), nunca nas páginas
 *  públicas tokenizadas nem nos hosts pay./go. — e uma vez por sessão. */
function shouldShowSplash(): boolean {
  const path = window.location.pathname
  const isAdminSurface =
    path === '/' || path === '/admin' || path.startsWith('/admin/')
  return isAdminSurface && !isPublicLinkHost() && !splashAlreadyShown()
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowSplash)

  return (
    <>
      {showSplash && (
        <SplashScreen
          onDone={() => {
            markSplashShown()
            setShowSplash(false)
          }}
        />
      )}
      {/* Fronteira por fora do Suspense: um chunk que falhou duas vezes (ver
          lib/carregarPagina) ou qualquer erro de render vira uma tela com
          saída, não o <div id="root"> vazio. */}
      <FronteiraDeErro>
      <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Routes>
      {/* /login antigo redireciona para a raiz (o login mora em "/"). */}
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* Páginas públicas tokenizadas — sem autenticação. */}
      <Route path="/briefing/:token" element={<BriefingForm />} />
      <Route path="/proposta/:token" element={<Proposta />} />
      <Route path="/p/:token" element={<Proposta />} />
      <Route path="/:token" element={<HostToken />} />
      <Route path="/portal/:token" element={<Portal />} />
      <Route path="/contrato/:token" element={<ContractSign />} />
      <Route path="/nps/:token" element={<NpsSurvey />} />
      <Route path="/pagar/:token" element={<PagarPage />} />
      {/* Checkout de produto (slug público) e as duas telas do pós-venda.
          Rotas de 2+ segmentos: não conflitam com o /:token do HostToken. */}
      <Route path="/c/:slug" element={<CheckoutPage />} />
      <Route path="/c/:slug/upsell/:pedidoId" element={<UpsellPage />} />
      <Route path="/c/:slug/obrigado/:pedidoId" element={<ObrigadoPage />} />
      <Route path="/termos" element={<TermosPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      {/* Link de bio: rota longa válida em qualquer host (a raiz de
          vertix.bio cai aqui pelo HostRoot, lá embaixo). */}
      <Route path="/bio" element={<BioRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:id" element={<ClientDetail />} />
          <Route path="projetos" element={<Projetos />} />
          <Route path="projetos/:id" element={<ProjectDetail />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="briefings" element={<Briefings />} />
          <Route path="propostas" element={<Propostas />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="checkouts" element={<Checkouts />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="automacoes" element={<Automacoes />} />
          <Route path="contratos" element={<Contratos />} />
          <Route path="suporte" element={<Suporte />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="trafego" element={<Trafego />} />
          <Route path="lojas" element={<Lojas />} />
          <Route path="leads-raiox" element={<LeadsRaiox />} />
          <Route path="scan" element={<VertixScan />} />
          <Route path="bio" element={<BioAdmin />} />
        </Route>
      </Route>

      {/* Raiz: o host decide — vertix.bio mostra o link de bio, os
          demais mostram o login (autenticado vai para /admin pelo Login). */}
      <Route path="/" element={<HostRoot />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      </Suspense>
      </FronteiraDeErro>
    </>
  )
}
