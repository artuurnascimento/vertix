-- =============================================================================
-- Vertix Admin — Onboarding + nudges automáticos
--
-- Fecha o buraco do "ninguém cutuca": um motor diário varre o funil e cria
-- lembretes acionáveis (nudges) quando algo trava —
--   • cliente novo sem onboarding
--   • briefing enviado e não respondido (>3 dias)
--   • proposta enviada e sem resposta (>5 dias)
--   • projeto em revisão aguardando o cliente (>4 dias)
--   • parcela vencida
--   • projeto em desenvolvimento sem movimento (>14 dias)
--
-- Cada nudge é idempotente por dedupe_key (não spamma) e também empurra uma
-- notificação para o sino. Resolver o nudge é ação do time (RLS update).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in (
      'onboarding',
      'briefing_parado',
      'proposta_sem_resposta',
      'aguardando_cliente',
      'pagamento_atrasado',
      'projeto_parado'
    )),
  severidade text not null default 'atencao'
    check (severidade in ('info', 'atencao', 'urgente')),
  titulo text not null,
  descricao text,
  link text,
  project_id uuid references public.projects (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  dedupe_key text not null unique,
  resolvido boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_nudges_aberto_created
  on public.nudges (resolvido, created_at desc);

alter table public.nudges enable row level security;

create policy "team seleciona nudges"
  on public.nudges for select
  to authenticated
  using (public.is_team_member());

-- Time marca como resolvido; inserção só via security definer (push_nudge).
create policy "team atualiza nudges"
  on public.nudges for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. Helper de inserção idempotente + notificação
-- -----------------------------------------------------------------------------

create or replace function public.push_nudge(
  p_tipo text,
  p_severidade text,
  p_titulo text,
  p_descricao text,
  p_link text,
  p_project_id uuid,
  p_client_id uuid,
  p_dedupe_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserido boolean := false;
begin
  insert into public.nudges (
    tipo, severidade, titulo, descricao, link, project_id, client_id, dedupe_key
  )
  values (
    p_tipo, p_severidade, p_titulo, p_descricao, p_link,
    p_project_id, p_client_id, p_dedupe_key
  )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_inserido = row_count;

  if v_inserido then
    perform public.push_notification('ticket', p_titulo, p_descricao, p_link);
  end if;

  return v_inserido;
end;
$$;

revoke execute on function public.push_nudge(
  text, text, text, text, text, uuid, uuid, text
) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Onboarding — novo cliente entra com um nudge de boas-vindas.
-- -----------------------------------------------------------------------------

create or replace function public.nudge_onboarding_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_nudge(
    'onboarding',
    'info',
    'Fazer onboarding — ' || new.nome,
    'Cliente novo cadastrado. Enviar boas-vindas, alinhar expectativas e '
      || 'próximos passos.',
    '/admin/clientes/' || new.id,
    null,
    new.id,
    'onboarding:' || new.id
  );
  return new;
end;
$$;

create trigger nudge_onboarding_cliente
  after insert on public.clients
  for each row
  execute function public.nudge_onboarding_cliente();

-- -----------------------------------------------------------------------------
-- 4. Varredura do funil — cria nudges para itens travados.
-- -----------------------------------------------------------------------------

create or replace function public._scan_nudges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_criados integer := 0;
begin
  -- 4.1 Briefing enviado e não respondido há mais de 3 dias.
  for v_rec in
    select p.id, p.nome, p.client_id
    from public.projects p
    where p.status = 'briefing_enviado'
      and p.updated_at < now() - interval '3 days'
  loop
    if public.push_nudge(
      'briefing_parado', 'atencao',
      'Briefing sem resposta — ' || v_rec.nome,
      'O briefing foi enviado há mais de 3 dias e ainda não foi respondido.',
      '/admin/projetos/' || v_rec.id,
      v_rec.id, v_rec.client_id,
      'briefing_parado:' || v_rec.id
    ) then
      v_criados := v_criados + 1;
    end if;
  end loop;

  -- 4.2 Proposta enviada e sem resposta há mais de 5 dias.
  for v_rec in
    select pr.id, pr.titulo, pr.project_id, p.client_id
    from public.proposals pr
    join public.projects p on p.id = pr.project_id
    where pr.status = 'enviada'
      and pr.sent_at is not null
      and pr.sent_at < now() - interval '5 days'
  loop
    if public.push_nudge(
      'proposta_sem_resposta', 'atencao',
      'Proposta parada — ' || v_rec.titulo,
      'Enviada há mais de 5 dias sem aceite ou recusa. Vale um follow-up.',
      '/admin/propostas',
      v_rec.project_id, v_rec.client_id,
      'proposta_sem_resposta:' || v_rec.id
    ) then
      v_criados := v_criados + 1;
    end if;
  end loop;

  -- 4.3 Projeto em revisão aguardando o cliente há mais de 4 dias.
  for v_rec in
    select p.id, p.nome, p.client_id
    from public.projects p
    where p.status = 'revisao'
      and p.updated_at < now() - interval '4 days'
  loop
    if public.push_nudge(
      'aguardando_cliente', 'atencao',
      'Revisão parada — ' || v_rec.nome,
      'O projeto está em revisão aguardando retorno do cliente há mais de '
        || '4 dias.',
      '/admin/projetos/' || v_rec.id,
      v_rec.id, v_rec.client_id,
      'aguardando_cliente:' || v_rec.id
    ) then
      v_criados := v_criados + 1;
    end if;
  end loop;

  -- 4.4 Parcela vencida (uma por receivable).
  for v_rec in
    select r.id, r.descricao, r.vencimento, r.project_id, r.client_id
    from public.receivables r
    where r.status = 'pendente'
      and r.vencimento < current_date
  loop
    if public.push_nudge(
      'pagamento_atrasado', 'urgente',
      'Pagamento vencido — ' || v_rec.descricao,
      'Parcela vencida em ' || to_char(v_rec.vencimento, 'DD/MM/YYYY')
        || '. Acionar cobrança.',
      '/admin/financeiro',
      v_rec.project_id, v_rec.client_id,
      'pagamento_atrasado:' || v_rec.id
    ) then
      v_criados := v_criados + 1;
    end if;
  end loop;

  -- 4.5 Projeto em desenvolvimento sem movimento há mais de 14 dias.
  for v_rec in
    select p.id, p.nome, p.client_id
    from public.projects p
    where p.status = 'em_desenvolvimento'
      and p.updated_at < now() - interval '14 days'
  loop
    if public.push_nudge(
      'projeto_parado', 'atencao',
      'Projeto parado — ' || v_rec.nome,
      'Sem atualização de status há mais de 14 dias. Revisar andamento.',
      '/admin/projetos/' || v_rec.id,
      v_rec.id, v_rec.client_id,
      'projeto_parado:' || v_rec.id
    ) then
      v_criados := v_criados + 1;
    end if;
  end loop;

  return v_criados;
end;
$$;

revoke execute on function public._scan_nudges() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Rotina agendada — varre diariamente e registra em job_runs.
-- -----------------------------------------------------------------------------

create or replace function public._cron_scan_nudges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criados integer;
begin
  v_criados := public._scan_nudges();

  insert into public.job_runs (job, status, itens, detalhe)
  values (
    'varredura-nudges',
    'ok',
    v_criados,
    v_criados || ' novo(s) alerta(s) criado(s)'
  );
exception when others then
  insert into public.job_runs (job, status, itens, detalhe)
  values ('varredura-nudges', 'erro', 0, left(sqlerrm, 500));
end;
$$;

revoke execute on function public._cron_scan_nudges()
  from public, anon, authenticated;

select cron.schedule(
  'vertix-varredura-nudges',
  '0 11 * * *',                      -- diário 08:00 BRT (11:00 UTC)
  $$select public._cron_scan_nudges();$$
);
