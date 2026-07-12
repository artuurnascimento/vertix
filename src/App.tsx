import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminLayout from './components/layout/AdminLayout'
import Login from './pages/Login'
import Clientes from './pages/Clientes'
import ClientDetail from './pages/ClientDetail'
import Projetos from './pages/Projetos'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/clientes" replace />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:id" element={<ClientDetail />} />
          <Route path="projetos" element={<Projetos />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
