import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Não lançamos erro no import (derruba o site com tela branca). O formulário de
// contato trata a falha de envio; o resto do site renderiza normalmente.
export const supabaseConfigMissing = !supabaseUrl || !supabaseAnonKey

if (supabaseConfigMissing) {
  console.error(
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Vercel → Environment Variables, depois Redeploy).',
  )
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
)
