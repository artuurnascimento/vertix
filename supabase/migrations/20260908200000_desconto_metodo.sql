-- ---------------------------------------------------------------------------
-- Desconto por método de pagamento
-- ---------------------------------------------------------------------------
-- Até aqui o total do checkout (20260908100000) era produto + bump − cupom, e
-- o método de pagamento não entrava na conta: quem pagava por Pix e quem
-- parcelava no cartão pagavam o mesmo. Isso ignora o custo real de cada
-- método — a taxa do Pix é a menor da tabela do Mercado Pago, o dinheiro cai
-- na hora e não existe chargeback nem antecipação a pagar.
--
-- SÓ PIX POR ENQUANTO, e a decisão é econômica, não técnica. Descontar em
-- cartão significaria dar desconto justamente no método que custa mais caro
-- (taxa maior, MDR por parcela, risco de estorno), o que sai do bolso da
-- margem para nada. Boleto tem taxa parecida com a do Pix, mas compensa
-- menos: liquida em dias, tem índice alto de abandono e não vale antecipar a
-- conversão com desconto. Por isso a coluna nasce com o nome do método no
-- singular — `desconto_pix_percentual` — em vez de uma tabela genérica
-- método→percentual: a generalização especulativa custaria uma tabela, um
-- join na página pública e uma tela no painel para representar um único caso
-- real. Quando o segundo método justificar desconto, a coluna vira tabela com
-- a migration que tiver esse motivo.
--
-- Aditiva: `if not exists` em tudo, nenhuma coluna existente é alterada, nada
-- é removido. Pedido antigo continua com desconto de método zero, que é
-- exatamente o que aconteceu com ele.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. A oferta passa a saber quanto desconta no Pix
-- ---------------------------------------------------------------------------
-- Fica em `checkouts` (a OFERTA) e não em `produtos` (o CATÁLOGO) pelo mesmo
-- motivo do bump e do preço-âncora: o desconto de Pix é decisão de campanha.
-- O mesmo produto pode ser vendido com 10% no Pix numa página de tráfego pago
-- e sem desconto nenhum numa página de indicação, e amarrar isso ao produto
-- obrigaria a duplicar o produto (e a entrega) só para mudar a oferta.
--
-- NULL = sem desconto, igual a 0. Os dois casos existem porque `null` é o
-- estado de quem nunca configurou e `0` o de quem configurou e desligou; a
-- conta trata os dois do mesmo jeito (ver _shared/checkout.ts).
--
-- smallint basta: o valor cabe em dois dígitos e o check o prende entre 0 e
-- 90. O teto de 90 é o mesmo tipo de guarda do `cupons_valor_percentual_ate_100`
-- — um dedo trêmulo no painel ("100") não pode zerar a cobrança, porque total
-- zero não é "grátis", é uma chamada que o Mercado Pago recusa depois de o
-- cliente já ter preenchido o formulário.

alter table public.checkouts
  add column if not exists desconto_pix_percentual smallint
    check (desconto_pix_percentual between 0 and 90);

comment on column public.checkouts.desconto_pix_percentual is
  'Pontos percentuais de desconto quando o pagamento é por Pix. NULL ou 0 = sem desconto. Incide sobre o subtotal JÁ descontado do cupom — ver a ordem em _shared/checkout.ts. Teto de 90 para nenhuma configuração conseguir zerar a cobrança.';

