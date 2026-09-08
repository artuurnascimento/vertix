-- ---------------------------------------------------------------------------
-- Padrão do resumo do pedido: aberto ou recolhido
-- ---------------------------------------------------------------------------
-- Até aqui o estado inicial do bloco "Seu pedido" era decidido pela LARGURA da
-- tela dentro do próprio componente: recolhido no celular, aberto a partir de
-- 1024px. Isso é uma regra de produto escondida em CSS-em-JavaScript, igual
-- para todas as ofertas, e sem ninguém para mudá-la sem um deploy.
--
-- Vira coluna porque a resposta certa depende da OFERTA, não do aparelho:
--
--   recolhido  o bloco aberto ocupa quase uma tela inteira de telefone
--              (descrição, linhas de desconto, benefícios, selo de segurança)
--              e empurra o formulário de pagamento para muito abaixo da
--              dobra. Quem já decidiu comprar não precisa reler a oferta —
--              precisa achar o botão. Serve para a maioria das ofertas, e por
--              isso é o default.
--
--   aberto     oferta cara ou com muita coisa inclusa, onde o que está no
--              pacote ainda está sendo vendido na hora do pagamento.
--
-- DEFAULT `false` = recolhido, para todas as ofertas que já existem. É uma
-- mudança de comportamento assumida no desktop, que hoje nasce aberto: o
-- padrão passa a ser o mesmo nos dois formatos, e quem quiser o antigo marca
-- a caixa na configuração da oferta.
--
-- Boolean e não jsonb, ao contrário de `prova` e `banner`: isto não é conteúdo
-- de página. É uma decisão de duas saídas, sem forma para evoluir.
--
-- Aditiva: `if not exists`, nenhuma coluna existente é tocada.
-- ---------------------------------------------------------------------------

alter table public.checkouts
  add column if not exists resumo_aberto boolean not null default false;

comment on column public.checkouts.resumo_aberto is
  'Estado inicial do bloco "Seu pedido" na página pública. false (padrão) = recolhido, mostrando só nome, total e descontos; true = aberto com os detalhes à vista. Depois de carregada a página, quem manda é o clique do comprador.';

-- ---------------------------------------------------------------------------
-- get_checkout_info — republicada com o novo campo
-- ---------------------------------------------------------------------------
-- `create or replace` da definição de 20260909100000 com UMA adição:
-- `resumo_aberto`. Tudo o mais é cópia literal — mesma projeção estreita,
-- mesmos joins, mesmos apelidos `*_produto`, mesma exceção para checkout
-- inativo, mesmo `desconto_pix_percentual` e mesmo `banner` nos dois lugares.
-- Perder uma linha aqui derruba a página pública inteira, então nada foi
-- "melhorado" de passagem.
--
-- Vai nos DOIS lugares (dentro de `checkout` e na raiz) pelo mesmo motivo já
-- registrado para `desconto_pix_percentual` e `banner`: o leitor da tela
-- aceita os dois, e assim ele sobrevive a qualquer um deles sair do contrato.
--
-- É dado público por definição: descreve como a própria página se desenha
-- para quem a está abrindo. O que continua fora é tudo o que já estava fora:
-- nenhum cupom, nenhum pedido, nenhum dado de cliente.
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
      -- Campo novo desta migration. false = o resumo nasce recolhido.
      'resumo_aberto', c.resumo_aberto
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
    'banner', c.banner,
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
  'Dados públicos da página de checkout: banner do topo, percentual de desconto no Pix (só para exibir — quem cobra é a checkout-pagar) e o padrão do resumo do pedido. Projeção estreita: nunca cupom, nunca pedido, nunca dado de outro cliente.';

-- `create or replace` PRESERVA os grants existentes, mas reconceder é barato e
-- deixa a permissão legível nesta migration em vez de exigir voltar em
-- 20260909100000 para saber quem chama. Perder este grant derruba a página
-- pública inteira.
grant execute on function public.get_checkout_info(text) to anon, authenticated;
