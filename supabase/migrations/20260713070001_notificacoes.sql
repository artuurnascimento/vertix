-- =============================================================================
-- Vertix Admin — Central de notificações
-- notifications + helper push_notification (security definer) + triggers
-- automáticos (lead, briefing, proposta, pagamento, ticket) + realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in ('lead', 'briefing', 'proposta', 'pagamento', 'ticket')),
  titulo text not null,
  descricao text,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_lida_created
  on public.notifications (lida, created_at desc);

alter table public.notifications enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Policies — equipe lê e marca como lida; sem insert direto (só triggers
--    via security definer). Sem policy de insert/delete para authenticated.
-- -----------------------------------------------------------------------------

create policy "team seleciona notifications"
  on public.notifications for select
  to authenticated
  using (public.is_team_member());

create policy "team atualiza notifications"
  on public.notifications for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 3. Helper — security definer para permitir insert por triggers mesmo sem
--    policy de insert para authenticated/anon.
-- -----------------------------------------------------------------------------

create or replace function public.push_notification(
  p_tipo text,
  p_titulo text,
  p_descricao text,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (tipo, titulo, descricao, link)
  values (p_tipo, p_titulo, p_descricao, p_link);
end;
$$;

revoke execute on function public.push_notification(text, text, text, text)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Triggers automáticos
-- -----------------------------------------------------------------------------

-- 4.1 clients INSERT com origem='site' → lead
create or replace function public.notify_lead_from_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origem = 'site' then
    perform public.push_notification(
      'lead',
      'Novo lead do site — ' || new.nome,
      coalesce(new.email, ''),
      '/admin/clientes'
    );
  end if;
  return new;
end;
$$;

create trigger notify_lead_from_site
  after insert on public.clients
  for each row
  execute function public.notify_lead_from_site();

-- 4.2 briefings UPDATE status → 'preenchido' → briefing
create or replace function public.notify_briefing_preenchido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_nome text;
begin
  if new.status = 'preenchido' and old.status is distinct from new.status then
    select nome into v_project_nome
    from public.projects
    where id = new.project_id;

    perform public.push_notification(
      'briefing',
      'Briefing respondido',
      v_project_nome,
      '/admin/briefings'
    );
  end if;
  return new;
end;
$$;

create trigger notify_briefing_preenchido
  after update on public.briefings
  for each row
  execute function public.notify_briefing_preenchido();

-- 4.3 proposals UPDATE status → 'aceita'/'recusada' → proposta
create or replace function public.notify_proposal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('aceita', 'recusada')
     and old.status is distinct from new.status then
    perform public.push_notification(
      'proposta',
      'Proposta ' || new.status,
      new.titulo,
      '/admin/propostas'
    );
  end if;
  return new;
end;
$$;

create trigger notify_proposal_status
  after update on public.proposals
  for each row
  execute function public.notify_proposal_status();

-- 4.4 receivables UPDATE status → 'pago' → pagamento
create or replace function public.notify_receivable_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pago' and old.status is distinct from new.status then
    perform public.push_notification(
      'pagamento',
      'Pagamento recebido',
      new.descricao || ' — R$ ' || new.valor,
      '/admin/financeiro'
    );
  end if;
  return new;
end;
$$;

create trigger notify_receivable_pago
  after update on public.receivables
  for each row
  execute function public.notify_receivable_pago();

-- 4.5 support_tickets INSERT → ticket
create or replace function public.notify_ticket_criado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notification(
    'ticket',
    'Novo chamado',
    new.titulo,
    '/admin/suporte'
  );
  return new;
end;
$$;

create trigger notify_ticket_criado
  after insert on public.support_tickets
  for each row
  execute function public.notify_ticket_criado();

-- -----------------------------------------------------------------------------
-- 5. Realtime — adiciona a tabela à publicação padrão do Supabase, se existir.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
