-- ---------------------------------------------------------------------------
-- Order bump com imagem (desktop e celular) e cronômetro por visitante
-- ---------------------------------------------------------------------------
-- Duas colunas novas em `checkouts`, as duas de conteúdo de página, e a
-- `get_checkout_info` republicada com elas.
--
-- 1. `bump_imagem` jsonb — a arte do order bump, na MESMA forma do `banner`:
--    { desktop: {url,largura,altura}, mobile: {...}, alt }. Duas artes pelo
--    mesmo motivo do banner: no celular o card do bump tem uma coluna só e a
--    arte larga do desktop vira uma tarja. `{}` = bump sem imagem, e a página
--    desenha o card como sempre desenhou. Os arquivos vão para o bucket
--    `checkout-banners` que já existe (pasta `bump/`), com as mesmas regras.
--
-- 2. `cronometro_minutos` smallint — um segundo modo de cronômetro. O modo
--    que existia (`cronometro_ate`) é um instante absoluto: passou, sumiu. O
--    novo é POR VISITANTE: cada pessoa vê uma contagem de N minutos a partir
--    da primeira abertura da página, guardada no navegador dela (recarregar
--    não zera), e ao chegar a zero a contagem recomeça. É decisão de produto
--    do dono da oferta; o painel diz com todas as letras o que cada modo faz,
--    e o formulário só grava UM dos dois (o outro vai para null).
--
-- Aditiva: `if not exists`, nenhuma coluna existente é tocada.
-- ---------------------------------------------------------------------------

alter table public.checkouts
  add column if not exists bump_imagem jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkouts_bump_imagem_objeto'
  ) then
    alter table public.checkouts
      add constraint checkouts_bump_imagem_objeto
      check (jsonb_typeof(bump_imagem) = 'object');
  end if;
end $$;

comment on column public.checkouts.bump_imagem is
  'Imagem do order bump: { desktop: {url,largura,altura}, mobile: {...}, alt } — mesma forma do banner. {} = bump sem imagem.';

alter table public.checkouts
  add column if not exists cronometro_minutos smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkouts_cronometro_minutos_faixa'
  ) then
    alter table public.checkouts
      add constraint checkouts_cronometro_minutos_faixa
      check (cronometro_minutos is null or cronometro_minutos between 1 and 1440);
  end if;
end $$;

comment on column public.checkouts.cronometro_minutos is
  'Cronômetro por visitante: N minutos a partir da primeira abertura, guardado no navegador, recomeçando ao zerar. null = sem este modo (vale cronometro_ate, se houver).';

-- ---------------------------------------------------------------------------
-- get_checkout_info — republicada com os dois campos
-- ---------------------------------------------------------------------------
-- `create or replace` da definição de 20260909120000 com DUAS adições:
-- `bump_imagem` (dentro de `checkout` e na raiz, como o banner) e
-- `cronometro_minutos` (idem, ao lado de `cronometro_ate`). Tudo o mais é
-- cópia literal — perder uma linha aqui derruba a página pública inteira.
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
      -- `{}` = oferta sem banner, e a página simplesmente não desenha o topo
      -- ilustrado.
      'banner', c.banner,
      -- Imagem do order bump (desktop/mobile), mesma forma do banner.
      'bump_imagem', c.bump_imagem,
      -- false = o resumo nasce recolhido.
      'resumo_aberto', c.resumo_aberto,
      -- Cronômetro por visitante, em minutos; null = usa cronometro_ate.
      'cronometro_minutos', c.cronometro_minutos
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
    'cronometro_minutos', c.cronometro_minutos,
    -- Mesmo valor de `checkout.desconto_pix_percentual`, na raiz: é assim
    -- desde a 20260908200000 e a tela lê nos dois lugares.
    'desconto_pix_percentual', c.desconto_pix_percentual,
    -- Idem para o banner: mesma coluna, mesma consulta, os dois lugares.
    'banner', c.banner,
    'bump_imagem', c.bump_imagem,
    -- Idem para o padrão do resumo.
    'resumo_aberto', c.resumo_aberto
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
  'Dados públicos da página de checkout: banner do topo, imagem do order bump, percentual de desconto no Pix (só para exibir — quem cobra é a checkout-pagar), cronômetro (data fim ou minutos por visitante) e o padrão do resumo do pedido. Projeção estreita: nunca cupom, nunca pedido, nunca dado de outro cliente.';

grant execute on function public.get_checkout_info(text) to anon, authenticated;
