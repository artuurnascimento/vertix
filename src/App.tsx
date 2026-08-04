import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminLayout from './components/layout/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import ClientDetail from './pages/ClientDetail'
import Projetos from './pages/Projetos'
import ProjectDetail from './pages/ProjectDetail'
import Agenda from './pages/Agenda'
import Propostas from './pages/Propostas'
import Briefings from './pages/Briefings'
import Financeiro from './pages/Financeiro'
import Relatorios from './pages/Relatorios'
import Contratos from './pages/Contratos'
import Suporte from './pages/Suporte'
import Configuracoes from './pages/Configuracoes'
import Trafego from './pages/Trafego'
import BriefingForm from './pages/public/BriefingForm'
import Proposta from './pages/public/Proposta'
import Portal from './pages/public/Portal'
import ContractSign from './pages/public/ContractSign'
import NpsSurvey from './pages/public/NpsSurvey'
import PagarPage from './pages/public/PagarPage'
import HostToken from './pages/public/HostToken'

export default function App() {
  return (
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
        </Route>
      </Route>

      {/* Raiz = login (autenticado é redirecionado para /admin pelo próprio Login). */}
      <Route path="/" element={<Login />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
