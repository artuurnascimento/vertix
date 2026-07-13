-- =============================================================================
-- Vertix Admin — Fase 17: Time tracking
-- time_entries + settings (valor_hora), RLS padrão equipe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. time_entries
-- -----------------------------------------------------------------------------

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  data date not null default current_date,
  horas numeric(5,2) not null check (horas > 0 and horas <= 24),
  descricao text,
  created_at timestamptz not null default now()
);

create index idx_time_entries_project_id on public.time_entries (project_id);
create index idx_time_entries_profile_id on public.time_entries (profile_id);

alter table public.time_entries enable row level security;

create policy "team seleciona time_entries"
  on public.time_entries for select
  to authenticated
  using (public.is_team_member());

create policy "team insere time_entries"
  on public.time_entries for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza time_entries"
  on public.time_entries for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui time_entries"
  on public.time_entries for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. settings — chave/valor simples (valor_hora padrão da equipe).
--    Select: qualquer membro do time. Insert/update: só admin.
-- -----------------------------------------------------------------------------

create table public.settings (
  chave text primary key,
  valor text not null
);

alter table public.settings enable row level security;

create policy "team seleciona settings"
  on public.settings for select
  to authenticated
  using (public.is_team_member());

create policy "admin insere settings"
  on public.settings for insert
  to authenticated
  with check (public.is_admin());

create policy "admin atualiza settings"
  on public.settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.settings (chave, valor) values ('valor_hora', '100');
