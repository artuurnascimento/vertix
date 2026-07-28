-- =============================================================================
-- Trilha de auditoria (IP/user-agent) + rate limit por IP
-- =============================================================================
--
-- Fecha os últimos pontos levantados na auditoria:
--
--   • Assinatura de contrato e aceite de proposta gravavam só o nome digitado.
--     Numa disputa, "alguém com o link digitou este nome" é prova fraca.
--     Agora registramos IP e user-agent do momento do ato.
--   • create_lead limitava por e-mail — que o próprio remetente escolhe.
--     Bastava variar o e-mail para floodar o CRM. Agora há teto por IP também.
--
-- O IP vem do GUC `request.headers` que o PostgREST popula a cada requisição.
-- É lido no servidor: o cliente não consegue forjar, porque o x-forwarded-for
-- é reescrito pela borda da Supabase antes de chegar ao Postgres.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helpers de requisição
-- -----------------------------------------------------------------------------
-- Ambos devolvem null silenciosamente fora de um contexto PostgREST (psql,
-- cron, triggers), para nunca derrubar a operação principal.

create or replace function public.request_client_ip()
returns inet
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers json;
  v_raw text;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  -- x-forwarded-for = "cliente, proxy1, proxy2" → o primeiro é o cliente.
  v_raw := btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
  if v_raw = '' then
    return null;
  end if;

  begin
    return v_raw::inet;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.request_user_agent()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers json;
begin
  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  return left(v_headers ->> 'user-agent', 400);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Colunas de auditoria
-- -----------------------------------------------------------------------------

alter table public.contracts
  add column if not exists signer_ip inet,
  add column if not exists signer_user_agent text;

alter table public.proposals
  add column if not exists aceite_ip inet,
  add column if not exists aceite_user_agent text;

alter table public.lead_submissions
  add column if not exists ip inet;

create index if not exists lead_submissions_ip_created_idx
  on public.lead_submissions (ip, created_at desc);

comment on column public.contracts.signer_ip is
  'IP de origem no momento da assinatura (trilha de auditoria).';

-- -----------------------------------------------------------------------------
-- 3. sign_contract — grava a trilha
-- -----------------------------------------------------------------------------

create or replace function public.sign_contract(
  p_token uuid,
  p_signer_name text,
  p_signer_document text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts%rowtype;
  v_ip inet;
begin
  select * into v_contract
  from public.contracts
  where token = p_token
  for update;

  if not found then
    raise exception 'Contrato não encontrado.';
  end if;

  if v_contract.status = 'assinado' then
    raise exception 'Este contrato já foi assinado.';
  end if;

  if p_signer_name is null or btrim(p_signer_name) = '' then
    raise exception 'Nome do assinante é obrigatório.';
  end if;

  v_ip := public.request_client_ip();

  update public.contracts
  set status = 'assinado',
      signed_at = now(),
      signer_name = p_signer_name,
      signer_document = p_signer_document,
      signer_ip = v_ip,
      signer_user_agent = public.request_user_agent()
  where id = v_contract.id;

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_contract.project_id,
    null,
    'sistema',
    'Contrato assinado por ' || p_signer_name ||
      coalesce(' (IP ' || host(v_ip) || ')', '')
  );

  return json_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. respond_proposal — grava a trilha no aceite/recusa
-- -----------------------------------------------------------------------------

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
  v_ip inet;
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

  v_ip := public.request_client_ip();

  if p_aceite then
    update public.proposals
    set status = 'aceita',
        accepted_at = now(),
        aceite_nome = p_nome,
        aceite_ip = v_ip,
        aceite_user_agent = public.request_user_agent()
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
      'Proposta "' || v_proposal.titulo || '" aceita por ' || p_nome ||
        coalesce(' (IP ' || host(v_ip) || ')', '')
    );
  else
    update public.proposals
    set status = 'recusada',
        aceite_ip = v_ip,
        aceite_user_agent = public.request_user_agent()
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

-- -----------------------------------------------------------------------------
-- 5. create_lead — teto por IP além do teto por e-mail
-- -----------------------------------------------------------------------------
-- O limite por e-mail (3/24h) é contornável trocando o e-mail. O teto por IP
-- (10/24h) segura o flood real. Assinatura da RPC preservada.

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
  v_ip inet;
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

  v_ip := public.request_client_ip();

  -- Serializa envios concorrentes do MESMO email até o fim da transação.
  perform pg_advisory_xact_lock(hashtext('create_lead:' || lower(btrim(p_email))));

  -- Teto por IP: pega quem varia o e-mail para burlar o limite abaixo.
  if v_ip is not null then
    select count(*) into v_recent_count
    from public.lead_submissions
    where ip = v_ip
      and created_at > now() - interval '24 hours';

    if v_recent_count >= 10 then
      raise exception 'Muitos envios recentes. Tente novamente mais tarde.';
    end if;
  end if;

  -- Teto por e-mail: 3 envios em 24h.
  select count(*) into v_recent_count
  from public.lead_submissions
  where email = p_email
    and created_at > now() - interval '24 hours';

  if v_recent_count >= 3 then
    raise exception 'Muitos envios recentes. Tente novamente mais tarde.';
  end if;

  insert into public.lead_submissions (email, ip) values (p_email, v_ip);

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
