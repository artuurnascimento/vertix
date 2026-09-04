import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase do projeto Raio-X — projeto PRÓPRIO, separado do Supabase
 * do admin (src/lib/supabase.ts). Nunca misture os dois: as tabelas
 * analyses/leads moram só no projeto do raiox.
 *
 * Mesmo padrão do client do admin: não lançamos erro no import (derrubaria o
 * app com tela branca). A página checa `raioxConfigMissing` e renderiza um
 * aviso claro de configuração.
 */

const raioxUrl = import.meta.env.VITE_RAIOX_SUPABASE_URL as string | undefined
const raioxAnonKey = import.meta.env.VITE_RAIOX_SUPABASE_ANON_KEY as
  | string
  | undefined

export const raioxConfigMissing = !raioxUrl || !raioxAnonKey

export const raioxSupabase = createClient(
  raioxUrl ?? 'https://placeholder.supabase.co',
  raioxAnonKey ?? 'placeholder-anon-key'
)
