-- =============================================================================
-- Segredo compartilhado para as Edge Functions internas
-- =============================================================================
--
-- CRÍTICO corrigido aqui: as functions notify-client, payment-reminders,
-- nps-request e notify-briefing-submitted eram, na prática, públicas.
-- `verify_jwt = true` só exige *algum* JWT do projeto — e a anon key é um JWT
-- válido e público (vai no bundle do frontend). Qualquer pessoa podia:
--
--   • forjar e-mail de cobrança com link de phishing saindo de @vertix.studio;
--   • disparar payment-reminders em loop (spam a todos os clientes, queima do
--     domínio no antispam);
--   • reenviar NPS indefinidamente.
--
-- Solução: header `x-edge-secret` que só os triggers do banco conhecem.
--
-- O segredo é GERADO NO PRÓPRIO BANCO (gen_random_bytes) e nunca entra no git.
-- Depois de aplicar, leia-o e publique nas functions:
--
--   select value from public.internal_config where key = 'edge_shared_secret';
--   supabase secrets set EDGE_SHARED_SECRET=<valor>
--
-- Esta migration também RECONECTA os webhooks de e-mail ao cliente, que
-- estavam inertes em produção (apontavam para host.docker.internal e
-- dependiam de supabase_functions.http_request, que no cloud é um no-op).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Cofre interno
-- -----------------------------------------------------------------------------
-- RLS ligado e ZERO policies: anon e authenticated não enxergam nada.
-- Só service_role / postgres (que ignoram RLS) conseguem ler.

create table if not exists public.internal_config (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table public.internal_config enable row level security;

revoke all on public.internal_config from anon, authenticated;

insert into public.internal_config (key, value)
values
  ('edge_shared_secret', encode(extensions.gen_random_bytes(32), 'hex')),
  ('edge_base_url', 'https://ukgkjrfvilbdkyevsoxz.supabase.co/functions/v1')
on conflict (key) do nothing;

comment on table public.internal_config is
  'Configuração interna (segredos de integração). Sem policies: inacessível a anon/authenticated.';

create or replace function public.internal_secret(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from public.internal_config where key = p_key;
$$;

revoke execute on function public.internal_secret(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Helper de chamada às functions internas
-- -----------------------------------------------------------------------------
-- Centraliza URL + headers para não repetir o segredo em cada trigger.

create or replace function public._call_edge(p_function text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base   text := public.internal_secret('edge_base_url');
  v_secret text := public.internal_secret('edge_shared_secret');
begin
  if v_base is null or v_secret is null then
    raise warning 'internal_config incompleto — chamada a % ignorada.', p_function;
    return;
  end if;

  perform net.http_post(
    url := v_base || '/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-edge-secret', v_secret
    ),
    body := p_body
  );
end;
$$;

revoke execute on function public._call_edge(text, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Rotinas existentes passam a mandar o segredo
-- -----------------------------------------------------------------------------

create or replace function public._cron_payment_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._call_edge('payment-reminders', '{}'::jsonb);

  insert into public.job_runs (job, status, detalhe)
  values ('lembretes-pagamento', 'ok', 'requisição enviada ao edge (Resend)');
exception when others then
  insert into public.job_runs (job, status, itens, detalhe)
  values ('lembretes-pagamento', 'erro', 0, left(sqlerrm, 500));
end;
$$;

create or replace function public.create_nps_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
begin
  if new.status = 'entregue' and old.status is distinct from new.status then
    insert into public.nps_surveys (project_id, client_id, sent_at)
    values (new.id, new.client_id, now())
    on conflict (project_id) do nothing
    returning id into v_survey_id;

    if v_survey_id is not null then
      perform public.push_notification(
        'nps',
        'Pesquisa NPS enviada',
        'Projeto entregue: ' || new.nome || '. Pesquisa de satisfação enviada.',
        '/admin/relatorios'
      );

      perform public._call_edge(
        'nps-request',
        jsonb_build_object('survey_id', v_survey_id)
      );
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Webhooks de e-mail ao cliente — reconectados em produção
-- -----------------------------------------------------------------------------
-- Os triggers antigos usavam supabase_functions.http_request apontando para
-- host.docker.internal (stack local). No cloud isso é um no-op — ou seja,
-- "proposta enviada", "projeto entregue" e "parcela criada" NUNCA notificaram
-- o cliente em produção. Trocamos por net.http_post via _call_edge.
--
-- O corpo leva apenas o ID: a edge function re-busca tudo no banco, de modo que
-- nenhum conteúdo de e-mail dependa de dados vindos da requisição.

drop trigger if exists notify_client_proposta_enviada on public.proposals;
drop trigger if exists notify_client_projeto_entregue on public.projects;
drop trigger if exists notify_client_parcela_criada on public.receivables;

create or replace function public._notify_proposta_enviada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._call_edge(
    'notify-client',
    jsonb_build_object(
      'event', 'proposta_enviada',
      'record', jsonb_build_object('id', new.id)
    )
  );
  return new;
exception when others then
  raise warning 'notify-client (proposta_enviada) falhou: %', sqlerrm;
  return new;
end;
$$;

create trigger notify_client_proposta_enviada
  after update on public.proposals
  for each row
  when (old.sent_at is null and new.sent_at is not null)
  execute function public._notify_proposta_enviada();

create or replace function public._notify_projeto_entregue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._call_edge(
    'notify-client',
    jsonb_build_object(
      'event', 'projeto_entregue',
      'record', jsonb_build_object('id', new.id)
    )
  );
  return new;
exception when others then
  raise warning 'notify-client (projeto_entregue) falhou: %', sqlerrm;
  return new;
end;
$$;

create trigger notify_client_projeto_entregue
  after update on public.projects
  for each row
  when (new.status = 'entregue' and old.status is distinct from new.status)
  execute function public._notify_projeto_entregue();

create or replace function public._notify_parcela_criada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._call_edge(
    'notify-client',
    jsonb_build_object(
      'event', 'parcela_criada',
      'record', jsonb_build_object('id', new.id)
    )
  );
  return new;
exception when others then
  raise warning 'notify-client (parcela_criada) falhou: %', sqlerrm;
  return new;
end;
$$;

create trigger notify_client_parcela_criada
  after insert on public.receivables
  for each row
  execute function public._notify_parcela_criada();

-- -----------------------------------------------------------------------------
-- 5. Briefing preenchido — mesmo tratamento
-- -----------------------------------------------------------------------------

drop trigger if exists notify_briefing_submitted_webhook on public.briefings;

create or replace function public._notify_briefing_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._call_edge(
    'notify-briefing-submitted',
    jsonb_build_object('record', jsonb_build_object('id', new.id))
  );
  return new;
exception when others then
  raise warning 'notify-briefing-submitted falhou: %', sqlerrm;
  return new;
end;
$$;

create trigger notify_briefing_submitted_webhook
  after update on public.briefings
  for each row
  when (new.status = 'preenchido' and old.status is distinct from new.status)
  execute function public._notify_briefing_submitted();
