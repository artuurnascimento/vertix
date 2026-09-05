import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

/**
 * Client do módulo Raio-X.
 *
 * As tabelas `analyses` e `leads` foram trazidas para o MESMO projeto Supabase
 * do painel (migração 20260905100000). As policies são `to authenticated` com
 * `public.is_team_member()`, então exigem a SESSÃO da equipe: um client
 * anônimo separado não enxergaria linha nenhuma.
 *
 * Reusamos o client principal, já autenticado. O cast tira a tipagem de
 * `Database` (mantida à mão em lib/database.types.ts, sem estas duas tabelas);
 * as formas das linhas vivem em `raioxTypes.ts` e são aplicadas nas queries.
 */
export const raioxSupabase = supabase as unknown as SupabaseClient

/** Mantido por compatibilidade: não há mais configuração própria para faltar. */
export const raioxConfigMissing = false
