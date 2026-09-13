-- ---------------------------------------------------------------------------
-- Jornada única — fase 4: receita por pessoa no funil
-- ---------------------------------------------------------------------------
-- `funil_pessoas` (fase 0) tem uma linha por pessoa com a data de cada etapa
-- e a origem/campanha do primeiro lead. Para o funil por campanha faltava o
-- dinheiro: quanto cada pessoa pagou de plano (Scan e checkout) e quanto
-- contratou em propostas aceitas. Com isso o relatório responde "receita
-- por lead" e "receita por campanha" sem juntar quatro tabelas na tela.
--
-- `create or replace view` só acrescenta colunas no fim; as existentes
-- continuam iguais para quem já lê a view.
-- ---------------------------------------------------------------------------

create or replace view public.funil_pessoas
  with (security_invoker = true)
as
with pessoas as (
  select lower(email) as email,
         min(created_at) as lead_em,
         min(relatorio_aberto_em) as relatorio_em,
         min(reuniao_em) as reuniao_lead_em,
         (array_agg(
            coalesce(origem->>'utm_source', origem->>'utm_campaign', origem->>'referrer')
            order by created_at
          ))[1] as origem,
         (array_agg(origem->>'utm_campaign' order by created_at))[1] as campanha
    from public.leads
   where email is not null
   group by lower(email)
),
compras as (
  select lower(l.email) as email, c.pago_em as compra_em, c.valor_centavos / 100.0 as receita
    from public.raiox_compras c
    join public.leads l on l.id = c.lead_id
   where c.status = 'pago' and l.email is not null
  union all
  select lower(p.cliente_email), p.created_at, p.total_centavos / 100.0
    from public.pedidos p
   where p.status = 'pago'
),
compras_u as (
  select email, min(compra_em) as compra_em, sum(receita) as receita_plano from compras group by email
),
reunioes as (
  select lower(l.email) as email, min(e.inicio) as reuniao_em
    from public.agenda_events e
    join public.leads l on l.id = e.lead_id
   where l.email is not null
   group by lower(l.email)
),
contratos as (
  select lower(c.email) as email, min(pr.accepted_at) as contratado_em, sum(pr.valor_total) as receita_contratos
    from public.proposals pr
    join public.projects p on p.id = pr.project_id
    join public.clients c on c.id = p.client_id
   where pr.status = 'aceita' and c.email is not null
   group by lower(c.email)
),
recorrencia as (
  select lower(c.email) as email, min(s.started_at) as recorrencia_em
    from public.subscriptions s
    join public.clients c on c.id = s.client_id
   where s.ativo and c.email is not null
   group by lower(c.email)
)
select coalesce(p.email, cu.email, r.email, ct.email, rc.email) as email,
       p.origem,
       p.campanha,
       p.lead_em,
       p.relatorio_em,
       cu.compra_em,
       least(p.reuniao_lead_em, r.reuniao_em) as reuniao_em,
       ct.contratado_em,
       rc.recorrencia_em,
       coalesce(cu.receita_plano, 0)::numeric(12,2) as receita_plano,
       coalesce(ct.receita_contratos, 0)::numeric(12,2) as receita_contratos
  from pessoas p
  full join compras_u cu on cu.email = p.email
  full join reunioes r on r.email = coalesce(p.email, cu.email)
  full join contratos ct on ct.email = coalesce(p.email, cu.email, r.email)
  full join recorrencia rc on rc.email = coalesce(p.email, cu.email, r.email, ct.email);

comment on view public.funil_pessoas is
  'Uma linha por pessoa (e-mail), com a data em que atingiu cada etapa da jornada (lead, relatório aberto, compra, reunião, contratação, recorrência), a origem/campanha do primeiro lead e a receita (planos pagos e propostas aceitas). Base do funil do relatório.';
