import { supabase } from '../../lib/supabase'

/**
 * Client do módulo Raio-X.
 *
 * As tabelas `analyses` e `leads` foram trazidas para o MESMO projeto Supabase
 * do painel (migração 20260905100000). As policies são `to authenticated` com
 * `public.is_team_member()`, então elas exigem a SESSÃO da equipe: um client
 * anônimo separado não enxergaria linha nenhuma.
 *
 * Por isso reusamos o client principal, já autenticado. As envs
 * VITE_RAIOX_SUPABASE_URL/ANON_KEY deixaram de ser necessárias e um segundo
 * client no mesmo domínio ainda brigaria pelo storage de auth.
 */
export const raioxSupabase = supabase

/** Mantido por compatibilidade: não há mais configuração própria para faltar. */
export const raioxConfigMissing = false
