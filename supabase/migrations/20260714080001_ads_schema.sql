-- =============================================================================
-- Vertix Admin — Gestão de Tráfego (Meta Ads), parte 1: schema
-- ad_accounts + ad_metrics_daily. RLS: ad_accounts é CRUD do time
-- (padrão agenda_events); ad_metrics_daily é SELECT do time apenas — a
-- escrita é feita exclusivamente pela edge function sync-ad-metrics via
-- service role (sem policy de insert/update/delete para authenticated).
-- Também amplia o check de notifications.tipo para incluir 'trafego'
-- (notificação de falha de sincronização).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome text not null,
  meta_account_id text not null unique,
  status text not null default 'ativo'
    check (status in ('ativo', 'pausado')),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  last_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);

create table public.ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  data date not null,
  gasto numeric(12,2) not null default 0,
  impressoes bigint default 0,
  cliques integer default 0,
  conversoes integer default 0,
  receita numeric(12,2) default 0,
  unique (ad_account_id, data)
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

create index idx_ad_accounts_client_id on public.ad_accounts (client_id);
create index idx_ad_accounts_status on public.ad_accounts (status);
-- ad_metrics_daily (ad_account_id, data): índice para série temporal por
-- conta em ordem decrescente (gráfico 30d, últimos 14 dias, agregação mês).
create index idx_ad_metrics_daily_account_data
  on public.ad_metrics_daily (ad_account_id, data desc);

-- -----------------------------------------------------------------------------
-- 3. RLS: ad_accounts — CRUD do time (padrão agenda_events)
-- -----------------------------------------------------------------------------

alter table public.ad_accounts enable row level security;

create policy "team seleciona ad_accounts"
  on public.ad_accounts for select
  to authenticated
  using (public.is_team_member());

create policy "team insere ad_accounts"
  on public.ad_accounts for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza ad_accounts"
  on public.ad_accounts for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui ad_accounts"
  on public.ad_accounts for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 4. RLS: ad_metrics_daily — team SELECT apenas. Sem policy de
--    insert/update/delete para authenticated: a escrita é feita somente
--    pela edge function sync-ad-metrics usando a service role (que ignora
--    RLS por padrão no Supabase).
-- -----------------------------------------------------------------------------

alter table public.ad_metrics_daily enable row level security;

create policy "team seleciona ad_metrics_daily"
  on public.ad_metrics_daily for select
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 5. notifications.tipo — amplia o check para incluir 'trafego' (falha de
--    sincronização de métricas de anúncios).
-- -----------------------------------------------------------------------------

alter table public.notifications
  drop constraint notifications_tipo_check;

alter table public.notifications
  add constraint notifications_tipo_check
  check (tipo in ('lead', 'briefing', 'proposta', 'pagamento', 'ticket', 'trafego'));
