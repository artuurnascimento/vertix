-- =============================================================================
-- Rastreador UTM first-party (v1): links gerados no admin, sessões captadas
-- no site de destino e conversões atribuídas. Escrita pública SÓ via RPCs
-- SECURITY DEFINER (padrão create_lead); time lê tudo.
-- utm_campaign carrega {{campaign.id}} da Meta → join com
-- ad_campaigns.meta_campaign_id sem mapeamento manual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Links UTM criados no admin (construtor de links).
-- -----------------------------------------------------------------------------

create table public.utm_links (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url_destino text not null,
  utm_source text not null default 'facebook',
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz not null default now()
);

alter table public.utm_links enable row level security;

create policy "team gerencia utm_links"
  on public.utm_links for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. Sessões captadas no destino (1 linha por browser-session).
--    Escrita exclusiva da RPC track_utm_visit; nenhuma policy de escrita.
-- -----------------------------------------------------------------------------

create table public.utm_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_url text,
  referrer text,
  created_at timestamptz not null default now()
);

create index idx_utm_sessions_campaign_created
  on public.utm_sessions (utm_campaign, created_at desc);

alter table public.utm_sessions enable row level security;

create policy "team seleciona utm_sessions"
  on public.utm_sessions for select
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 3. Conversões atribuídas à sessão. Dedupe por pedido_ref.
-- -----------------------------------------------------------------------------

create table public.utm_conversions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.utm_sessions (id) on delete cascade,
  tipo text not null check (tipo in ('lead', 'purchase')),
  valor numeric(12,2) not null default 0,
  pedido_ref text,
  created_at timestamptz not null default now()
);

create index idx_utm_conversions_session on public.utm_conversions (session_id);
create unique index idx_utm_conversions_pedido_ref
  on public.utm_conversions (pedido_ref)
  where pedido_ref is not null;

alter table public.utm_conversions enable row level security;

create policy "team seleciona utm_conversions"
  on public.utm_conversions for select
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 4. RPC pública: registra visita. Idempotente por session_key (retorna ok
--    sem duplicar). Campos truncados; session_key limitada a 8–64 chars.
-- -----------------------------------------------------------------------------

create or replace function public.track_utm_visit(
  p_session_key text,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null,
  p_content text default null,
  p_term text default null,
  p_landing_url text default null,
  p_referrer text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_key is null
     or length(p_session_key) < 8
     or length(p_session_key) > 64 then
    raise exception 'session_key inválida.';
  end if;

  insert into public.utm_sessions (
    session_key, utm_source, utm_medium, utm_campaign,
    utm_content, utm_term, landing_url, referrer
  )
  values (
    p_session_key,
    left(p_source, 120),
    left(p_medium, 120),
    left(p_campaign, 120),
    left(p_content, 120),
    left(p_term, 120),
    left(p_landing_url, 500),
    left(p_referrer, 500)
  )
  on conflict (session_key) do nothing;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.track_utm_visit(
  text, text, text, text, text, text, text, text
) from public;
grant execute on function public.track_utm_visit(
  text, text, text, text, text, text, text, text
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPC pública: registra conversão. Sessão desconhecida → cria stub
--    (conversão nunca se perde). pedido_ref repetido → no-op (dedupe).
-- -----------------------------------------------------------------------------

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

  insert into public.utm_conversions (session_id, tipo, valor, pedido_ref)
  values (v_session_id, p_tipo, p_valor, left(p_pedido_ref, 120));

  return json_build_object('ok', true);
exception
  when unique_violation then
    -- pedido_ref repetido → dedupe silencioso.
    return json_build_object('ok', true, 'dedupe', true);
end;
$$;

revoke execute on function public.track_utm_conversion(
  text, text, numeric, text
) from public;
grant execute on function public.track_utm_conversion(
  text, text, numeric, text
) to anon, authenticated;
