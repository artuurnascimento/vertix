-- ---------------------------------------------------------------------------
-- Jornada única — fase 0: chave lead → cliente, conversão de verdade e o
-- funil por pessoa
-- ---------------------------------------------------------------------------
-- 1. `leads.client_id` e `pedidos.client_id`: o lead do Scan e o pedido do
--    checkout passam a apontar para o cliente do painel. Até aqui, "marcar
--    como cliente" só trocava o status do lead, e a história dele (análise,
--    dor, compra) não chegava ao cadastro comercial.
--
-- 2. `converter_lead_em_cliente(lead)`: cria o cliente (ou reaproveita um
--    com o mesmo e-mail / WhatsApp — a base já tem duplicados por falta
--    disto), abre um projeto em `lead` ligado à origem Scan e grava a chave
--    em lead, compras e pedidos. Uma transação só: ou vira tudo, ou nada.
--
-- 3. `funil_pessoas`: uma linha por PESSOA (e-mail normalizado), com a data
--    em que atingiu cada etapa. O funil do relatório contava documentos
--    (propostas ÷ projetos, que dá 300 % quando um projeto tem três
--    propostas); contar pessoas é a única forma de a conversão fazer sentido.
--
-- Aditiva: `if not exists` nas colunas; nenhuma coluna existente é tocada.
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists leads_client_id_idx on public.leads (client_id);
comment on column public.leads.client_id is
  'Cliente do painel em que este lead virou. null = ainda é só lead.';

alter table public.pedidos
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists pedidos_client_id_idx on public.pedidos (client_id);
comment on column public.pedidos.client_id is
  'Cliente do painel dono deste pedido (preenchido na conversão do lead ou por e-mail). null = comprador ainda sem cadastro.';

-- ---------------------------------------------------------------------------
-- converter_lead_em_cliente
-- ---------------------------------------------------------------------------
-- security definer com a checagem explícita de equipe: a função escreve em
-- cinco tabelas com RLS diferentes (leads, clients, projects, raiox_compras,
-- pedidos) e precisa completar ou desfazer tudo junto.
-- ---------------------------------------------------------------------------

create or replace function public.converter_lead_em_cliente(p_lead_id uuid)
returns table (client_id uuid, project_id uuid, cliente_criado boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_client uuid;
  v_project uuid;
  v_criado boolean := false;
  v_telefone text;
begin
  if not public.is_team_member() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  select l.id, l.name, l.email, l.whatsapp, l.client_id, a.domain
    into v_lead
    from public.leads l
    left join public.analyses a on a.id = l.analysis_id
   where l.id = p_lead_id;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;

  -- Já convertido: devolve o que existe, sem criar nada de novo.
  if v_lead.client_id is not null then
    select p.id into v_project
      from public.projects p
     where p.client_id = v_lead.client_id and p.origem = 'scan'
     order by p.created_at desc
     limit 1;
    return query select v_lead.client_id, v_project, false;
    return;
  end if;

  v_telefone := regexp_replace(coalesce(v_lead.whatsapp, ''), '\D', '', 'g');

  -- Reaproveita cliente com o mesmo e-mail ou o mesmo WhatsApp.
  select c.id into v_client
    from public.clients c
   where (v_lead.email is not null and lower(c.email) = lower(v_lead.email))
      or (v_telefone <> '' and regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_telefone)
   order by c.created_at
   limit 1;

  if v_client is null then
    insert into public.clients (nome, empresa, email, telefone, origem)
    values (
      coalesce(nullif(trim(v_lead.name), ''), 'Lead do Scan'),
      v_lead.domain,
      v_lead.email,
      v_lead.whatsapp,
      'scan'
    )
    returning id into v_client;
    v_criado := true;
  end if;

  insert into public.projects (client_id, nome, tipo_servico, status, origem)
  values (
    v_client,
    'Correção da loja' || coalesce(' ' || v_lead.domain, ''),
    'ecommerce',
    'lead',
    'scan'
  )
  returning id into v_project;

  update public.leads set client_id = v_client, status = 'cliente' where id = p_lead_id;
  update public.raiox_compras set client_id = v_client where lead_id = p_lead_id and client_id is null;
  update public.pedidos set client_id = v_client where lead_id = p_lead_id and client_id is null;

  return query select v_client, v_project, v_criado;
end;
$$;

comment on function public.converter_lead_em_cliente(uuid) is
  'Lead do Scan vira cliente do painel: reaproveita cadastro pelo e-mail/WhatsApp ou cria um, abre um projeto em "lead" com origem scan e grava a chave em lead, compras e pedidos. Só equipe.';

grant execute on function public.converter_lead_em_cliente(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- funil_pessoas
-- ---------------------------------------------------------------------------
-- security_invoker: respeita a RLS das tabelas base (só o time enxerga).
-- ---------------------------------------------------------------------------

create or replace view public.funil_pessoas
  with (security_invoker = true)
as
with pessoas as (
  -- `origem` é jsonb (utm_source, utm_medium, utm_campaign, referrer…);
  -- para o funil vale o utm_source do primeiro lead, ou a campanha, ou
  -- o referrer — o que houver.
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
  select lower(l.email) as email, min(c.pago_em) as compra_em
    from public.raiox_compras c
    join public.leads l on l.id = c.lead_id
   where c.status = 'pago' and l.email is not null
   group by lower(l.email)
  union all
  select lower(p.cliente_email), min(p.created_at)
    from public.pedidos p
   where p.status = 'pago'
   group by lower(p.cliente_email)
),
compras_u as (
  select email, min(compra_em) as compra_em from compras group by email
),
reunioes as (
  select lower(l.email) as email, min(e.inicio) as reuniao_em
    from public.agenda_events e
    join public.leads l on l.id = e.lead_id
   where l.email is not null
   group by lower(l.email)
),
contratos as (
  select lower(c.email) as email, min(pr.accepted_at) as contratado_em
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
       rc.recorrencia_em
  from pessoas p
  full join compras_u cu on cu.email = p.email
  full join reunioes r on r.email = coalesce(p.email, cu.email)
  full join contratos ct on ct.email = coalesce(p.email, cu.email, r.email)
  full join recorrencia rc on rc.email = coalesce(p.email, cu.email, r.email, ct.email);

comment on view public.funil_pessoas is
  'Uma linha por pessoa (e-mail), com a data em que atingiu cada etapa da jornada: lead, relatório aberto, compra, reunião, contratação, recorrência. Base do funil do relatório.';

grant select on public.funil_pessoas to authenticated;
