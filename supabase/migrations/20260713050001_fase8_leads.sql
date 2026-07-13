-- =============================================================================
-- Vertix Admin — Fase 8: Leads do site → CRM automático
-- Tabela de rate-limit + RPC pública create_lead (SECURITY DEFINER).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de controle de envios (rate limit). Sem policy para anon —
--    só a RPC SECURITY DEFINER acessa; equipe pode consultar via authenticated.
-- -----------------------------------------------------------------------------

create table public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create index idx_lead_submissions_email_created
  on public.lead_submissions (email, created_at desc);

alter table public.lead_submissions enable row level security;

-- Nenhuma policy para anon (RLS habilitada sem policy = bloqueio total).
-- Time pode auditar os envios.
create policy "team can select lead_submissions"
  on public.lead_submissions for select to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. activity_log.tipo: adiciona 'sistema' (eventos automáticos sem autor
--    humano — leads, aprovações de portal, tickets do cliente etc.).
-- -----------------------------------------------------------------------------

alter table public.activity_log
  drop constraint activity_log_tipo_check;

alter table public.activity_log
  add constraint activity_log_tipo_check
  check (tipo in (
    'status_change',
    'briefing_submitted',
    'nota',
    'proposta',
    'financeiro',
    'sistema'
  ));

-- -----------------------------------------------------------------------------
-- 3. RPC pública create_lead — cria cliente + projeto (status 'lead') +
--    activity_log a partir do formulário de contato do vertix-site.
-- -----------------------------------------------------------------------------

create or replace function public.create_lead(
  p_nome text,
  p_email text,
  p_telefone text,
  p_tipo_servico text,
  p_mensagem text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_client_id uuid;
  v_project_id uuid;
  v_tipo_label text;
  v_projeto_nome text;
  v_mensagem_trunc text;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Nome é obrigatório.';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'Email é obrigatório.';
  end if;

  if p_tipo_servico not in ('ecommerce', 'sistema', 'site') then
    raise exception 'Tipo de serviço inválido.';
  end if;

  -- Rate limit: 3+ envios do mesmo email nas últimas 24h.
  select count(*) into v_recent_count
  from public.lead_submissions
  where email = p_email
    and created_at > now() - interval '24 hours';

  if v_recent_count >= 3 then
    raise exception 'Muitos envios recentes. Tente novamente mais tarde.';
  end if;

  insert into public.lead_submissions (email) values (p_email);

  v_tipo_label := case p_tipo_servico
    when 'ecommerce' then 'E-commerce'
    when 'sistema' then 'Sistema'
    when 'site' then 'Site'
  end;

  insert into public.clients (nome, email, telefone, origem)
  values (p_nome, p_email, p_telefone, 'site')
  returning id into v_client_id;

  v_projeto_nome := 'Projeto ' || v_tipo_label || ' — ' || p_nome;

  insert into public.projects (client_id, nome, tipo_servico, status)
  values (v_client_id, v_projeto_nome, p_tipo_servico, 'lead')
  returning id into v_project_id;

  v_mensagem_trunc := left(coalesce(p_mensagem, ''), 500);

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_project_id,
    null,
    'sistema',
    'Lead recebido pelo site' ||
      case when v_mensagem_trunc <> '' then ': ' || v_mensagem_trunc else '' end
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.create_lead(text, text, text, text, text) from public;
grant execute on function public.create_lead(text, text, text, text, text)
  to anon, authenticated;
