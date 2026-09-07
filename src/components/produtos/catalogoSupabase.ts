import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

/**
 * Client das tabelas do checkout (produtos, checkouts, cupons, pedidos).
 *
 * Elas moram no MESMO projeto Supabase do painel e as policies exigem a
 * sessão da equipe, então reusamos o client principal já autenticado. O cast
 * tira a tipagem de `Database` porque lib/database.types.ts (mantido à mão)
 * ainda não conhece estas tabelas — o formato das linhas vive em
 * produtosData.ts / checkoutsData.ts e é aplicado nas queries.
 */
export const catalogoSupabase = supabase as unknown as SupabaseClient

/** Códigos que o PostgREST devolve quando a tabela ainda não existe. */
const CODIGOS_TABELA_AUSENTE = ['42P01', 'PGRST205', 'PGRST202']

/** Violação de índice único (slug repetido, código de cupom repetido). */
const CODIGO_UNICO = '23505'

/** Postgres: permissão negada / nenhuma policy de escrita para a equipe. */
const CODIGO_SEM_PERMISSAO = '42501'

function codigo(erro: unknown): string | null {
  if (typeof erro !== 'object' || erro === null) return null
  const code = (erro as Partial<PostgrestError>).code
  return typeof code === 'string' ? code : null
}

/**
 * true quando a migração do checkout ainda não rodou neste ambiente. A tela
 * usa isso para explicar o que falta em vez de mostrar "erro ao carregar".
 */
export function ehTabelaAusente(erro: unknown): boolean {
  const c = codigo(erro)
  return c !== null && CODIGOS_TABELA_AUSENTE.includes(c)
}

/**
 * true quando o banco recusou a escrita por falta de permissão.
 *
 * A migração 20260908100000_checkout.sql dá à equipe apenas SELECT nestas
 * tabelas (escrita reservada à service role). Enquanto não houver policy de
 * escrita para a equipe, o formulário salva "no vazio" e precisa dizer isso.
 */
export function ehSemPermissao(erro: unknown): boolean {
  return codigo(erro) === CODIGO_SEM_PERMISSAO
}

/** true quando o banco recusou por duplicidade (slug/código já usado). */
export function ehValorDuplicado(erro: unknown): boolean {
  return codigo(erro) === CODIGO_UNICO
}

/** Erro do PostgREST → mensagem para a pessoa, sem vazar SQL. */
export function mensagemDeErro(erro: unknown, duplicado: string): string {
  if (ehValorDuplicado(erro)) return duplicado
  if (ehSemPermissao(erro)) {
    return 'O banco só permite leitura destas tabelas para a equipe. Libere a escrita (policy de INSERT/UPDATE) antes de salvar pelo painel.'
  }
  if (ehTabelaAusente(erro)) {
    return 'As tabelas do checkout ainda não existem neste ambiente. Rode a migração antes de cadastrar.'
  }
  return 'Não foi possível salvar. Tente novamente.'
}
