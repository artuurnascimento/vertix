-- ---------------------------------------------------------------------------
-- Banner do checkout (desktop + celular)
-- ---------------------------------------------------------------------------
-- Até aqui o topo da página pública era só tipografia: logo, título e
-- subtítulo (ver CabecalhoCheckout.tsx). Quem anuncia a oferta em tráfego pago
-- chega no checkout vindo de um criativo, e a página não tinha onde repetir
-- esse criativo — a pessoa clica numa arte e cai num texto, o que quebra a
-- continuidade visual justamente onde ela decide pagar.
--
-- DUAS IMAGENS, e não uma. Um banner desenhado para 1200px de largura, quando
-- reduzido para 390px de celular, vira uma tarja de texto ilegível — e é no
-- celular que a maioria paga. Então cada formato tem a sua arte, e a página
-- escolhe com `<picture><source media>`, no HTML, antes de qualquer script
-- rodar (trocar por JavaScript faria o banner errado aparecer primeiro e
-- pular).
--
-- UMA COLUNA jsonb, e não sete colunas soltas. É a mesma decisão (e o mesmo
-- motivo) já registrada em `checkouts.prova` na 20260908100000: isto é
-- CONTEÚDO DE PÁGINA. Muda junto com o design, nunca é consultado por campo,
-- nunca se relaciona com nada e nunca entra numa conta de dinheiro. Espalhar
-- banner_desktop_url / _largura / _altura / banner_mobile_* / banner_alt em
-- colunas custaria sete migrations de nada no dia em que o desenho do topo
-- mudar.
--
-- Forma esperada:
--   {
--     "desktop": { "url": "https://.../checkout-banners/x.webp",
--                  "largura": 1600, "altura": 400 },
--     "mobile":  { "url": "...", "largura": 780, "altura": 600 },
--     "alt": "Plano de correção da loja: 7 dias"
--   }
--
-- LARGURA E ALTURA vão junto de propósito. Sem elas o navegador não sabe
-- quanto espaço reservar e a página inteira SALTA quando a imagem chega —
-- num checkout isso significa o botão de pagar se mexendo debaixo do dedo.
-- São medidas no navegador de quem faz o upload, gravadas com a URL, e viram
-- os atributos `width`/`height` do `<img>`/`<source>`.
--
-- `alt` vazio é resposta legítima: banner puramente decorativo, que só repete
-- o criativo do anúncio, deve sair do fluxo do leitor de tela em vez de fazê-lo
-- ler um texto redundante.
--
-- Aditiva: `if not exists` em tudo, nenhuma coluna existente é tocada. Oferta
-- antiga fica com `{}` — que é exatamente "esta oferta não tem banner".
-- ---------------------------------------------------------------------------

alter table public.checkouts
  add column if not exists banner jsonb not null default '{}'::jsonb;

-- Guarda mínima de forma. Não valida as chaves (é conteúdo de página, e o
-- leitor em src/components/checkout/checkoutTypes.ts é tolerante por
-- contrato), mas impede que alguém grave um array ou um número aqui e o
-- parser tenha que adivinhar o que fazer com isso.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkouts_banner_objeto'
  ) then
    alter table public.checkouts
      add constraint checkouts_banner_objeto
      check (jsonb_typeof(banner) = 'object');
  end if;
end $$;

comment on column public.checkouts.banner is
  'Banner do topo da página pública: { desktop: {url,largura,altura}, mobile: {...}, alt }. Puramente visual, como `prova`. largura/altura existem para o navegador reservar o espaço e a página não saltar quando a imagem carrega. `alt` vazio = imagem decorativa.';

