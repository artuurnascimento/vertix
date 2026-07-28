-- =============================================================================
-- Rate limits nas RPCs públicas (anon)
-- =============================================================================
--
-- Três RPCs expostas a anon aceitavam escrita sem limite de volume:
--
--   • track_utm_conversion — terceiros podiam forjar milhares de "compras"
--     com valor arbitrário, inflando a receita mostrada na dashboard de
--     tráfego que a Vertix entrega ao cliente.
--   • create_ticket — de posse de um portal_token, dava para floodar
--     support_tickets + notifications + activity_log.
--   • create_lead — o throttle existia, mas com race condition (TOCTOU):
--     requisições paralelas liam o count antes dos inserts concorrentes
--     commitarem e passavam do limite de 3.
--
-- Padrão adotado: janela deslizante contada na própria RPC + advisory lock
-- por chave para serializar concorrentes. Idêntico em espírito ao throttle
-- que já existia em lead_submissions, agora sem a brecha de concorrência.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. create_lead — fecha a race condition
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

  -- Serializa envios concorrentes do MESMO email até o fim da transação.
  -- Sem isso, N requisições paralelas liam count=0 e todas passavam.
  perform pg_advisory_xact_lock(hashtext('create_lead:' || lower(btrim(p_email))));

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

-- -----------------------------------------------------------------------------
-- 2. create_ticket — teto de 10 chamados/hora por projeto
-- -----------------------------------------------------------------------------
-- Cliente legítimo nunca abre 10 chamados numa hora; quem tem um token vazado
-- e quer fazer barulho, abre centenas.

create or replace function public.create_ticket(
  p_token uuid,
  p_titulo text,
  p_descricao text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_recent_count integer;
begin
  select * into v_project
  from public.projects
  where portal_token = p_token;

  if not found then
    raise exception 'Projeto não encontrado.';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'Título é obrigatório.';
  end if;

  perform pg_advisory_xact_lock(hashtext('create_ticket:' || v_project.id::text));

  select count(*) into v_recent_count
  from public.support_tickets
  where project_id = v_project.id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 10 then
    raise exception 'Muitos chamados abertos recentemente. Tente novamente mais tarde.';
  end if;

  insert into public.support_tickets (project_id, titulo, descricao)
  values (v_project.id, left(p_titulo, 200), left(coalesce(p_descricao, ''), 5000));

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_project.id,
    null,
    'sistema',
    'Chamado aberto pelo cliente: ' || left(p_titulo, 200)
  );

  return json_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. track_utm_conversion — teto por sessão
-- -----------------------------------------------------------------------------
-- Uma sessão real converte 1x (às vezes 2-3 em teste). 20/hora já é folgado
-- e corta a fabricação em massa de receita fake.

create or replace function public.track_utm_conversion(
  p_session_key text,
  p_tipo text,
  p_valor numeric default 0,
  p_pedido_ref text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_recent_count integer;
begin
  if p_session_key is null
     or length(p_session_key) < 8
     or length(p_session_key) > 64 then
    raise exception 'session_key inválida.';
  end if;

  if p_tipo not in ('lead', 'purchase') then
    raise exception 'Tipo de conversão inválido.';
  end if;

  if p_valor is null or p_valor < 0 or p_valor > 10000000 then
    raise exception 'Valor inválido.';
  end if;

  perform pg_advisory_xact_lock(hashtext('utm_conv:' || p_session_key));

  select id into v_session_id
  from public.utm_sessions
  where session_key = p_session_key;

  if v_session_id is null then
    insert into public.utm_sessions (session_key)
    values (p_session_key)
    on conflict (session_key) do nothing;

    select id into v_session_id
    from public.utm_sessions
    where session_key = p_session_key;
  end if;

  select count(*) into v_recent_count
  from public.utm_conversions
  where session_id = v_session_id
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 20 then
    -- Silencioso de propósito: não devolve pista útil a quem está sondando,
    -- e o snippet do cliente não quebra por causa de um erro de tracking.
    return json_build_object('ok', true, 'throttled', true);
  end if;

  insert into public.utm_conversions (session_id, tipo, valor, pedido_ref)
  values (v_session_id, p_tipo, p_valor, left(p_pedido_ref, 120));

  return json_build_object('ok', true);
exception
  when unique_violation then
    -- pedido_ref repetido → dedupe silencioso.
    return json_build_object('ok', true, 'dedupe', true);
end;
$$;
