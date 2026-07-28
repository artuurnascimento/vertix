-- =============================================================================
-- Vertix Admin — NPS pós-entrega
--
-- Barato e automático: quando um projeto vira 'entregue', gera uma pesquisa
-- NPS tokenizada e (via edge nps-request) manda o link ao cliente. O cliente
-- responde em /nps/:token sem login. O time vê o NPS consolidado em Relatórios.
--
-- ATENÇÃO (produção): o disparo de e-mail usa net.http_post para o edge local
-- (host.docker.internal). Em produção, aponte para a URL do projeto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. notifications passa a aceitar o tipo 'nps'
-- -----------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_tipo_check;

alter table public.notifications
  add constraint notifications_tipo_check
  check (tipo in ('lead', 'briefing', 'proposta', 'pagamento', 'ticket', 'nps'));

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.nps_surveys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  score integer check (score between 0 and 10),
  comentario text,
  status text not null default 'pendente'
    check (status in ('pendente', 'respondido')),
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  -- Uma pesquisa por projeto (a entrega dispara uma vez).
  unique (project_id)
);

create index idx_nps_surveys_status on public.nps_surveys (status);

alter table public.nps_surveys enable row level security;

create policy "team seleciona nps_surveys"
  on public.nps_surveys for select
  to authenticated
  using (public.is_team_member());

-- Sem insert/update direto: criação via trigger, resposta via RPC pública.

-- -----------------------------------------------------------------------------
-- 2. Trigger: projeto 'entregue' → cria pesquisa + notifica + dispara e-mail
-- -----------------------------------------------------------------------------

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
    -- Idempotente: se já existe pesquisa para o projeto, não recria.
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

      -- Dispara o e-mail com o link (assíncrono; sem RESEND_API_KEY é no-op).
      perform net.http_post(
        url := 'http://host.docker.internal:54321/functions/v1/nps-request',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
        ),
        body := jsonb_build_object('survey_id', v_survey_id)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger create_nps_on_delivery
  after update on public.projects
  for each row
  execute function public.create_nps_on_delivery();

-- -----------------------------------------------------------------------------
-- 3. RPCs públicas (portal do cliente, sem login)
-- -----------------------------------------------------------------------------

-- 3.1 Carregar a pesquisa pelo token
create or replace function public.get_nps_by_token(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select
    s.status,
    s.score,
    s.comentario,
    p.nome as projeto_nome,
    c.nome as cliente_nome
  into v_row
  from public.nps_surveys s
  join public.projects p on p.id = s.project_id
  join public.clients c on c.id = s.client_id
  where s.token = p_token;

  if not found then
    raise exception 'Pesquisa não encontrada.';
  end if;

  return json_build_object(
    'status', v_row.status,
    'score', v_row.score,
    'comentario', v_row.comentario,
    'projeto_nome', v_row.projeto_nome,
    'cliente_nome', v_row.cliente_nome
  );
end;
$$;

revoke execute on function public.get_nps_by_token(uuid) from public;
grant execute on function public.get_nps_by_token(uuid) to anon, authenticated;

-- 3.2 Registrar a resposta
create or replace function public.submit_nps(
  p_token uuid,
  p_score integer,
  p_comentario text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey public.nps_surveys%rowtype;
begin
  if p_score is null or p_score < 0 or p_score > 10 then
    raise exception 'A nota precisa estar entre 0 e 10.';
  end if;

  select * into v_survey
  from public.nps_surveys
  where token = p_token;

  if not found then
    raise exception 'Pesquisa não encontrada.';
  end if;

  if v_survey.status = 'respondido' then
    raise exception 'Esta pesquisa já foi respondida.';
  end if;

  update public.nps_surveys
  set score = p_score,
      comentario = nullif(btrim(coalesce(p_comentario, '')), ''),
      status = 'respondido',
      responded_at = now()
  where id = v_survey.id;

  perform public.push_notification(
    'nps',
    'Resposta de NPS recebida — nota ' || p_score,
    coalesce(nullif(btrim(coalesce(p_comentario, '')), ''), 'Sem comentário.'),
    '/admin/relatorios'
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.submit_nps(uuid, integer, text) from public;
grant execute on function public.submit_nps(uuid, integer, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Resumo consolidado — NPS = %promotores − %detratores
--    (promotor 9-10 · neutro 7-8 · detrator 0-6). security_invoker respeita RLS.
-- -----------------------------------------------------------------------------

create or replace view public.nps_summary
  with (security_invoker = true)
as
with respostas as (
  select score
  from public.nps_surveys
  where status = 'respondido' and score is not null
)
select
  count(*) as total_respostas,
  count(*) filter (where score >= 9) as promotores,
  count(*) filter (where score between 7 and 8) as neutros,
  count(*) filter (where score <= 6) as detratores,
  (select count(*) from public.nps_surveys) as total_enviadas,
  case
    when count(*) = 0 then null
    else round(
      100.0 * count(*) filter (where score >= 9) / count(*)
      - 100.0 * count(*) filter (where score <= 6) / count(*)
    )
  end as nps
from respostas;

grant select on public.nps_summary to authenticated;
