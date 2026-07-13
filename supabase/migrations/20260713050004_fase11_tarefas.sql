-- =============================================================================
-- Vertix Admin — Fase 11: Tarefas por projeto
-- project_tasks — RLS padrão agenda_events (equipe CRUD, sem anon).
-- =============================================================================

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  titulo text not null,
  concluida boolean not null default false,
  responsavel_id uuid references public.profiles (id) on delete set null,
  prazo date,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_project_tasks_project_id on public.project_tasks (project_id);
create index idx_project_tasks_project_ordem
  on public.project_tasks (project_id, ordem);

alter table public.project_tasks enable row level security;

create policy "team seleciona project_tasks"
  on public.project_tasks for select
  to authenticated
  using (public.is_team_member());

create policy "team insere project_tasks"
  on public.project_tasks for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza project_tasks"
  on public.project_tasks for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui project_tasks"
  on public.project_tasks for delete
  to authenticated
  using (public.is_team_member());
