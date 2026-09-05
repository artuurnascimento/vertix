-- ============================================================================
-- Vertix Scan — código curto do relatório + registro de abertura
-- ============================================================================
-- O link do relatório carregava o uuid da análise (36 chars) + o token (32).
-- O código curto substitui os dois: é aleatório, único e impossível de
-- adivinhar, e leva o link de ~95 para ~41 caracteres:
--   scan.vertix.studio/r/<code>
--
-- `relatorio_aberto_em` grava a primeira abertura pelo link curto — o painel
-- passa a saber quando o cliente leu o relatório.
-- ============================================================================

alter table public.leads add column report_code text;
alter table public.leads add column relatorio_aberto_em timestamptz;

-- Busca do relatório é por este código; único para não haver colisão.
create unique index leads_report_code_key on public.leads (report_code)
  where report_code is not null;

-- A equipe lê tudo (policy existente); a escrita da abertura é do worker,
-- que usa service_role e ignora RLS.
