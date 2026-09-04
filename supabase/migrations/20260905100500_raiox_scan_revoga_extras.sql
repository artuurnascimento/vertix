-- ============================================================================
-- Vertix Scan — revoga privilégios herdados dos default privileges
-- ============================================================================
-- A migração 20260905100000 revogou insert/update/delete de authenticated,
-- mas os default privileges do projeto também concedem truncate, trigger e
-- references em tabela nova. TRUNCATE não passa por RLS: qualquer usuário
-- logado (mesmo fora da equipe) conseguiria esvaziar analyses/leads.
-- ============================================================================

revoke truncate, trigger, references on public.analyses from authenticated;
revoke truncate, trigger, references on public.leads from authenticated;
