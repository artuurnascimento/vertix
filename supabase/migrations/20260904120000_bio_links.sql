-- =============================================================================
-- Vertix Admin — Link de bio (bio.vertix.studio)
-- Página pública de atalhos rápidos, servida pelo mesmo deploy do painel (o
-- host decide o que renderizar, como em pay./go.). Os botões são editáveis no
-- console e a página lê tudo daqui — trocar a campanha do topo não exige
-- deploy. Cada visita e cada clique viram evento, para responder qual atalho
-- traz cliente.
-- Acesso público: NENHUMA policy para anon (o padrão do projeto — RLS
-- habilitada sem policy = bloqueio total). O visitante entra só pelas duas
-- funções security definer abaixo, como em track_utm_visit: get_bio_links
-- devolve os botões visíveis e registrar_evento_bio grava a medição com
-- limite por sessão. Escrita direta pelo navegador permitiria inflar os
-- números e envenenar a decisão de qual atalho funciona.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.bio_links (
  id uuid primary key default gen_random_uuid(),
  rotulo text not null,
  descricao text,
  icone text,
  formato text not null default 'grade'
    check (formato in ('destaque', 'largo', 'grade')),
  tipo_destino text not null
    check (tipo_destino in ('url', 'whatsapp')),
  destino text not null default '',
  mensagem text,
  posicao integer not null default 0,
  ativo boolean not null default true,
  inicia_em timestamptz,
  termina_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um evento por visita ou clique. Mesmas colunas para os dois tipos, e são
-- sempre lidos juntos no cálculo de taxa — daí uma tabela só.
create table public.bio_events (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in ('visita', 'clique')),
  link_id uuid references public.bio_links (id) on delete set null,
  sessao text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

create index idx_bio_links_posicao on public.bio_links (posicao);
create index idx_bio_events_link_id on public.bio_events (link_id);
create index idx_bio_events_tipo_created on public.bio_events (tipo, created_at desc);
-- Suporta o teto por sessão na última hora dentro de registrar_evento_bio.
create index idx_bio_events_sessao_created on public.bio_events (sessao, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Trigger updated_at em bio_links (reusa public.set_updated_at)
-- -----------------------------------------------------------------------------

create trigger set_updated_at
  before update on public.bio_links
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS: bio_links — CRUD do time (padrão lojas)
-- -----------------------------------------------------------------------------

alter table public.bio_links enable row level security;

create policy "team seleciona bio_links"
  on public.bio_links for select
  to authenticated
  using (public.is_team_member());

create policy "team insere bio_links"
  on public.bio_links for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza bio_links"
  on public.bio_links for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui bio_links"
  on public.bio_links for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 5. RLS: bio_events — só leitura do time (padrão utm_sessions).
--    Escrita exclusiva da RPC registrar_evento_bio; nenhuma policy de escrita.
--    Nenhuma policy para anon (RLS habilitada sem policy = bloqueio total).
-- -----------------------------------------------------------------------------

alter table public.bio_events enable row level security;

create policy "team seleciona bio_events"
  on public.bio_events for select
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 6. RPC pública: botões visíveis agora (ativos e dentro da vigência),
--    já ordenados. Só as colunas de exibição.
-- -----------------------------------------------------------------------------

create or replace function public.get_bio_links()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', l.id,
        'rotulo', l.rotulo,
        'descricao', l.descricao,
        'icone', l.icone,
        'formato', l.formato,
        'tipo_destino', l.tipo_destino,
        'destino', l.destino,
        'mensagem', l.mensagem,
        'posicao', l.posicao
      )
      order by l.posicao, l.created_at
    ),
    '[]'::json
  )
  from public.bio_links l
  where l.ativo
    and (l.inicia_em is null or l.inicia_em <= now())
    and (l.termina_em is null or l.termina_em > now())
    and l.destino <> '';
$$;

revoke execute on function public.get_bio_links() from public;
grant execute on function public.get_bio_links() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. RPC pública: registra visita ou clique. Teto de 30 eventos por sessão
--    por hora — silencioso de propósito (padrão track_utm_conversion): não
--    devolve pista a quem está sondando e a página não quebra por medição.
-- -----------------------------------------------------------------------------

create or replace function public.registrar_evento_bio(
  p_tipo text,
  p_sessao text,
  p_link_id uuid default null,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  if p_tipo is null or p_tipo not in ('visita', 'clique') then
    raise exception 'tipo inválido.';
  end if;

  if p_sessao is null
     or length(p_sessao) < 8
     or length(p_sessao) > 64 then
    raise exception 'sessao inválida.';
  end if;

  if p_tipo = 'clique' then
    if p_link_id is null then
      raise exception 'clique exige link_id.';
    end if;
    -- Clique só conta em botão que existe e está ligado.
    if not exists (
      select 1 from public.bio_links where id = p_link_id and ativo
    ) then
      raise exception 'link inválido.';
    end if;
  end if;

  -- Serializa por sessão: sem isso, chamadas simultâneas furam o teto.
  perform pg_advisory_xact_lock(hashtext('bio_evt:' || p_sessao));

  select count(*) into v_recent_count
  from public.bio_events
  where sessao = p_sessao
    and created_at > now() - interval '1 hour';

  if v_recent_count >= 30 then
    return json_build_object('ok', true, 'throttled', true);
  end if;

  insert into public.bio_events (
    tipo, link_id, sessao, utm_source, utm_medium, utm_campaign
  )
  values (
    p_tipo,
    case when p_tipo = 'clique' then p_link_id else null end,
    p_sessao,
    left(p_source, 120),
    left(p_medium, 120),
    left(p_campaign, 120)
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.registrar_evento_bio(
  text, text, uuid, text, text, text
) from public;
grant execute on function public.registrar_evento_bio(
  text, text, uuid, text, text, text
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Conteúdo inicial da página.
--    O destaque nasce DESLIGADO e sem destino: o Vertix Scan ainda não tem
--    servidor publicado, e apontar o card principal para ele entregaria uma
--    página que promete análise e não analisa. Quando o Scan subir, basta
--    preencher o destino e ligar pelo console — sem deploy.
-- -----------------------------------------------------------------------------

insert into public.bio_links
  (rotulo, descricao, icone, formato, tipo_destino, destino, mensagem, posicao, ativo)
values
  (
    'Sua loja aguenta um scan?',
    'Nota de 0 a 100 em 60 segundos, grátis',
    'radar',
    'destaque',
    'url',
    '',
    null,
    10,
    false
  ),
  (
    'Falar no WhatsApp',
    'Resposta no mesmo dia',
    'message-circle',
    'largo',
    'whatsapp',
    '5562996076194',
    null,
    20,
    true
  ),
  (
    'Loja Shopify',
    'Do zero ou migração',
    'store',
    'grade',
    'whatsapp',
    '5562996076194',
    'Oi, Vertix! Quero falar sobre uma loja Shopify.',
    30,
    true
  ),
  (
    'Sistemas',
    'Sob medida',
    'settings',
    'grade',
    'whatsapp',
    '5562996076194',
    'Oi, Vertix! Quero falar sobre um sistema sob medida.',
    40,
    true
  ),
  (
    'Landing page',
    'Pronta pra tráfego',
    'layout',
    'grade',
    'url',
    'https://www.vertix.studio/#servicos',
    null,
    50,
    true
  ),
  (
    'Projetos',
    'Cases recentes',
    'layers',
    'grade',
    'url',
    'https://www.vertix.studio/#projetos',
    null,
    60,
    true
  );
