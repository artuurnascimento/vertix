-- =============================================================================
-- Vertix Admin — SLA de suporte + primeira resposta
--
-- Dá "serviço ao cliente sentido na hora": cada chamado passa a ter uma meta
-- de tempo por prioridade e um carimbo de primeira resposta.
--   alta = 4h · média = 24h · baixa = 72h
--
-- A UI calcula o status do SLA no cliente (helper TS) a partir das colunas;
-- o helper SQL sla_hours() e a view support_ticket_sla existem para o health
-- score e para consultas diretas server-side.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coluna de primeira resposta + carimbo automático
-- -----------------------------------------------------------------------------

alter table public.support_tickets
  add column if not exists first_response_at timestamptz;

-- BEFORE UPDATE: ao sair de 'aberto' pela primeira vez, carimba a primeira
-- resposta. Idempotente — só grava se ainda estiver nulo.
create or replace function public.stamp_ticket_first_response()
returns trigger
language plpgsql
as $$
begin
  if new.first_response_at is null
     and old.status = 'aberto'
     and new.status <> 'aberto' then
    new.first_response_at := now();
  end if;
  return new;
end;
$$;

create trigger stamp_ticket_first_response
  before update on public.support_tickets
  for each row
  execute function public.stamp_ticket_first_response();

-- -----------------------------------------------------------------------------
-- 2. Helper de meta de SLA (horas por prioridade)
-- -----------------------------------------------------------------------------

create or replace function public.sla_hours(p_prioridade text)
returns integer
language sql
immutable
as $$
  select case p_prioridade
    when 'alta' then 4
    when 'media' then 24
    when 'baixa' then 72
    else 24
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3. View enriquecida — security_invoker respeita a RLS de support_tickets.
-- -----------------------------------------------------------------------------

create or replace view public.support_ticket_sla
  with (security_invoker = true)
as
select
  t.*,
  public.sla_hours(t.prioridade) as sla_horas,
  t.created_at + (public.sla_hours(t.prioridade) || ' hours')::interval as sla_due_at,
  case
    when t.resolved_at is not null then
      case
        when t.resolved_at
          <= t.created_at + (public.sla_hours(t.prioridade) || ' hours')::interval
        then 'cumprido'
        else 'estourado'
      end
    when now()
      > t.created_at + (public.sla_hours(t.prioridade) || ' hours')::interval
      then 'estourado'
    when now()
      > t.created_at
        + (public.sla_hours(t.prioridade) * 0.75 || ' hours')::interval
      then 'em_risco'
    else 'no_prazo'
  end as status_sla
from public.support_tickets t;

grant select on public.support_ticket_sla to authenticated;
