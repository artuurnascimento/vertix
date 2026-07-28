-- =============================================================================
-- Vertix Admin — Agendador operacional (pg_cron) + cobrança automática
--
-- Destrava o restante do plano: o motor recorrente que roda sozinho.
--   1. Refatora generate_subscription_receivables em worker interno + wrapper
--      admin (o cron NÃO tem auth.uid(), então não pode passar por is_admin()).
--   2. job_runs — trilha de auditoria dos disparos automáticos, visível no
--      Financeiro para o time enxergar "o robô rodou".
--   3. Duas rotinas agendadas:
--        - cobrança recorrente (mensal, dia 1 06:00 BRT / 09:00 UTC)
--        - lembretes de pagamento (diário 09:00 BRT / 12:00 UTC → edge fn)
--
-- ATENÇÃO (produção): pg_cron roda em UTC e no banco `postgres`. As rotinas de
-- e-mail chamam a Edge Function via host.docker.internal (stack LOCAL). Em
-- produção, reexecute os cron.schedule apontando para
--   https://<project-ref>.supabase.co/functions/v1/payment-reminders
-- e troque o Bearer pela anon key do projeto (a chave abaixo é a demo pública
-- do `supabase start` — não é segredo).
-- =============================================================================

create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- 1. Cobrança recorrente — worker interno + wrapper admin
-- -----------------------------------------------------------------------------

-- 1.1 Worker interno: contém TODA a lógica de geração, sem guard de auth.
--     Chamado tanto pelo wrapper admin quanto pela rotina agendada.
create or replace function public._generate_subscription_receivables_internal()
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

revoke execute on function public._generate_subscription_receivables_internal()
  from public, anon, authenticated;

-- 1.2 Wrapper admin — mantém a assinatura pública já usada pela UI, agora só
--     valida a permissão e delega ao worker.
create or replace function public.generate_subscription_receivables()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem gerar as cobranças recorrentes.';
  end if;

  return public._generate_subscription_receivables_internal();
end;
$$;

revoke execute on function public.generate_subscription_receivables() from public, anon;
grant execute on function public.generate_subscription_receivables() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. job_runs — auditoria dos disparos do agendador
-- -----------------------------------------------------------------------------

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  status text not null default 'ok'
    check (status in ('ok', 'erro', 'pulado')),
  itens integer not null default 0,
  detalhe text,
  created_at timestamptz not null default now()
);

create index idx_job_runs_created on public.job_runs (created_at desc);

alter table public.job_runs enable row level security;

create policy "team seleciona job_runs"
  on public.job_runs for select
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 3. Rotinas agendadas — funções chamadas pelo cron (rodam como postgres)
-- -----------------------------------------------------------------------------

-- 3.1 Cobrança recorrente mensal
create or replace function public._cron_generate_receivables()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criadas integer;
begin
  v_criadas := public._generate_subscription_receivables_internal();

  insert into public.job_runs (job, status, itens, detalhe)
  values (
    'cobranca-recorrente',
    case when v_criadas > 0 then 'ok' else 'pulado' end,
    v_criadas,
    case
      when v_criadas > 0
        then v_criadas || ' cobrança(s) mensal(is) gerada(s)'
      else 'nenhuma assinatura pendente neste ciclo'
    end
  );

  if v_criadas > 0 then
    perform public.push_notification(
      'pagamento',
      'Cobrança recorrente gerada',
      v_criadas || ' parcela(s) mensal(is) criada(s) automaticamente',
      '/admin/financeiro'
    );
  end if;
exception when others then
  insert into public.job_runs (job, status, itens, detalhe)
  values ('cobranca-recorrente', 'erro', 0, left(sqlerrm, 500));
end;
$$;

revoke execute on function public._cron_generate_receivables()
  from public, anon, authenticated;

-- 3.2 Lembretes de pagamento — dispara a Edge Function (Resend) e registra.
create or replace function public._cron_payment_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'http://host.docker.internal:54321/functions/v1/payment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    ),
    body := '{}'::jsonb
  );

  insert into public.job_runs (job, status, detalhe)
  values ('lembretes-pagamento', 'ok', 'requisição enviada ao edge (Resend)');
exception when others then
  insert into public.job_runs (job, status, itens, detalhe)
  values ('lembretes-pagamento', 'erro', 0, left(sqlerrm, 500));
end;
$$;

revoke execute on function public._cron_payment_reminders()
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Agenda — cron.schedule é idempotente por jobname (reexecuta = atualiza).
-- -----------------------------------------------------------------------------

select cron.schedule(
  'vertix-cobranca-recorrente',
  '0 9 1 * *',                       -- dia 1 às 06:00 BRT (09:00 UTC)
  $$select public._cron_generate_receivables();$$
);

select cron.schedule(
  'vertix-lembretes-pagamento',
  '0 12 * * *',                      -- diário 09:00 BRT (12:00 UTC)
  $$select public._cron_payment_reminders();$$
);
