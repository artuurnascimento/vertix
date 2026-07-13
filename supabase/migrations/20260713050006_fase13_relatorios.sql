-- =============================================================================
-- Vertix Admin — Fase 13: Página Relatórios
-- project_status_history + trigger de captura + backfill dos projetos existentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null,
  entrou_em timestamptz not null default now()
);

create index idx_project_status_history_project_id
  on public.project_status_history (project_id);
create index idx_project_status_history_project_entrou
  on public.project_status_history (project_id, entrou_em);

-- -----------------------------------------------------------------------------
-- 2. RLS: equipe seleciona e insere (trigger roda como owner da tabela via
--    security definer implícito de trigger function; policy de insert cobre
--    também inserts manuais/administrativos caso necessário).
-- -----------------------------------------------------------------------------

alter table public.project_status_history enable row level security;

create policy "team seleciona project_status_history"
  on public.project_status_history for select
  to authenticated
  using (public.is_team_member());

create policy "team insere project_status_history"
  on public.project_status_history for insert
  to authenticated
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 3. Trigger: registra mudança de status em projects.
-- -----------------------------------------------------------------------------

create or replace function public.record_project_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.project_status_history (project_id, status, entrou_em)
    values (new.id, new.status, now());
  end if;
  return new;
end;
$$;

create trigger record_project_status_change
  after update of status on public.projects
  for each row
  execute function public.record_project_status_change();

-- -----------------------------------------------------------------------------
-- 4. Backfill: uma linha por projeto existente com o status atual,
--    entrou_em = updated_at (melhor aproximação disponível).
-- -----------------------------------------------------------------------------

insert into public.project_status_history (project_id, status, entrou_em)
select id, status, updated_at
from public.projects;
