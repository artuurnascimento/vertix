-- =============================================================================
-- Vertix Admin — Client health score
--
-- Um número 0-100 por cliente que combina os sinais que os outros módulos já
-- produzem: atraso financeiro, chamados abertos e SLA estourado, projetos
-- parados, nudges urgentes, último NPS e tempo desde a última atividade.
--
--   faixa: saudavel (>=75) · atencao (>=50) · risco (<50)
--
-- security_invoker respeita a RLS das tabelas base (só o time enxerga).
-- =============================================================================

create or replace view public.client_health
  with (security_invoker = true)
as
with overdue as (
  select client_id,
         count(*) as qtd,
         coalesce(sum(valor), 0) as valor
  from public.receivables
  where status = 'pendente' and vencimento < current_date
  group by client_id
),
tickets as (
  select p.client_id,
         count(*) filter (where t.status <> 'resolvido') as abertos,
         count(*) filter (
           where t.status <> 'resolvido'
             and now() > t.created_at
               + (public.sla_hours(t.prioridade) || ' hours')::interval
         ) as estourados
  from public.support_tickets t
  join public.projects p on p.id = t.project_id
  group by p.client_id
),
parados as (
  select client_id, count(*) as qtd
  from public.projects
  where status = 'em_desenvolvimento'
    and updated_at < now() - interval '14 days'
  group by client_id
),
nudges_urg as (
  select client_id, count(*) as qtd
  from public.nudges
  where not resolvido and severidade = 'urgente' and client_id is not null
  group by client_id
),
ultimo_nps as (
  select distinct on (client_id) client_id, score
  from public.nps_surveys
  where status = 'respondido' and score is not null
  order by client_id, responded_at desc
),
atividade as (
  select p.client_id, max(a.created_at) as ultima
  from public.activity_log a
  join public.projects p on p.id = a.project_id
  group by p.client_id
),
sinais as (
  select
    c.id as client_id,
    c.nome,
    c.empresa,
    coalesce(o.qtd, 0) as atraso_qtd,
    coalesce(o.valor, 0) as em_atraso_valor,
    coalesce(t.abertos, 0) as tickets_abertos,
    coalesce(t.estourados, 0) as sla_estourados,
    coalesce(pa.qtd, 0) as projetos_parados,
    coalesce(nu.qtd, 0) as nudges_urgentes,
    un.score as ultimo_nps,
    case
      when a.ultima is null then null
      else extract(day from now() - a.ultima)::integer
    end as dias_inativo
  from public.clients c
  left join overdue o on o.client_id = c.id
  left join tickets t on t.client_id = c.id
  left join parados pa on pa.client_id = c.id
  left join nudges_urg nu on nu.client_id = c.id
  left join ultimo_nps un on un.client_id = c.id
  left join atividade a on a.client_id = c.id
),
pontuado as (
  select
    s.*,
    greatest(0, least(100,
      100
      - least(s.atraso_qtd, 3) * 12
      - s.sla_estourados * 10
      - least(s.tickets_abertos, 4) * 3
      - s.projetos_parados * 8
      - s.nudges_urgentes * 6
      + case
          when s.ultimo_nps is null then 0
          when s.ultimo_nps >= 9 then 8
          when s.ultimo_nps >= 7 then 0
          else -12
        end
    ))::integer as score
  from sinais s
)
select
  p.*,
  case
    when p.score >= 75 then 'saudavel'
    when p.score >= 50 then 'atencao'
    else 'risco'
  end as faixa
from pontuado p;

grant select on public.client_health to authenticated;
