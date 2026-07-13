-- =============================================================================
-- Vertix Admin — Fase 12: Despesas + fluxo de caixa
-- expenses — RLS padrão (equipe CRUD, sem anon).
-- =============================================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null
    check (categoria in ('hosting', 'ferramentas', 'trafego', 'impostos', 'outros')),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  recorrente boolean not null default false,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_expenses_data on public.expenses (data);
create index idx_expenses_project_id on public.expenses (project_id);
create index idx_expenses_categoria on public.expenses (categoria);

alter table public.expenses enable row level security;

create policy "team seleciona expenses"
  on public.expenses for select
  to authenticated
  using (public.is_team_member());

create policy "team insere expenses"
  on public.expenses for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza expenses"
  on public.expenses for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui expenses"
  on public.expenses for delete
  to authenticated
  using (public.is_team_member());
