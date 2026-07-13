-- =============================================================================
-- Vertix Admin — Fase 19: Tickets de suporte
-- support_tickets + RPC pública create_ticket.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'aberto'
    check (status in ('aberto', 'em_andamento', 'resolvido')),
  prioridade text not null default 'media'
    check (prioridade in ('baixa', 'media', 'alta')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_support_tickets_project_id on public.support_tickets (project_id);
create index idx_support_tickets_status on public.support_tickets (status);

alter table public.support_tickets enable row level security;

create policy "team seleciona support_tickets"
  on public.support_tickets for select
  to authenticated
  using (public.is_team_member());

create policy "team insere support_tickets"
  on public.support_tickets for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza support_tickets"
  on public.support_tickets for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui support_tickets"
  on public.support_tickets for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. RPC pública create_ticket — cliente abre chamado pelo portal sem login.
-- -----------------------------------------------------------------------------

create or replace function public.create_ticket(
  p_token uuid,
  p_titulo text,
  p_descricao text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
begin
  select * into v_project
  from public.projects
  where portal_token = p_token;

  if not found then
    raise exception 'Projeto não encontrado.';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'Título é obrigatório.';
  end if;

  insert into public.support_tickets (project_id, titulo, descricao)
  values (v_project.id, p_titulo, p_descricao);

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_project.id,
    null,
    'sistema',
    'Chamado aberto pelo cliente: ' || p_titulo
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.create_ticket(uuid, text, text) from public;
grant execute on function public.create_ticket(uuid, text, text) to anon, authenticated;
