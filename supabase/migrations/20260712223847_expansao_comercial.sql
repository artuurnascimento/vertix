-- =============================================================================
-- Vertix Admin — Expansão Comercial
-- Propostas, contas a receber, portal do cliente, índices, RLS, RPCs e grants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  titulo text not null,
  -- array de {descricao, quantidade, valor_unitario}
  itens jsonb not null default '[]',
  desconto numeric(12,2) not null default 0,
  -- calculado pelo app a partir de itens - desconto
  valor_total numeric(12,2) not null default 0,
  condicoes text,
  -- array de {descricao, valor, vencimento 'YYYY-MM-DD'}
  parcelas jsonb,
  validade date,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviada', 'aceita', 'recusada')),
  token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz,
  accepted_at timestamptz,
  aceite_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  -- "atrasado" é derivado no app: pendente + vencimento < hoje
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'cancelado')),
  pago_em date,
  forma_pagamento text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Alterações em tabelas existentes
-- -----------------------------------------------------------------------------

-- projects: token do portal do cliente (cada linha existente ganha o seu).
alter table public.projects
  add column portal_token uuid not null unique default gen_random_uuid();

-- activity_log: novos tipos de evento (proposta, financeiro).
alter table public.activity_log
  drop constraint activity_log_tipo_check;

alter table public.activity_log
  add constraint activity_log_tipo_check
  check (tipo in (
    'status_change',
    'briefing_submitted',
    'nota',
    'proposta',
    'financeiro'
  ));

-- -----------------------------------------------------------------------------
-- 3. Índices
-- -----------------------------------------------------------------------------

create index idx_proposals_project_id on public.proposals (project_id);
create index idx_proposals_status on public.proposals (status);
-- proposals.token: índice único já criado pela constraint UNIQUE.
create index idx_receivables_project_id on public.receivables (project_id);
create index idx_receivables_client_id on public.receivables (client_id);
create index idx_receivables_status_vencimento
  on public.receivables (status, vencimento);
-- projects.portal_token: índice único já criado pela constraint UNIQUE.

-- -----------------------------------------------------------------------------
-- 4. Trigger updated_at em proposals (reusa public.set_updated_at)
-- -----------------------------------------------------------------------------

create trigger set_updated_at
  before update on public.proposals
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. RLS: habilitar nas tabelas novas
-- -----------------------------------------------------------------------------

alter table public.proposals enable row level security;
alter table public.receivables enable row level security;

-- -----------------------------------------------------------------------------
-- 6. Policies (somente authenticated; anon não tem nenhuma policy direta)
-- -----------------------------------------------------------------------------

-- proposals
create policy "team can select proposals"
  on public.proposals for select to authenticated
  using (public.is_team_member());

create policy "team can insert proposals"
  on public.proposals for insert to authenticated
  with check (public.is_team_member());

create policy "team can update proposals"
  on public.proposals for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete proposals"
  on public.proposals for delete to authenticated
  using (public.is_team_member());

-- receivables
create policy "team can select receivables"
  on public.receivables for select to authenticated
  using (public.is_team_member());

create policy "team can insert receivables"
  on public.receivables for insert to authenticated
  with check (public.is_team_member());

create policy "team can update receivables"
  on public.receivables for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete receivables"
  on public.receivables for delete to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 7. RPCs públicas (SECURITY DEFINER — único acesso do anon)
-- -----------------------------------------------------------------------------

-- Proposta pública por token. Null se não existe ou ainda é rascunho.
create or replace function public.get_proposal_by_token(t uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'proposta', json_build_object(
      'id', pr.id,
      'titulo', pr.titulo,
      'itens', pr.itens,
      'desconto', pr.desconto,
      'valor_total', pr.valor_total,
      'condicoes', pr.condicoes,
      'parcelas', pr.parcelas,
      'validade', pr.validade,
      'status', pr.status,
      'accepted_at', pr.accepted_at,
      'aceite_nome', pr.aceite_nome,
      'sent_at', pr.sent_at
    ),
    'projeto_nome', p.nome,
    'cliente', json_build_object(
      'nome', c.nome,
      'empresa', c.empresa
    )
  )
  from public.proposals pr
  join public.projects p on p.id = pr.project_id
  join public.clients c on c.id = p.client_id
  where pr.token = t
    and pr.status <> 'rascunho';
$$;

