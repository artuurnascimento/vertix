import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import SplashScreen from './components/ui/SplashScreen'
import { isPublicLinkHost } from './lib/publicUrls'
import AdminLayout from './components/layout/AdminLayout'
import HostToken from './pages/public/HostToken'
import HostRoot, { BioRoute } from './pages/public/HostRoot'

/**
 * Telas carregadas sob demanda: sem isso, quem abre uma pagina publica
 * (link de bio, proposta, pagamento) baixa o painel inteiro junto.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Clientes = lazy(() => import('./pages/Clientes'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const Projetos = lazy(() => import('./pages/Projetos'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Propostas = lazy(() => import('./pages/Propostas'))
const Briefings = lazy(() => import('./pages/Briefings'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Contratos = lazy(() => import('./pages/Contratos'))
const Suporte = lazy(() => import('./pages/Suporte'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Trafego = lazy(() => import('./pages/Trafego'))
const Lojas = lazy(() => import('./pages/Lojas'))
const LeadsRaiox = lazy(() => import('./pages/LeadsRaiox'))
const VertixScan = lazy(() => import('./pages/VertixScan'))
const BioAdmin = lazy(() => import('./pages/Bio'))
const BriefingForm = lazy(() => import('./pages/public/BriefingForm'))
const Proposta = lazy(() => import('./pages/public/Proposta'))
const Portal = lazy(() => import('./pages/public/Portal'))
const ContractSign = lazy(() => import('./pages/public/ContractSign'))
const NpsSurvey = lazy(() => import('./pages/public/NpsSurvey'))
const PagarPage = lazy(() => import('./pages/public/PagarPage'))

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
      {/* Link de bio: rota longa válida em qualquer host (a raiz de
          bio.vertix.studio cai aqui pelo HostRoot, lá embaixo). */}
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
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="relatorios" element={<Relatorios />} />
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

      {/* Raiz: o host decide — bio.vertix.studio mostra o link de bio, os
          demais mostram o login (autenticado vai para /admin pelo Login). */}
      <Route path="/" element={<HostRoot />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
