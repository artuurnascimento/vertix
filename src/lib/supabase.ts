import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente ausentes: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
