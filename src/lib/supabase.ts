import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Flag de configuração ausente. NÃO lançamos erro no import (isso derruba o app
 * inteiro com tela branca): main.tsx checa esta flag e renderiza uma tela de
 * erro legível. O client é criado com placeholders só para não quebrar o import.
 */
export const supabaseConfigMissing = !supabaseUrl || !supabaseAnonKey

if (supabaseConfigMissing) {
  console.error(
    'Variáveis de ambiente ausentes: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Vercel → Settings → Environment Variables, depois Redeploy).'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
)