-- Aceite/recusa da proposta pelo cliente. Só age sobre status 'enviada'.
create or replace function public.respond_proposal(
  t uuid,
  p_aceite boolean,
  p_nome text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_project public.projects%rowtype;
  v_parcela jsonb;
  v_i integer := 0;
  v_n integer;
begin
  select * into v_proposal
  from public.proposals
  where token = t
  for update;

  if not found or v_proposal.status <> 'enviada' then
    return json_build_object('success', false, 'error', 'indisponivel');
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    return json_build_object('success', false, 'error', 'nome_obrigatorio');
  end if;

  select * into v_project
  from public.projects
  where id = v_proposal.project_id;

  if p_aceite then
    update public.proposals
    set status = 'aceita',
        accepted_at = now(),
        aceite_nome = p_nome
    where id = v_proposal.id;

    -- Gera as contas a receber a partir das parcelas da proposta.
    if v_proposal.parcelas is not null
       and jsonb_typeof(v_proposal.parcelas) = 'array' then
      v_n := jsonb_array_length(v_proposal.parcelas);
      for v_parcela in select * from jsonb_array_elements(v_proposal.parcelas)
      loop
        v_i := v_i + 1;
        insert into public.receivables (
          project_id, client_id, proposal_id, descricao, valor, vencimento
        )
        values (
          v_proposal.project_id,
          v_project.client_id,
          v_proposal.id,
          coalesce(
            nullif(btrim(v_parcela ->> 'descricao'), ''),
            format('Parcela %s/%s — %s', v_i, v_n, v_proposal.titulo)
          ),
          (v_parcela ->> 'valor')::numeric,
          (v_parcela ->> 'vencimento')::date
        );
      end loop;
    end if;

    -- Projeto ainda em fase comercial entra em desenvolvimento.
    if v_project.status in ('lead', 'briefing_enviado', 'briefing_recebido') then
      update public.projects
      set status = 'em_desenvolvimento'
      where id = v_project.id;
    end if;

    insert into public.activity_log (project_id, user_id, tipo, descricao)
    values (
      v_proposal.project_id,
      null,
      'proposta',
      'Proposta "' || v_proposal.titulo || '" aceita por ' || p_nome
    );
  else
    update public.proposals
    set status = 'recusada'
    where id = v_proposal.id;

    insert into public.activity_log (project_id, user_id, tipo, descricao)
    values (
      v_proposal.project_id,
      null,
      'proposta',
      'Proposta "' || v_proposal.titulo || '" recusada por ' || p_nome
    );
  end if;

  return json_build_object('success', true, 'aceite', p_aceite);
end;
$$;

-- Portal do cliente por token do projeto. Null se não existe.
create or replace function public.get_portal_by_token(t uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_result json;
begin
  select * into v_project
  from public.projects
  where portal_token = t;

  if not found then
    return null;
  end if;

  select json_build_object(
    'projeto', json_build_object(
      'nome', v_project.nome,
      'tipo_servico', v_project.tipo_servico,
      'status', v_project.status,
      'created_at', v_project.created_at,
      'updated_at', v_project.updated_at
    ),
    'cliente', (
      select json_build_object('nome', c.nome, 'empresa', c.empresa)
      from public.clients c
      where c.id = v_project.client_id
    ),
    -- token do briefing só é exposto enquanto o form ainda pode ser preenchido
    'briefing', (
      select json_build_object(
        'status', b.status,
        'token', case when b.status <> 'preenchido' then b.token end
      )
      from public.briefings b
      where b.project_id = v_project.id
      order by b.submitted_at desc nulls first
      limit 1
    ),
    'propostas', coalesce((
      select json_agg(
        json_build_object(
          'titulo', pr.titulo,
          'valor_total', pr.valor_total,
          'status', pr.status,
          'token', pr.token,
          'sent_at', pr.sent_at
        )
        order by pr.sent_at desc nulls last
      )
      from public.proposals pr
      where pr.project_id = v_project.id
        and pr.status in ('enviada', 'aceita', 'recusada')
    ), '[]'::json),
    'atividades', coalesce((
      select json_agg(a.atividade)
      from (
        select json_build_object(
          'descricao', al.descricao,
          'tipo', al.tipo,
          'created_at', al.created_at
        ) as atividade
        from public.activity_log al
        where al.project_id = v_project.id
          and al.tipo <> 'nota'
        order by al.created_at desc
        limit 20
      ) a
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Grants das RPCs
-- -----------------------------------------------------------------------------

revoke execute on function public.get_proposal_by_token(uuid) from public;
revoke execute on function public.respond_proposal(uuid, boolean, text) from public;
revoke execute on function public.get_portal_by_token(uuid) from public;

grant execute on function public.get_proposal_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_proposal(uuid, boolean, text) to anon, authenticated;
grant execute on function public.get_portal_by_token(uuid) to anon, authenticated;
