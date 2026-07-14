-- =============================================================================
-- Tracking avançado de campanhas (Meta Ads): snapshot de campanhas + série
-- diária por campanha. Escrita exclusiva da edge function sync-ad-metrics
-- via service role; time só lê. Conjuntos/anúncios NÃO são persistidos
-- (snapshot ao vivo via fetch-campaign-breakdown).
-- =============================================================================

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  meta_campaign_id text not null unique,
  nome text not null,
  objetivo text,
  status text,
  created_at timestamptz not null default now()
);

create table public.ad_campaign_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  data date not null,
  gasto numeric(12,2) not null default 0,
  impressoes bigint default 0,
  cliques integer default 0,
  conversoes integer default 0,
  receita numeric(12,2) default 0,
  unique (campaign_id, data)
);

create index idx_ad_campaigns_account on public.ad_campaigns (ad_account_id);
create index idx_ad_campaign_metrics_campaign_data
  on public.ad_campaign_metrics_daily (campaign_id, data desc);

alter table public.ad_campaigns enable row level security;
alter table public.ad_campaign_metrics_daily enable row level security;

create policy "team seleciona ad_campaigns"
  on public.ad_campaigns for select
  to authenticated
  using (public.is_team_member());

create policy "team seleciona ad_campaign_metrics_daily"
  on public.ad_campaign_metrics_daily for select
  to authenticated
  using (public.is_team_member());
