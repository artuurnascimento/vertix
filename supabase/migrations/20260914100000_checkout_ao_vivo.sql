-- ============================================================================
-- Checkout AO VIVO — sessões e eventos de quem está na página agora
-- ============================================================================
-- O painel precisa ver, em tempo real, cada pessoa dentro do checkout: de onde
-- ela veio, em que cidade está, que parte da página está olhando, o que já
-- preencheu, se clicou em pagar, se o Pix abriu, se comprou — e a linha do
-- tempo completa disso. É o "Live View" da Shopify, para o checkout próprio.
--
-- Duas tabelas:
--
--   checkout_sessoes  UMA linha por visita (aba do navegador). Guarda o
--                     estado ATUAL: etapa, seção visível, campo em foco,
--                     contato já digitado, método, total, pedido. É esta linha
--                     que o painel lista e que o Realtime empurra a cada
--                     mudança — quem olha a lista não precisa somar eventos.
--
--   checkout_eventos  A linha do tempo: um registro por passo, na ordem em que
--                     aconteceu. É o que abre ao clicar numa sessão.
--
-- Quem escreve é o NAVEGADOR DO VISITANTE, sem login, pela RPC
-- checkout_rastrear() — e só por ela. As tabelas não dão INSERT a ninguém que
-- não seja service role: a função é SECURITY DEFINER, valida cada campo,
-- limita tamanho e quantidade, e decide sozinha o que muda na sessão. Um
-- cliente malicioso consegue, no máximo, inventar visitas falsas em um
-- checkout que existe; não consegue ler nada, nem tocar em pedido, nem
-- escrever texto sem limite.
--
-- O painel lê (equipe, via RLS) e recebe as mudanças pelo Realtime, que
-- respeita as mesmas policies.
--
-- Bot: a RPC classifica a sessão na chegada (user agent de crawler/preview,
-- navigator.webdriver, cabeçalhos ausentes) e o painel completa com o sinal
-- comportamental — sessão que passa 20 s sem um único toque, rolagem ou tecla
-- não é gente. Os dois ficam gravados (`bot`, `bot_motivo`) para os números
-- do painel (visitantes agora, funil) contarem só pessoas.
--
-- Privacidade: nunca guardamos IP — a cidade/UF chega já resolvida pelo
-- /api/geo (cabeçalhos da Vercel) e a coordenada é arredondada a duas casas
-- (~1 km). Documento (CPF/CNPJ) nunca é gravado, só o fato de ter sido
-- preenchido. Dados de cartão não passam por aqui em hipótese alguma: vivem
-- nos iframes do Mercado Pago.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Sessões
-- ---------------------------------------------------------------------------

