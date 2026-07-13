-- =============================================================================
-- Vertix Admin — Fase 16: Manutenção recorrente (MRR)
-- subscriptions + generate_subscription_receivables (idempotente).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  descricao text not null,
  valor_mensal numeric(12,2) not null check (valor_mensal > 0),
  dia_vencimento integer not null check (dia_vencimento between 1 and 28),
  ativo boolean not null default true,
  started_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_subscriptions_client_id on public.subscriptions (client_id);
create index idx_subscriptions_ativo on public.subscriptions (ativo);

alter table public.subscriptions enable row level security;

create policy "team seleciona subscriptions"
  on public.subscriptions for select
  to authenticated
  using (public.is_team_member());

create policy "team insere subscriptions"
  on public.subscriptions for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza subscriptions"
  on public.subscriptions for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui subscriptions"
  on public.subscriptions for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. Function de geração mensal de receivables — idempotente por construção
--    (checa descricao || ' — ' || MM/YYYY antes de inserir).
--    Só authenticated + guard interno is_admin() (chamada disparada por
--    scheduled function com JWT de service/admin, ou manualmente pelo admin).
-- -----------------------------------------------------------------------------

create or replace function public.generate_subscription_receivables()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_descricao_mes text;
  v_projeto_id uuid;
  v_vencimento date;
  v_dia integer;
  v_ultimo_dia integer;
  v_criadas integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem gerar as cobranças recorrentes.';
  end if;

  for v_sub in
    select * from public.subscriptions where ativo = true
  loop
    v_descricao_mes := v_sub.descricao || ' — ' || to_char(current_date, 'MM/YYYY');

    if exists (
      select 1
      from public.receivables r
      where r.client_id = v_sub.client_id
        and r.descricao = v_descricao_mes
    ) then
      continue;
    end if;

    v_projeto_id := v_sub.project_id;

    if v_projeto_id is null then
      select p.id into v_projeto_id
      from public.projects p
      where p.client_id = v_sub.client_id
      order by p.created_at desc
      limit 1;
    end if;

    -- Cliente sem nenhum projeto: não há como associar a receivable (FK
    -- obrigatória), então pula esta assinatura neste ciclo.
    if v_projeto_id is null then
      continue;
    end if;

    v_ultimo_dia := extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day'))::integer;
    v_dia := least(v_sub.dia_vencimento, v_ultimo_dia);
    v_vencimento := date_trunc('month', current_date)::date + (v_dia - 1);

    insert into public.receivables (
      project_id, client_id, descricao, valor, vencimento, status
    )
    values (
      v_projeto_id,
      v_sub.client_id,
      v_descricao_mes,
      v_sub.valor_mensal,
      v_vencimento,
      'pendente'
    );

    v_criadas := v_criadas + 1;
  end loop;

  return v_criadas;
end;
$$;

revoke execute on function public.generate_subscription_receivables() from public, anon;
grant execute on function public.generate_subscription_receivables() to authenticated;
