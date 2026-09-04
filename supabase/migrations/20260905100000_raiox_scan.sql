-- ============================================================================
-- Vertix Scan (Raio-X da Loja) — tabelas do worker dentro do projeto do painel
-- ============================================================================
-- Decisão (2026-09-05): o Scan não ganha projeto Supabase próprio. As tabelas
-- moram aqui, no mesmo projeto do painel, porque:
--   1. o worker (Fly, service_role) só precisa de analyses/leads;
--   2. o módulo "Leads Raio-X" do painel já lê essas tabelas via um segundo
--      client apontado por VITE_RAIOX_SUPABASE_URL/ANON_KEY — que agora apontam
--      para este mesmo projeto;
--   3. um projeto só = uma senha, uma chave, um backup.
--
-- Espelha worker/supabase/migrations/001_init.sql do repositório vertix-scan.
-- A 002 original abria leitura a `anon` (nome + WhatsApp dos leads no bundle
-- público). Aqui seguimos o padrão do painel: nada para anon, equipe via
-- public.is_team_member(). O worker usa service_role e ignora RLS.
-- ============================================================================

-- 1. Tabelas -----------------------------------------------------------------

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  domain text not null,                     -- normalizado, ex: "exemplo.com.br"
  status text not null default 'queued_light',
  -- queued_light | light_running | light_done | queued_deep | deep_running | deep_done | failed
  score numeric,                            -- 0-10, definido na análise leve
  light_result jsonb,                       -- ver LightResult no CONTRACT.md do vertix-scan
  deep_result jsonb,                        -- ver DeepResult
  error text,
  created_at timestamptz default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id),
  name text not null,
  whatsapp text not null,                   -- E.164 br: +5562...
  status text not null default 'novo',      -- novo | contatado | reuniao | cliente
  created_at timestamptz default now()
);

-- 2. Índices -----------------------------------------------------------------

-- Cache por domínio (lookup: domain + created_at > now() - 7 dias)
create index analyses_domain_created_at_idx on public.analyses (domain, created_at desc);
-- Painel filtra por status
create index leads_status_idx on public.leads (status);
-- Junção leads → analyses e detecção de abandonos (analyses sem lead)
create index leads_analysis_id_idx on public.leads (analysis_id);

-- 3. Guarda-corpo dos enums do contrato --------------------------------------

alter table public.analyses add constraint analyses_status_check check (
  status in ('queued_light','light_running','light_done','queued_deep','deep_running','deep_done','failed')
);
alter table public.leads add constraint leads_status_check check (
  status in ('novo','contatado','reuniao','cliente')
);

-- 4. Segurança ---------------------------------------------------------------
-- Os default privileges do projeto dão tudo a anon/authenticated em tabela
-- nova; aqui a gente devolve só o necessário.

alter table public.analyses enable row level security;
alter table public.leads enable row level security;

-- Visitante anônimo: nada.
revoke all on public.analyses from anon;
revoke all on public.leads from anon;

-- Equipe logada: lê tudo; a única escrita é o status do lead.
revoke insert, update, delete on public.analyses from authenticated;
revoke insert, update, delete on public.leads from authenticated;
grant select on public.analyses to authenticated;
grant select on public.leads to authenticated;
grant update (status) on public.leads to authenticated;

create policy "raiox_equipe_le_analyses" on public.analyses
  for select to authenticated
  using (public.is_team_member());

create policy "raiox_equipe_le_leads" on public.leads
  for select to authenticated
  using (public.is_team_member());

create policy "raiox_equipe_atualiza_status" on public.leads
  for update to authenticated
  using (public.is_team_member())
  with check (
    public.is_team_member()
    and status in ('novo', 'contatado', 'reuniao', 'cliente')
  );
