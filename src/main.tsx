import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth'
import { supabaseConfigMissing } from './lib/supabase'

const root = createRoot(document.getElementById('root')!)

if (supabaseConfigMissing) {
  // Sem as variáveis de ambiente o app não sobe — mostramos um aviso legível
  // em vez de tela branca (VITE_* são injetadas no build; exige Redeploy).
  root.render(
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0c0c0c',
        color: '#f4f4f0',
        fontFamily: 'Kanit, system-ui, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Configuração ausente</h1>
        <p style={{ color: '#8a8a82', lineHeight: 1.6, fontSize: 14 }}>
          Defina <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente da Vercel
          (Settings → Environment Variables) e faça um novo deploy.
        </p>
      </div>
    </div>
  )
} else {
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  )
}