-- ---------------------------------------------------------------------------
-- 2. O pedido registra quanto o método descontou
-- ---------------------------------------------------------------------------
-- COLUNA NOVA, e não "somar tudo em desconto_centavos e pronto". A razão é que
-- as duas informações respondem perguntas diferentes e o recibo precisa das
-- duas ao mesmo tempo:
--
--   desconto_centavos          continua sendo a SOMA de todos os descontos, e
--                              é o que mantém a identidade que todo leitor
--                              atual assume:
--                                  total_centavos = subtotal − desconto
--                              É a linha "Desconto" do recibo e o número que
--                              o Financeiro compara com o extrato. Mudar o
--                              sentido dessa coluna para "só cupom" quebraria
--                              a soma na tela de obrigado (get_pedido_info) e
--                              no painel, em silêncio, sem erro nenhum.
--
--   desconto_metodo_centavos   é a PARCELA desse desconto que veio do método.
--                              Sem ela, "R$ 55,86 de desconto" num pedido com
--                              cupom de 10% e Pix de 10% é indistinguível de
--                              um cupom de 19% — e a pergunta que o Financeiro
--                              vai fazer ("quanto o incentivo ao Pix custou
--                              este mês?") não teria resposta possível a
--                              partir da linha gravada. Inferir pelo
--                              percentual do checkout também não serve: o
--                              percentual pode ter mudado depois da venda, e o
--                              pedido é um snapshot do que foi cobrado.
--
-- `not null default 0` porque o valor é sempre conhecido: pedido sem desconto
-- de método teve desconto de método zero, não desconhecido. Assim nenhuma
-- soma precisa de coalesce e a coluna nunca vira armadilha de três estados.
--
-- Não guardamos o MÉTODO em si aqui: ele já é recuperável pelo pagamento no
-- Mercado Pago (`mp_payment_id`), e hoje `desconto_metodo_centavos > 0`
-- implica Pix por construção — só o Pix desconta. Quando existir um segundo
-- método com desconto, a coluna do método vem junto com ele.

alter table public.pedidos
  add column if not exists desconto_metodo_centavos integer not null default 0
    check (desconto_metodo_centavos >= 0);

comment on column public.pedidos.desconto_metodo_centavos is
  'Parcela de `desconto_centavos` que veio do desconto por método de pagamento (hoje, só Pix). Já está INCLUÍDA em desconto_centavos — a identidade total = subtotal − desconto continua valendo. Serve para o Financeiro separar quanto o incentivo ao método custou do que o cupom custou.';

-- ---------------------------------------------------------------------------
-- 3. get_checkout_info — republicada com o campo novo
-- ---------------------------------------------------------------------------
-- `create or replace` da definição de 20260908100000 com UMA adição: o
-- percentual de Pix. Nada mais muda — mesma projeção estreita, mesmos joins,
-- mesma exceção para checkout inativo, mesmos apelidos `*_produto`.
--
-- Publicar o percentual para quem não está logado é seguro e necessário: a
-- página precisa mostrar "10% off no Pix" antes de a pessoa escolher o método,
-- e o número é a mesma informação que o preço com desconto já revelaria na
-- primeira simulação. O que continua fora é tudo o que era: nenhum cupom,
-- nenhum pedido, nenhum dado de cliente.
--
-- O campo aparece em DOIS lugares na resposta, de propósito e pelo mesmo
-- motivo dos apelidos `bump_produto`/`upsell_produto` logo abaixo: dentro de
-- `checkout`, onde moram todas as outras colunas da oferta, e na raiz, que é
-- onde a tela de checkout lê os dados que valem para a página inteira. São o
-- MESMO valor, lido da mesma coluna na mesma consulta — não há como divergirem.
--
-- E o percentual aqui é para EXIBIR, nunca para calcular a cobrança. Quem
-- resolve o valor cobrado é a checkout-pagar, contra esta mesma coluna. O
-- navegador informa o método escolhido; quanto isso vale é sempre conta do
-- servidor.

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
      -- Campo novo desta migration. NULL = sem desconto de Pix.
      'desconto_pix_percentual', c.desconto_pix_percentual
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
    -- Mesmo valor de `checkout.desconto_pix_percentual`, na raiz (ver acima).
    'desconto_pix_percentual', c.desconto_pix_percentual
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
  'Dados públicos da página de checkout, incluindo o percentual de desconto no Pix (só para exibir — quem cobra é a checkout-pagar). Projeção estreita: nunca cupom, nunca pedido, nunca dado de outro cliente.';

-- `create or replace` PRESERVA os grants existentes, mas reconceder é barato e
-- deixa a permissão legível nesta migration em vez de exigir voltar em
-- 20260908100000 para saber quem chama.
grant execute on function public.get_checkout_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_pedido_info — republicada com a quebra do desconto
-- ---------------------------------------------------------------------------
-- Também `create or replace` da definição de 20260908100000, com UMA adição:
-- `desconto_metodo_centavos`. Sem ela a tela de obrigado só consegue escrever
-- "Desconto R$ 55,86" e some com a informação de que R$ 26,46 daquilo foi o
-- Pix — que é justamente o que a pessoa escolheu e o que o recibo precisa
-- creditar de volta a ela.
--
-- A projeção continua igual em tudo o mais: nada de documento, telefone nem
-- qualquer identificador de cartão. Um inteiro de desconto não acrescenta
-- superfície de vazamento a um id que já anda na URL.

create or replace function public.get_pedido_info(p_pedido_id uuid)
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
    'status', p.status,
    'email', p.cliente_email,
    'subtotal_centavos', p.subtotal_centavos,
    'desconto_centavos', p.desconto_centavos,
    -- Campo novo desta migration. Já está INCLUÍDO em desconto_centavos: é a
    -- quebra, não uma segunda parcela a subtrair. Somar os dois zeraria o
    -- recibo duas vezes.
    'desconto_metodo_centavos', p.desconto_metodo_centavos,
    'total_centavos', p.total_centavos,
    -- Reprojetado item a item de propósito: devolver `p.itens` cru publicaria
    -- qualquer campo que um dia seja acrescentado ao snapshot (hoje já haveria
    -- o mp_payment_id de cada item).
    'itens', coalesce(
      (
        select json_agg(json_build_object(
          'produto_id', item ->> 'produto_id',
          'nome', item ->> 'nome',
          'tipo', item ->> 'tipo',
          'preco_centavos', (item ->> 'preco_centavos')::integer,
          'pago', coalesce((item ->> 'pago')::boolean, false)
        ) order by ordem)
        from jsonb_array_elements(p.itens) with ordinality as t(item, ordem)
      ),
      '[]'::json
    ),
    -- Só é true se o bump foi de fato PAGO. Item reservado e não confirmado
    -- não conta: a tela não pode dizer que a pessoa levou o que não levou.
    'bump_aceito', exists (
      select 1
      from jsonb_array_elements(p.itens) as item
      where item ->> 'tipo' = 'bump'
        and coalesce((item ->> 'pago')::boolean, false)
    ),
    'plano_code', p.plano_code,
    'criado_em', p.created_at
  )
  into v_result
  from public.pedidos p
  where p.id = p_pedido_id;

  if v_result is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

comment on function public.get_pedido_info(uuid) is
  'Resumo público de um pedido para a tela de obrigado, com a quebra do desconto por método. Nunca devolve documento, telefone nem qualquer identificador de cartão.';

grant execute on function public.get_pedido_info(uuid) to anon, authenticated;
