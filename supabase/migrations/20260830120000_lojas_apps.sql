-- =============================================================================
-- Vertix Admin — Módulo Lojas (apps Shopify próprios), parte 1: schema
-- lojas + loja_apps. A agência distribui os apps "Vertix Recover" e
-- "Vertix Reviews" como custom apps privados nas lojas dos clientes; este
-- schema é o cadastro local (console). O status VIVO de cada app (saúde,
-- métricas, configurações) vem dos backends via edge function apps-proxy —
-- os tokens de serviço nunca chegam ao navegador nem ao banco.
-- RLS: CRUD do time em ambas (padrão ad_accounts) — o front cadastra a
-- loja/app após o provisionamento; o client_secret do custom app NUNCA é
-- persistido aqui, só repassado ao backend pela edge function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  shop_domain text not null unique,
  plano text,
  status text not null default 'ativa'
    check (status in ('ativa', 'pausada', 'encerrada')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loja_apps (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  produto text not null
    check (produto in ('recover', 'reviews')),
  status text not null default 'provisionado'
    check (status in ('provisionado', 'instalado', 'ativo', 'erro')),
  provisionado_em timestamptz not null default now(),
  ultimo_sync timestamptz,
  metricas_cache jsonb,
  unique (loja_id, produto)
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

create index idx_lojas_client_id on public.lojas (client_id);
create index idx_loja_apps_loja_id on public.loja_apps (loja_id);

-- -----------------------------------------------------------------------------
-- 3. Trigger updated_at em lojas (reusa public.set_updated_at)
-- -----------------------------------------------------------------------------

create trigger set_updated_at
  before update on public.lojas
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS: lojas — CRUD do time (padrão ad_accounts)
-- -----------------------------------------------------------------------------

alter table public.lojas enable row level security;

create policy "team seleciona lojas"
  on public.lojas for select
  to authenticated
  using (public.is_team_member());

create policy "team insere lojas"
  on public.lojas for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza lojas"
  on public.lojas for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui lojas"
  on public.lojas for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 5. RLS: loja_apps — CRUD do time (o front registra o app após provisionar
--    e pode ajustar status; métricas_cache/ultimo_sync também podem ser
--    escritos por jobs futuros via service role, que ignora RLS)
-- -----------------------------------------------------------------------------

alter table public.loja_apps enable row level security;

create policy "team seleciona loja_apps"
  on public.loja_apps for select
  to authenticated
  using (public.is_team_member());

create policy "team insere loja_apps"
  on public.loja_apps for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza loja_apps"
  on public.loja_apps for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui loja_apps"
  on public.loja_apps for delete
  to authenticated
  using (public.is_team_member());
