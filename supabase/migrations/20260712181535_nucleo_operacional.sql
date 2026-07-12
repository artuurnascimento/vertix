-- =============================================================================
-- Vertix Admin — Núcleo Operacional (Fase 1)
-- Tabelas, índices, trigger, helpers, RLS, policies, RPCs públicas e grants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  role text not null default 'colaborador'
    check (role in ('admin', 'colaborador')),
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  email text,
  telefone text,
  origem text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome text not null,
  tipo_servico text not null
    check (tipo_servico in ('ecommerce', 'sistema', 'site')),
  status text not null default 'lead'
    check (status in (
      'lead',
      'briefing_enviado',
      'briefing_recebido',
      'em_desenvolvimento',
      'revisao',
      'entregue'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.briefing_templates (
  id uuid primary key default gen_random_uuid(),
  tipo_servico text not null unique
    check (tipo_servico in ('ecommerce', 'sistema', 'site')),
  perguntas jsonb not null
);

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  template_id uuid not null references public.briefing_templates (id),
  token uuid not null unique default gen_random_uuid(),
  respostas jsonb,
  status text not null default 'enviado'
    check (status in ('pendente', 'enviado', 'preenchido')),
  submitted_at timestamptz
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id),
  tipo text not null
    check (tipo in ('status_change', 'briefing_submitted', 'nota')),
  descricao text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

create index idx_projects_client_id on public.projects (client_id);
create index idx_projects_status on public.projects (status);
create index idx_briefings_project_id on public.briefings (project_id);
-- briefings.token: índice único já criado pela constraint UNIQUE.
create index idx_activity_log_project_created
  on public.activity_log (project_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Trigger updated_at em projects
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Helpers de autorização (security definer para evitar recursão em RLS)
-- -----------------------------------------------------------------------------

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_team_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_team_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. RLS: habilitar em todas as tabelas
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.briefing_templates enable row level security;
alter table public.briefings enable row level security;
alter table public.activity_log enable row level security;

-- -----------------------------------------------------------------------------
-- 6. Policies (somente authenticated; anon não tem nenhuma policy direta)
-- -----------------------------------------------------------------------------

-- profiles: equipe vê equipe; cada um atualiza só o próprio; sem insert/delete.
create policy "team can select profiles"
  on public.profiles for select to authenticated
  using (public.is_team_member());

create policy "user can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- clients
create policy "team can select clients"
  on public.clients for select to authenticated
  using (public.is_team_member());

create policy "team can insert clients"
  on public.clients for insert to authenticated
  with check (public.is_team_member());

create policy "team can update clients"
  on public.clients for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "admin can delete clients"
  on public.clients for delete to authenticated
  using (public.is_admin());

-- projects
create policy "team can select projects"
  on public.projects for select to authenticated
  using (public.is_team_member());

create policy "team can insert projects"
  on public.projects for insert to authenticated
  with check (public.is_team_member());

create policy "team can update projects"
  on public.projects for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete projects"
  on public.projects for delete to authenticated
  using (public.is_team_member());

-- briefing_templates
create policy "team can select briefing_templates"
  on public.briefing_templates for select to authenticated
  using (public.is_team_member());

create policy "team can insert briefing_templates"
  on public.briefing_templates for insert to authenticated
  with check (public.is_team_member());

create policy "team can update briefing_templates"
  on public.briefing_templates for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- briefings
create policy "team can select briefings"
  on public.briefings for select to authenticated
  using (public.is_team_member());

create policy "team can insert briefings"
  on public.briefings for insert to authenticated
  with check (public.is_team_member());

create policy "team can update briefings"
  on public.briefings for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete briefings"
  on public.briefings for delete to authenticated
  using (public.is_team_member());

-- activity_log
create policy "team can select activity_log"
  on public.activity_log for select to authenticated
  using (public.is_team_member());

create policy "team can insert activity_log"
  on public.activity_log for insert to authenticated
  with check (public.is_team_member());

create policy "team can update activity_log"
  on public.activity_log for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete activity_log"
  on public.activity_log for delete to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 7. RPCs públicas de briefing (SECURITY DEFINER — único acesso do anon)
-- -----------------------------------------------------------------------------

create or replace function public.get_briefing_by_token(t uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'briefing', json_build_object(
      'id', b.id,
      'status', b.status,
      'respostas', b.respostas
    ),
    'perguntas', bt.perguntas,
    'tipo_servico', bt.tipo_servico,
    'projeto_nome', p.nome
  )
  from public.briefings b
  join public.briefing_templates bt on bt.id = b.template_id
  join public.projects p on p.id = b.project_id
  where b.token = t;
$$;

create or replace function public.submit_briefing(t uuid, p_respostas jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_briefing public.briefings%rowtype;
  v_project_nome text;
begin
  select * into v_briefing
  from public.briefings
  where token = t
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'token_invalido');
  end if;

  if v_briefing.status = 'preenchido' then
    return json_build_object('success', false, 'error', 'ja_preenchido');
  end if;

  update public.briefings
  set respostas = p_respostas,
      status = 'preenchido',
      submitted_at = now()
  where id = v_briefing.id;

  select nome into v_project_nome
  from public.projects
  where id = v_briefing.project_id;

  update public.projects
  set status = 'briefing_recebido'
  where id = v_briefing.project_id;

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_briefing.project_id,
    null,
    'briefing_submitted',
    'Briefing preenchido pelo cliente — projeto "' || v_project_nome || '"'
  );

  return json_build_object('success', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Grants das RPCs
-- -----------------------------------------------------------------------------

revoke execute on function public.get_briefing_by_token(uuid) from public;
revoke execute on function public.submit_briefing(uuid, jsonb) from public;

grant execute on function public.get_briefing_by_token(uuid) to anon, authenticated;
grant execute on function public.submit_briefing(uuid, jsonb) to anon, authenticated;