-- ---------------------------------------------------------------------------
-- 2. Bucket PÚBLICO das artes
-- ---------------------------------------------------------------------------
-- Público, ao contrário do `project-files` da 20260713050007, porque quem lê
-- estas imagens é um comprador ANÔNIMO no meio de um checkout. URL assinada
-- exigiria uma chamada por imagem antes de pintar o topo da página — atraso
-- exatamente onde o LCP acontece — e a arte de um anúncio não é segredo: ela
-- já está circulando no Facebook.
--
-- LIMITES NO PRÓPRIO BUCKET, além da validação da tela. A tela é a primeira
-- barreira e a que dá a mensagem legível; esta é a que vale, porque a chave
-- anon do painel está no navegador e qualquer pessoa com sessão da equipe
-- poderia chamar o storage direto.
--
--   1 MB          um banner de topo bem exportado (WebP/AVIF) fica bem abaixo
--                 disso. Acima daqui já não é banner, é PNG sem tratamento —
--                 e ele atrasaria a página onde a venda acontece.
--   sem SVG       mesma razão anotada em FilesCard.tsx: SVG carrega script e,
--                 servido do mesmo domínio do storage, vira XSS armazenado.
--                 Aqui é pior que lá, porque este bucket é público.
--
-- O bloco dinâmico existe porque as colunas `public`, `file_size_limit` e
-- `allowed_mime_types` de storage.buckets só aparecem em versões recentes do
-- Storage. Num ambiente com a imagem antiga (é o caso de alguns Supabase
-- locais deste time) um insert direto nessas colunas quebraria a migration
-- inteira; assim o bucket nasce do mesmo jeito e os limites são aplicados
-- onde existirem.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets ausente: bucket checkout-banners não criado.';
    return;
  end if;

  insert into storage.buckets (id, name)
  values ('checkout-banners', 'checkout-banners')
  on conflict (id) do nothing;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name = 'public'
  ) then
    execute $sql$
      update storage.buckets set public = true where id = 'checkout-banners'
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    execute $sql$
      update storage.buckets set file_size_limit = 1048576
      where id = 'checkout-banners'
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    execute $sql$
      update storage.buckets
      set allowed_mime_types = array[
        'image/jpeg', 'image/png', 'image/webp', 'image/avif'
      ]
      where id = 'checkout-banners'
    $sql$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Policies de storage.objects
-- ---------------------------------------------------------------------------
-- LER: qualquer um, inclusive sem login — é o comprador da página pública.
-- Num bucket marcado `public` o Storage já serve o caminho /object/public/
-- sem consultar RLS; a policy abaixo é o que garante o mesmo resultado se o
-- bucket for despublicado por engano, e deixa a intenção escrita aqui em vez
-- de depender de um booleano numa tabela de sistema.
--
-- ESCREVER: só `authenticated` E membro da equipe. Sem o `is_team_member()`,
-- qualquer conta autenticada do projeto (portal do cliente inclusive)
-- poderia despejar arquivo num bucket público servido do nosso domínio.
-- ---------------------------------------------------------------------------

drop policy if exists "checkout_banners_leitura_publica" on storage.objects;
create policy "checkout_banners_leitura_publica"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'checkout-banners');

drop policy if exists "checkout_banners_equipe_envia" on storage.objects;
create policy "checkout_banners_equipe_envia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'checkout-banners'
    and public.is_team_member()
  );

drop policy if exists "checkout_banners_equipe_atualiza" on storage.objects;
create policy "checkout_banners_equipe_atualiza"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'checkout-banners'
    and public.is_team_member()
  )
  with check (
    bucket_id = 'checkout-banners'
    and public.is_team_member()
  );

drop policy if exists "checkout_banners_equipe_apaga" on storage.objects;
create policy "checkout_banners_equipe_apaga"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checkout-banners'
    and public.is_team_member()
  );

-- ---------------------------------------------------------------------------
-- 4. get_checkout_info — republicada com o banner
-- ---------------------------------------------------------------------------
-- `create or replace` da definição de 20260908200000 com UMA adição: o campo
-- `banner`. Tudo o mais é cópia literal — mesma projeção estreita, mesmos
-- joins, mesmos apelidos `*_produto`, mesma exceção para checkout inativo,
-- mesmo `desconto_pix_percentual` nos dois lugares. Perder uma linha aqui
-- derruba a página pública inteira, então nada foi "melhorado" de passagem.
--
-- O banner é conteúdo público por definição: é a arte que a pessoa já viu no
-- anúncio que a trouxe até aqui. O que continua fora é tudo o que já estava
-- fora: nenhum cupom, nenhum pedido, nenhum dado de cliente.
-- ---------------------------------------------------------------------------