create table if not exists public.checkout_sessoes (
  -- Gerado no navegador (crypto.randomUUID) e guardado no sessionStorage da
  -- aba: a mesma visita continua a mesma sessão pelo upsell e pelo obrigado.
  id uuid primary key,
  checkout_id uuid not null references public.checkouts (id) on delete cascade,
  -- Id do NAVEGADOR (localStorage). Repete entre visitas: é o que diz "essa
  -- pessoa já esteve aqui 3 vezes".
  visitante_id uuid,

  iniciado_em timestamptz not null default now(),
  ultimo_evento_em timestamptz not null default now(),
  -- Preenchido pelo evento 'saiu' (pagehide). NULL com ultimo_evento_em velho
  -- também significa que foi embora — o navegador nem sempre avisa.
  encerrada_em timestamptz,
  -- A aba está visível? Falso = trocou de aba/app sem fechar a página.
  visivel boolean not null default true,

  -- Estado atual, decidido pela RPC a partir do último evento relevante:
  --   chegou · dados · pagamento · pagando · pix · analise · aprovado ·
  --   recusado · upsell · upsell_aceito · concluido
  etapa text not null default 'chegou',
  -- Parte da página no centro da tela agora (resumo, bump, cupom, dados,
  -- pagamento, garantia, avaliacoes). É o "onde a pessoa está olhando".
  secao text,
  -- Campo com o cursor agora (nome, email, whatsapp, documento, cartao).
  foco text,

  -- Marcos do funil. Só a primeira vez conta; nunca voltam a NULL.
  dados_em timestamptz,
  pagar_em timestamptz,
  pagamento_em timestamptz,
  aprovado_em timestamptz,
  obrigado_em timestamptz,

  -- Primeiro sinal humano (toque, mouse, tecla, rolagem). NULL depois de 20 s
  -- de atividade = não é gente.
  interagiu_em timestamptz,
  bot boolean not null default false,
  bot_motivo text,

  -- O que a pessoa já digitou. Documento fica de fora de propósito.
  nome text,
  email text,
  whatsapp text,
  documento_preenchido boolean not null default false,

  metodo text check (metodo is null or metodo in ('cartao','pix')),
  bump boolean not null default false,
  cupom text,
  -- Prévia do total na tela (o valor que vale é o do pedido).
  total_centavos integer check (total_centavos is null or total_centavos >= 0),
  pedido_id uuid references public.pedidos (id) on delete set null,

  -- De onde veio e com o quê.
  dispositivo text,
  navegador text,
  so text,
  largura integer,
  altura integer,
  agente text,
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  cidade text,
  estado text,
  pais text,
  latitude double precision,
  longitude double precision,

  -- Contador para o teto de eventos por sessão (ver RPC).
  eventos integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.checkout_sessoes is
  'Uma visita ao checkout (aba do navegador), com o estado atual: etapa, seção visível, contato digitado, método, pedido. Escrita só pela RPC checkout_rastrear().';
comment on column public.checkout_sessoes.secao is
  'Parte da página no centro da tela agora — o que a pessoa está olhando.';
comment on column public.checkout_sessoes.bot is
  'Classificação da RPC na chegada (agente de crawler/preview, webdriver). O painel soma o sinal comportamental por cima.';
comment on column public.checkout_sessoes.documento_preenchido is
  'Só o FATO de ter preenchido CPF/CNPJ. O valor nunca é gravado.';

create index if not exists checkout_sessoes_ultimo_evento_idx
  on public.checkout_sessoes (ultimo_evento_em desc);
create index if not exists checkout_sessoes_iniciado_idx
  on public.checkout_sessoes (iniciado_em desc);
create index if not exists checkout_sessoes_checkout_idx
  on public.checkout_sessoes (checkout_id);
create index if not exists checkout_sessoes_pedido_idx
  on public.checkout_sessoes (pedido_id);
create index if not exists checkout_sessoes_visitante_idx
  on public.checkout_sessoes (visitante_id);

drop trigger if exists set_updated_at on public.checkout_sessoes;
create trigger set_updated_at
  before update on public.checkout_sessoes
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Eventos — a linha do tempo
-- ---------------------------------------------------------------------------

create table if not exists public.checkout_eventos (
  id bigint generated always as identity primary key,
  sessao_id uuid not null references public.checkout_sessoes (id) on delete cascade,
  tipo text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

comment on table public.checkout_eventos is
  'Linha do tempo de uma sessão do checkout: um registro por passo (chegou, olhou, preencheu, clicou em pagar, pagamento...). Escrita só pela RPC checkout_rastrear().';

create index if not exists checkout_eventos_sessao_idx
  on public.checkout_eventos (sessao_id, criado_em);
create index if not exists checkout_eventos_criado_idx
  on public.checkout_eventos (criado_em desc);

-- ---------------------------------------------------------------------------
-- 3. A RPC que o navegador chama
-- ---------------------------------------------------------------------------
-- Um único ponto de entrada para tudo: cria a sessão no primeiro evento que
-- chegar (a ordem na rede não é garantida), atualiza o estado atual conforme
-- o tipo, e grava o evento na linha do tempo — exceto os que só servem para
-- manter a sessão viva ('pulso') ou completá-la ('localizou'), que não são
-- passos de ninguém.
--
-- Defesas, nesta ordem:
--   · tipo fora da lista → ignora (não é erro: um navegador velho com um
--     tipo novo não deve quebrar a página de pagamento);
--   · dados acima de 4 KB → ignora;
--   · checkout inexistente → ignora;
--   · sessão com 600 eventos → ignora (uma visita real tem dezenas).
--   · todo texto gravado passa por left(): nada cresce sem teto.
-- Ela NUNCA lança erro para o navegador: a página de pagamento não pode
-- falhar por causa do rastreio.

create or replace function public.checkout_rastrear(
  p_sessao uuid,
  p_slug text,
  p_tipo text,
  p_dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkout_id uuid;
  v_sessao public.checkout_sessoes%rowtype;
  v_dados jsonb := coalesce(p_dados, '{}'::jsonb);
  v_agente text;
  v_bot_motivo text;
  v_campo text;
  v_valor text;
  v_resultado text;
  v_pedido uuid;
  v_texto text;
  v_agora timestamptz := now();
begin
  if p_sessao is null or p_tipo is null then
    return;
  end if;
  if p_tipo not in (
    'entrou','localizou','pulso','aba','interagiu','olhou','digitando',
    'preencheu','bump','cupom','metodo','clicou_pagar','pagamento','pix',
    'upsell','obrigado','erro','saiu'
  ) then
    return;
  end if;
  if jsonb_typeof(v_dados) <> 'object' or pg_column_size(v_dados) > 4096 then
    return;
  end if;

  -- A sessão já existe? Senão, nasce agora, com o checkout do slug.
  select * into v_sessao from public.checkout_sessoes where id = p_sessao;
  if not found then
    select id into v_checkout_id
      from public.checkouts
     where slug = lower(trim(coalesce(p_slug, '')));
    if v_checkout_id is null then
      return;
    end if;
    insert into public.checkout_sessoes (id, checkout_id)
      values (p_sessao, v_checkout_id)
      on conflict (id) do nothing;
    select * into v_sessao from public.checkout_sessoes where id = p_sessao;
  end if;

  if v_sessao.eventos >= 600 then
    return;
  end if;

  -- ---- chegada: quem é, de onde veio, e é gente? -------------------------
  if p_tipo = 'entrou' then
    v_agente := left(coalesce(v_dados->>'agente', ''), 400);
    v_bot_motivo := case
      when (v_dados->'webdriver' = 'true'::jsonb) then 'webdriver'
      when v_agente = '' then 'sem_agente'
      when v_agente ~* '(bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|ptst|facebookexternalhit|facebookcatalog|whatsapp/|telegrambot|twitterbot|linkedinbot|discordbot|slackbot|skypeuripreview|pinterestbot|embedly|quora link preview|curl/|wget/|python-requests|python-urllib|httpclient|okhttp|go-http-client|java/|libwww|scrapy|axios/|node-fetch|undici|apache-httpclient|bytespider|petalbot|semrush|ahrefs|mj12bot|dotbot|screaming frog)' then 'agente'
      when coalesce(v_dados->>'idiomas', '') = '' then 'sem_idioma'
      else null
    end;

    update public.checkout_sessoes set
      visitante_id = coalesce(visitante_id,
        case when coalesce(v_dados->>'visitante_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then (v_dados->>'visitante_id')::uuid end),
      agente = coalesce(agente, v_agente),
      dispositivo = coalesce(dispositivo, left(v_dados->>'dispositivo', 20)),
      navegador = coalesce(navegador, left(v_dados->>'navegador', 40)),
      so = coalesce(so, left(v_dados->>'so', 40)),
      largura = coalesce(largura, case when (v_dados->>'largura') ~ '^[0-9]{1,5}$' then (v_dados->>'largura')::integer end),
      altura = coalesce(altura, case when (v_dados->>'altura') ~ '^[0-9]{1,5}$' then (v_dados->>'altura')::integer end),
      referrer = coalesce(referrer, left(v_dados->>'referrer', 300)),
      utm = case when jsonb_typeof(v_dados->'utm') = 'object' and utm = '{}'::jsonb
                 then v_dados->'utm' else utm end,
      bot = bot or (v_bot_motivo is not null),
      bot_motivo = coalesce(bot_motivo, v_bot_motivo),
      visivel = true,
      encerrada_em = null,
      ultimo_evento_em = v_agora,
      eventos = eventos + 1
    where id = p_sessao;
    insert into public.checkout_eventos (sessao_id, tipo, dados)
      values (p_sessao, p_tipo, jsonb_strip_nulls(jsonb_build_object(
        'dispositivo', left(v_dados->>'dispositivo', 20),
        'navegador', left(v_dados->>'navegador', 40),
        'referrer', nullif(left(v_dados->>'referrer', 300), ''),
        'utm', case when jsonb_typeof(v_dados->'utm') = 'object' then v_dados->'utm' else '{}'::jsonb end,
        'bot_motivo', v_bot_motivo
      )));
    return;
  end if;

  -- ---- só a sessão muda: batimento, localização, aba ---------------------
  if p_tipo = 'pulso' then
    update public.checkout_sessoes set
      ultimo_evento_em = v_agora,
      visivel = case when v_dados->'visivel' = 'false'::jsonb then false when v_dados->'visivel' = 'true'::jsonb then true else visivel end
    where id = p_sessao;
    return;
  end if;

  if p_tipo = 'localizou' then
    update public.checkout_sessoes set
      cidade = coalesce(cidade, nullif(left(v_dados->>'cidade', 80), '')),
      estado = coalesce(estado, nullif(left(v_dados->>'estado', 40), '')),
      pais = coalesce(pais, nullif(left(v_dados->>'pais', 4), '')),
      latitude = coalesce(latitude, case when (v_dados->>'latitude') ~ '^-?[0-9]{1,3}(\.[0-9]+)?$'
                                         then round((v_dados->>'latitude')::numeric, 2)::double precision end),
      longitude = coalesce(longitude, case when (v_dados->>'longitude') ~ '^-?[0-9]{1,3}(\.[0-9]+)?$'
                                           then round((v_dados->>'longitude')::numeric, 2)::double precision end),
      ultimo_evento_em = v_agora
    where id = p_sessao;
    return;
  end if;

  if p_tipo = 'aba' then
    update public.checkout_sessoes set
      visivel = case when v_dados->'visivel' = 'false'::jsonb then false when v_dados->'visivel' = 'true'::jsonb then true else visivel end,
      ultimo_evento_em = v_agora,
      eventos = eventos + 1
    where id = p_sessao;
    insert into public.checkout_eventos (sessao_id, tipo, dados)
      values (p_sessao, p_tipo, jsonb_build_object('visivel', (v_dados->'visivel' is distinct from 'false'::jsonb)));
    return;
  end if;

  -- ---- passos de verdade --------------------------------------------------
  v_campo := left(coalesce(v_dados->>'campo', ''), 20);
  v_resultado := left(coalesce(v_dados->>'resultado', ''), 20);
  v_valor := left(coalesce(v_dados->>'valor', ''), 160);

  -- Pedido informado pelo navegador só vale se for deste checkout.
  if p_tipo in ('pagamento','upsell','obrigado')
     and coalesce(v_dados->>'pedido_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v_pedido
      from public.pedidos
     where id = (v_dados->>'pedido_id')::uuid
       and checkout_id = v_sessao.checkout_id;
  end if;

  update public.checkout_sessoes set
    ultimo_evento_em = v_agora,
    eventos = eventos + 1,
    encerrada_em = case when p_tipo = 'saiu' then v_agora else null end,
    visivel = case when p_tipo = 'saiu' then false else true end,
    interagiu_em = case
      when p_tipo in ('interagiu','digitando','preencheu','bump','cupom','metodo','clicou_pagar','pix','upsell')
        then coalesce(interagiu_em, v_agora)
      else interagiu_em end,
    secao = case when p_tipo = 'olhou' then left(v_dados->>'secao', 20) else secao end,
    foco = case
      when p_tipo = 'digitando' then nullif(v_campo, '')
      when p_tipo in ('preencheu','clicou_pagar','pagamento','saiu') then null
      else foco end,
    nome = case when p_tipo = 'preencheu' and v_campo = 'nome'
                then nullif(left(v_valor, 120), '') else nome end,
    email = case when p_tipo = 'preencheu' and v_campo = 'email'
                 then nullif(lower(v_valor), '') else email end,
    whatsapp = case when p_tipo = 'preencheu' and v_campo = 'whatsapp'
                    then nullif(left(v_valor, 30), '') else whatsapp end,
    documento_preenchido = documento_preenchido
      or (p_tipo = 'preencheu' and v_campo = 'documento'),
    metodo = case
      when p_tipo in ('metodo','clicou_pagar') and (v_dados->>'metodo') in ('cartao','pix')
        then v_dados->>'metodo'
      else metodo end,
    bump = case
      when p_tipo = 'bump' and v_dados ? 'marcado' then (v_dados->'marcado' = 'true'::jsonb)
      when p_tipo = 'clicou_pagar' and v_dados ? 'bump' then (v_dados->'bump' = 'true'::jsonb)
      else bump end,
    cupom = case
      when p_tipo = 'cupom' and (v_dados->'valido' = 'true'::jsonb)
        then left(upper(v_dados->>'codigo'), 40)
      when p_tipo = 'cupom' and coalesce(v_dados->>'acao', '') = 'removeu' then null
      else cupom end,
    total_centavos = case
      when p_tipo in ('clicou_pagar','pagamento') and (v_dados->>'total_centavos') ~ '^[0-9]{1,9}$'
        then (v_dados->>'total_centavos')::integer
      else total_centavos end,
    pedido_id = coalesce(v_pedido, pedido_id),
    etapa = case
      when p_tipo = 'saiu' then etapa
      when p_tipo in ('digitando','preencheu') and v_campo in ('nome','email','whatsapp','documento') then 'dados'
      when p_tipo = 'digitando' and v_campo = 'cartao' then 'pagamento'
      when p_tipo = 'metodo' then 'pagamento'
      when p_tipo = 'clicou_pagar' then 'pagando'
      when p_tipo = 'pagamento' and v_resultado = 'aprovado' then 'aprovado'
      when p_tipo = 'pagamento' and v_resultado = 'pendente' then 'analise'
      when p_tipo = 'pagamento' and v_resultado = 'pix_gerado' then 'pix'
      when p_tipo = 'pagamento' then 'recusado'
      when p_tipo = 'pix' then 'pix'
      when p_tipo = 'upsell' and coalesce(v_dados->>'acao', '') = 'aceitou' then 'upsell_aceito'
      when p_tipo = 'upsell' then 'upsell'
      when p_tipo = 'obrigado' then 'concluido'
      else etapa end,
    dados_em = case when p_tipo = 'preencheu' then coalesce(dados_em, v_agora) else dados_em end,
    pagar_em = case when p_tipo = 'clicou_pagar' then coalesce(pagar_em, v_agora) else pagar_em end,
    pagamento_em = case when p_tipo = 'pagamento' then coalesce(pagamento_em, v_agora) else pagamento_em end,
    aprovado_em = case when p_tipo = 'pagamento' and v_resultado = 'aprovado'
                       then coalesce(aprovado_em, v_agora) else aprovado_em end,
    obrigado_em = case when p_tipo = 'obrigado' then coalesce(obrigado_em, v_agora) else obrigado_em end
  where id = p_sessao;

  -- O evento na linha do tempo, com os dados já podados. Valor digitado só
  -- vai para a sessão (acima); na linha do tempo fica o campo, nunca o valor —
  -- é o suficiente para "preencheu o e-mail às 14:32".
  v_texto := left(coalesce(v_dados->>'mensagem', ''), 200);
  insert into public.checkout_eventos (sessao_id, tipo, dados)
    values (p_sessao, p_tipo, jsonb_strip_nulls(jsonb_build_object(
      'campo', nullif(v_campo, ''),
      'secao', case when p_tipo = 'olhou' then left(v_dados->>'secao', 20) end,
      'resultado', nullif(v_resultado, ''),
      'acao', left(v_dados->>'acao', 20),
      'etapa', case when p_tipo = 'upsell' then left(v_dados->>'etapa', 20) end,
      'metodo', case when (v_dados->>'metodo') in ('cartao','pix') then v_dados->>'metodo' end,
      'marcado', case when p_tipo = 'bump' then (v_dados->'marcado' = 'true'::jsonb) end,
      'codigo', case when p_tipo = 'cupom' then left(upper(v_dados->>'codigo'), 40) end,
      'valido', case when p_tipo = 'cupom' then (v_dados->'valido' = 'true'::jsonb) end,
      'total_centavos', case when (v_dados->>'total_centavos') ~ '^[0-9]{1,9}$'
                             then (v_dados->>'total_centavos')::integer end,
      'erro', left(v_dados->>'erro', 60),
      'mensagem', nullif(v_texto, ''),
      'pedido_id', v_pedido,
      'tipo_interacao', case when p_tipo = 'interagiu' then left(v_dados->>'tipo', 20) end
    )));
exception
  when others then
    -- Rastreio nunca derruba a página de pagamento. O erro fica no log do
    -- Postgres; o navegador recebe 204 como se nada tivesse acontecido.
    raise warning 'checkout_rastrear(%, %): %', p_sessao, p_tipo, sqlerrm;
    return;
end;
$$;

comment on function public.checkout_rastrear(uuid, text, text, jsonb) is
  'Registra um passo do visitante no checkout (sessão + linha do tempo). Chamada pelo navegador sem login; valida e poda tudo; nunca lança erro.';

revoke all on function public.checkout_rastrear(uuid, text, text, jsonb) from public;
grant execute on function public.checkout_rastrear(uuid, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS — a equipe lê; ninguém escreve por PostgREST
-- ---------------------------------------------------------------------------

alter table public.checkout_sessoes enable row level security;
alter table public.checkout_eventos enable row level security;

grant select on public.checkout_sessoes to authenticated;
grant select on public.checkout_eventos to authenticated;

drop policy if exists "ao_vivo_equipe_le_sessoes" on public.checkout_sessoes;
create policy "ao_vivo_equipe_le_sessoes" on public.checkout_sessoes
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "ao_vivo_equipe_le_eventos" on public.checkout_eventos;
create policy "ao_vivo_equipe_le_eventos" on public.checkout_eventos
  for select to authenticated
  using (public.is_team_member());

-- ---------------------------------------------------------------------------
-- 5. Realtime — o painel recebe cada mudança sem recarregar
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'checkout_sessoes'
    ) then
      alter publication supabase_realtime add table public.checkout_sessoes;
    end if;
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'checkout_eventos'
    ) then
      alter publication supabase_realtime add table public.checkout_eventos;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Limpeza — tráfego público não pode crescer sem teto
-- ---------------------------------------------------------------------------
-- Sessões com mais de 90 dias somem (os eventos vão junto pelo cascade). O
-- histórico de vendas mora em `pedidos`; aqui é só o rastro da visita.

create or replace function public._cron_checkout_rastreio_limpar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.checkout_sessoes
   where ultimo_evento_em < now() - interval '90 days';
$$;

revoke execute on function public._cron_checkout_rastreio_limpar()
  from public, anon, authenticated;

select cron.schedule(
  'vertix-checkout-rastreio-limpar',
  '30 6 * * *',                      -- diário 03:30 BRT (06:30 UTC)
  $$select public._cron_checkout_rastreio_limpar();$$
);