create or replace function public.get_checkout_info(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'checkout', json_build_object(
      'slug', c.slug,
      'titulo', c.titulo,
      'subtitulo', c.subtitulo,
      'bump_titulo', c.bump_titulo,
      'bump_texto', c.bump_texto,
      'upsell_titulo', c.upsell_titulo,
      'upsell_texto', c.upsell_texto,
      'downsell_titulo', c.downsell_titulo,
      'downsell_texto', c.downsell_texto,
      -- Os ids vão junto porque é ELES que a checkout-upsell aceita em
      -- `produto_id`. A tela não escolhe pelo preço: manda o id, e o servidor
      -- confere contra estas mesmas colunas.
      'bump_produto_id', bp.id,
      'upsell_produto_id', up.id,
      'downsell_produto_id', dp.id,
      'desconto_pix_percentual', c.desconto_pix_percentual,
      -- Campo novo desta migration. `{}` = oferta sem banner, e a página
      -- simplesmente não desenha o topo ilustrado.
      'banner', c.banner
    ),
    'produto', json_build_object(
      'id', pr.id,
      'nome', pr.nome,
      'slug', pr.slug,
      'descricao', pr.descricao,
      'preco_centavos', pr.preco_centavos,
      'preco_ancora_centavos', pr.preco_ancora_centavos
    ),
    'bump', case when bp.id is null then null else json_build_object(
      'id', bp.id,
      'nome', bp.nome,
      'descricao', bp.descricao,
      'preco_centavos', bp.preco_centavos,
      'preco_ancora_centavos', bp.preco_ancora_centavos
    ) end,
    'upsell', case when up.id is null then null else json_build_object(
      'id', up.id,
      'nome', up.nome,
      'descricao', up.descricao,
      'preco_centavos', up.preco_centavos,
      'preco_ancora_centavos', up.preco_ancora_centavos
    ) end,
    'downsell', case when dp.id is null then null else json_build_object(
      'id', dp.id,
      'nome', dp.nome,
      'descricao', dp.descricao,
      'preco_centavos', dp.preco_centavos,
      'preco_ancora_centavos', dp.preco_ancora_centavos
    ) end,
    -- Apelidos `*_produto` dos três objetos acima. A duplicação é deliberada e
    -- barata: as telas pós-compra já foram escritas contra `upsell_produto` /
    -- `downsell_produto`, e renomear a chave depois de a página existir custa
    -- mais do que carregar dois nomes para o mesmo objeto. São referências ao
    -- MESMO json — não há risco de divergirem.
    'bump_produto', case when bp.id is null then null else json_build_object(
      'id', bp.id,
      'nome', bp.nome,
      'descricao', bp.descricao,
      'preco_centavos', bp.preco_centavos,
      'preco_ancora_centavos', bp.preco_ancora_centavos
    ) end,
    'upsell_produto', case when up.id is null then null else json_build_object(
      'id', up.id,
      'nome', up.nome,
      'descricao', up.descricao,
      'preco_centavos', up.preco_centavos,
      'preco_ancora_centavos', up.preco_ancora_centavos
    ) end,
    'downsell_produto', case when dp.id is null then null else json_build_object(
      'id', dp.id,
      'nome', dp.nome,
      'descricao', dp.descricao,
      'preco_centavos', dp.preco_centavos,
      'preco_ancora_centavos', dp.preco_ancora_centavos
    ) end,
    'prova', c.prova,
    'garantia', json_build_object(
      'dias', c.garantia_dias,
      'texto', c.garantia_texto
    ),
    'cronometro_ate', c.cronometro_ate,
    -- Mesmo valor de `checkout.desconto_pix_percentual`, na raiz: é assim
    -- desde a 20260908200000 e a tela lê nos dois lugares.
    'desconto_pix_percentual', c.desconto_pix_percentual,
    -- Idem para o banner: mesma coluna, mesma consulta, os dois lugares.
    'banner', c.banner
  )
  into v_result
  from public.checkouts c
  join public.produtos pr on pr.id = c.produto_id
  -- Produto opcional só aparece se estiver ATIVO: desativar o bump no catálogo
  -- tem de sumir com ele da página, senão a oferta continua vendendo o que a
  -- equipe já tirou do ar.
  left join public.produtos bp
    on bp.id = c.bump_produto_id and bp.ativo
  left join public.produtos up
    on up.id = c.upsell_produto_id and up.ativo
  left join public.produtos dp
    on dp.id = c.downsell_produto_id and dp.ativo
  where c.slug = p_slug
    and c.ativo
    and pr.ativo;

  if v_result is null then
    raise exception 'Checkout não encontrado.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

comment on function public.get_checkout_info(text) is
  'Dados públicos da página de checkout, incluindo o banner do topo e o percentual de desconto no Pix (só para exibir — quem cobra é a checkout-pagar). Projeção estreita: nunca cupom, nunca pedido, nunca dado de outro cliente.';

-- `create or replace` PRESERVA os grants existentes, mas reconceder é barato e
-- deixa a permissão legível nesta migration em vez de exigir voltar em
-- 20260908200000 para saber quem chama.
grant execute on function public.get_checkout_info(text) to anon, authenticated;
