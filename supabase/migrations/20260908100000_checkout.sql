-- ============================================================================
-- Checkout próprio da Vertix — catálogo, oferta e pedido
-- ============================================================================
-- Até aqui a Vertix só sabia cobrar PROJETO: `receivables` é uma parcela de um
-- contrato, resolvida por um `payment_token` que já nasce com valor e dono
-- (20260802210000_pagina_pagamento.sql). Isso atende a agência e atendeu a
-- primeira venda do Scan, mas não é catálogo: não existe "produto" com preço,
-- não existe oferta com order bump, upsell, cupom e prova social, e não existe
-- pedido — a entidade que junta cliente, itens e o que de fato foi cobrado.
--
-- Quatro tabelas nascem aqui:
--
--   produtos   O catálogo. Preço em CENTAVOS inteiros, nunca `numeric` e nunca
--              float: dinheiro em ponto flutuante já produziu centavo a menos
--              em sistema de cobrança, e o resto do checkout (desconto de
--              cupom, soma do bump) é aritmética inteira do começo ao fim.
--              `preco_ancora_centavos` é o "de R$ X por R$ Y" — dado de oferta,
--              não de cobrança; ninguém paga por ele.
--
--   checkouts  A OFERTA montada sobre um produto: título, bump, upsell,
--              downsell, prova social, garantia e cronômetro. Separado de
--              `produtos` de propósito — o mesmo produto pode ser vendido em
--              várias páginas com preços-âncora, provas e bumps diferentes, e
--              misturar as duas coisas obrigaria a duplicar o produto (e a
--              entrega) só para trocar um depoimento.
--
--   cupons     Desconto. `usos` é contado aqui e incrementado SÓ quando o
--              pagamento é aprovado, por public.cupom_registrar_uso() — ver
--              seção 7 para o porquê de o incremento ser uma função e não um
--              UPDATE da edge function.
--
--   pedidos    O que foi realmente comprado. `itens` é um SNAPSHOT em jsonb:
--              nome, tipo e preço no instante da compra. Referência ao produto
--              não bastaria — no dia em que o preço do catálogo mudar, todo
--              pedido antigo passaria a "valer" outro valor, e o histórico
--              financeiro deixaria de bater com o que o cartão do cliente foi
--              cobrado.
--
-- Quem escreve é a SERVICE ROLE (edge functions checkout-pagar e
-- checkout-upsell). O painel só lê. Por isso `authenticated` recebe apenas
-- SELECT e `anon` não recebe nada — mesmo padrão de raiox_compras
-- (20260907160000). A página pública lê pela RPC get_checkout_info(), que é
-- SECURITY DEFINER e devolve uma projeção estreita: nunca o cupom inteiro,
-- nunca um pedido, nunca dado de outro cliente.
--
-- O valor NUNCA vem do navegador. Nem aqui nem na edge function: o corpo da
-- requisição diz QUAL checkout e SE marcou o bump; quanto isso custa é sempre
-- resolvido no servidor a partir destas tabelas. Mesma regra da
-- process-payment.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Produtos — o catálogo
-- ---------------------------------------------------------------------------

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  descricao text,
  -- Preço de cobrança, em centavos. Único valor que o servidor soma.
  preco_centavos integer not null check (preco_centavos >= 0),
  -- Preço "de" riscado na página. Só enfeite de oferta; não entra em conta.
  preco_ancora_centavos integer check (preco_ancora_centavos >= 0),
  tipo text not null default 'principal'
    check (tipo in ('principal','bump','upsell','downsell')),
  -- Como o produto é entregue depois do pagamento aprovado.
  --   'plano_scan' = libera o Plano de Correção do Vertix Scan
  --   'manual'     = alguém da equipe entrega
  entrega text not null default 'manual'
    check (entrega in ('plano_scan','manual')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.produtos is
  'Catálogo de produtos do checkout. Preços em centavos inteiros. Escrita só por service role.';
comment on column public.produtos.preco_ancora_centavos is
  'Preço riscado exibido na oferta ("de R$ X"). Nunca é cobrado nem entra em nenhuma soma.';
comment on column public.produtos.tipo is
  'Papel do produto na oferta. Não impede que o mesmo produto seja principal num checkout e bump em outro — o papel real é a coluna do checkout que aponta para ele.';

-- ---------------------------------------------------------------------------
-- 2. Checkouts — a oferta
-- ---------------------------------------------------------------------------
-- Os títulos e textos de bump/upsell/downsell ficam AQUI, e não em `produtos`,
-- porque são copy da página: o mesmo produto vendido como upsell de duas
-- ofertas diferentes precisa de dois textos diferentes, e o nome do produto na
-- nota fiscal não é o texto que converte.
--
-- `on delete restrict` no produto principal e `on delete set null` nos
-- opcionais: apagar o produto principal deixaria um checkout que não sabe o
-- que vende (e cujo preço viraria nulo em plena página pública); já perder o
-- bump só faz a oferta encolher, o que é degradação aceitável.

create table if not exists public.checkouts (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete restrict,
  slug text not null unique,
  titulo text not null,
  subtitulo text,

  bump_produto_id uuid references public.produtos (id) on delete set null,
  bump_titulo text,
  bump_texto text,

  upsell_produto_id uuid references public.produtos (id) on delete set null,
  upsell_titulo text,
  upsell_texto text,

  downsell_produto_id uuid references public.produtos (id) on delete set null,
  downsell_titulo text,
  downsell_texto text,

  -- Depoimentos e selos. jsonb (e não tabelas) porque isso é conteúdo de
  -- página: muda junto com o design, nunca é consultado por campo e nunca se
  -- relaciona com nada. Forma esperada:
  --   { "depoimentos": [{ "nome", "texto", "foto_url", "nota" }],
  --     "selos": ["Compra segura", "7 dias de garantia"] }
  prova jsonb not null default '{}'::jsonb,

  garantia_dias integer check (garantia_dias >= 0),
  garantia_texto text,
  -- Fim do cronômetro de escassez. NULL = sem cronômetro. Guardado como
  -- instante absoluto, não como duração: cronômetro que reinicia a cada
  -- recarga de página é mentira visível no F5 e queima a confiança da oferta.
  cronometro_ate timestamptz,

  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.checkouts is
  'Oferta pública montada sobre um produto: copy, bump, upsell, downsell, prova social, garantia e cronômetro. Lida sem autenticação pela RPC get_checkout_info().';
comment on column public.checkouts.prova is
  'Conteúdo de prova social da página: { depoimentos: [...], selos: [...] }. Puramente visual.';
comment on column public.checkouts.cronometro_ate is
  'Instante em que a oferta expira visualmente. NULL = sem cronômetro. Não bloqueia o pagamento — é copy, não regra de negócio.';

-- ---------------------------------------------------------------------------
-- 3. Cupons
-- ---------------------------------------------------------------------------
-- `codigo` é guardado SEMPRE em maiúsculas e o check garante isso no banco:
-- quem digita "bf50" na página e quem cadastra "BF50" no painel têm de casar,
-- e normalizar só na aplicação significa que a primeira inserção feita por
-- fora (SQL, importação, painel novo) cria um cupom que ninguém consegue usar.
--
-- `valor` muda de unidade conforme `tipo`, e é por isso que os dois check
-- constraints existem:
--   'percentual' → pontos percentuais, 1 a 100
--   'fixo'       → CENTAVOS de desconto
-- Sem o teto de 100 no percentual, um dedo trêmulo no painel ("500") viraria
-- desconto maior que o preço; o piso de 0 no total é garantido de novo na
-- edge function, porque cupom mal cadastrado não pode gerar cobrança negativa.

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo = upper(codigo) and length(codigo) > 0),
  tipo text not null check (tipo in ('percentual','fixo')),
  valor integer not null check (valor > 0),
  -- NULL = não expira.
  validade timestamptz,
  -- NULL = uso ilimitado.
  limite_uso integer check (limite_uso > 0),
  usos integer not null default 0 check (usos >= 0),
  -- NULL = vale para qualquer produto principal.
  produto_id uuid references public.produtos (id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint cupons_valor_percentual_ate_100
    check (tipo <> 'percentual' or valor <= 100)
);

comment on table public.cupons is
  'Cupons de desconto. `usos` só é incrementado quando o pagamento é APROVADO, via public.cupom_registrar_uso().';
comment on column public.cupons.valor is
  'Pontos percentuais (1-100) quando tipo = percentual; centavos de desconto quando tipo = fixo.';
comment on column public.cupons.produto_id is
  'Restringe o cupom a um produto principal. NULL = vale em qualquer checkout.';

-- ---------------------------------------------------------------------------
-- 4. Pedidos
-- ---------------------------------------------------------------------------
-- `itens` é um snapshot (ver cabeçalho). Forma de cada item:
--   { "produto_id": uuid, "nome": text, "tipo": text,
--     "preco_centavos": int, "pago": bool, "mp_payment_id": text|null }
-- O campo `pago` existe porque o upsell RESERVA o item antes de cobrar: sem a
-- reserva, dois cliques no botão do upsell viram duas cobranças no cartão.
-- Ver public.checkout_item_reservar() na seção 7.
--
-- `receivable_id` liga o pedido ao Financeiro quando a venda também precisa
-- virar recebível (mesma ponte que raiox_compras faz para o Scan). Fica NULL
-- nas vendas que não geram parcela.
--
-- `mp_customer_id` / `mp_card_id` guardam o cartão salvo no Mercado Pago, que
-- é o que torna o upsell possível sem repetir o formulário inteiro. NÃO são
-- dados de cartão: são IDs opacos do MP, sem número, sem validade e sem CVV —
-- nada disso passa por aqui nem é logado em lugar nenhum.

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.checkouts (id) on delete restrict,

  cliente_nome text not null,
  cliente_email text not null,
  cliente_whatsapp text,
  cliente_documento text,

  itens jsonb not null default '[]'::jsonb,
  subtotal_centavos integer not null default 0 check (subtotal_centavos >= 0),
  desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  total_centavos integer not null default 0 check (total_centavos >= 0),
  cupom_id uuid references public.cupons (id) on delete set null,

  status text not null default 'aguardando'
    check (status in ('aguardando','pago','recusado','reembolsado')),

  mp_payment_id text,
  mp_customer_id text,
  mp_card_id text,

  receivable_id uuid references public.receivables (id) on delete set null,
  -- Código do documento entregue quando o pedido inclui um produto com
  -- entrega = 'plano_scan'. Mesmo formato (12 chars base64url) do plano_code
  -- de raiox_compras e do report_code do Scan, para que a mesma rota
  -- GET /api/plano/:code do worker possa servir os dois.
  plano_code text unique,
  origem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pedidos is
  'Pedidos do checkout próprio. `itens` é snapshot do que foi comprado ao preço da hora. Escrita só por service role.';
comment on column public.pedidos.itens is
  'Snapshot dos itens: [{ produto_id, nome, tipo, preco_centavos, pago, mp_payment_id }]. Nunca reescrito a partir do catálogo.';
comment on column public.pedidos.mp_card_id is
  'ID opaco do cartão salvo no Mercado Pago. NÃO contém número, validade nem CVV — esses dados nunca chegam a este banco.';
comment on column public.pedidos.origem is
  'De onde veio o pedido (''scan'', ''bio'', campanha...). Texto livre, para separar faturamento por canal.';
comment on column public.pedidos.plano_code is
  'Código do Plano de Correção entregue por este pedido. Só preenchido quando um item pago tem entrega = plano_scan.';

-- ---------------------------------------------------------------------------
-- 5. Índices
-- ---------------------------------------------------------------------------
-- Os slugs já ganham índice único pelo `unique` da coluna; os de baixo cobrem
-- o que as functions e o painel realmente consultam.

-- Página pública: sempre "o checkout ativo deste slug".
create index if not exists checkouts_ativo_idx
  on public.checkouts (ativo);
create index if not exists checkouts_produto_id_idx
  on public.checkouts (produto_id);

-- Catálogo do painel filtra por tipo e por ativo.
create index if not exists produtos_tipo_idx
  on public.produtos (tipo);

-- cupom-validar busca pelo código já em maiúsculas (o unique da coluna cobre).
-- O painel lista os cupons vivos:
create index if not exists cupons_ativo_idx
  on public.cupons (ativo);

-- Painel de vendas filtra por status; a conferência de pagamento busca pelo
-- id do MP; o upsell e os relatórios buscam pelo checkout.
create index if not exists pedidos_status_idx
  on public.pedidos (status);
create index if not exists pedidos_checkout_id_idx
  on public.pedidos (checkout_id);
create index if not exists pedidos_mp_payment_id_idx
  on public.pedidos (mp_payment_id);
create index if not exists pedidos_created_at_idx
  on public.pedidos (created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Triggers de updated_at (reusam public.set_updated_at)
-- ---------------------------------------------------------------------------
-- `cupons` fica de fora de propósito: a tabela não tem updated_at, porque a
-- única coluna que muda em regime é `usos`, e um updated_at que pula a cada
-- venda não conta nada sobre a edição do cupom.

drop trigger if exists set_updated_at on public.produtos;
create trigger set_updated_at
  before update on public.produtos
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.checkouts;
create trigger set_updated_at
  before update on public.checkouts
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.pedidos;
create trigger set_updated_at
  before update on public.pedidos
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Funções de escrita usadas pelas edge functions
-- ---------------------------------------------------------------------------
-- As três existem porque PostgREST não sabe fazer nenhuma delas em UMA
-- instrução, e fazer em duas (ler, decidir, escrever) abre corrida em cima de
-- dinheiro:
--
--   cupom_registrar_uso     `usos = usos + 1` não é expressível num PATCH.
--                           Feito como ler-somar-escrever, dois pagamentos
--                           simultâneos leem `usos = 9`, escrevem `10` os
--                           dois, e o cupom de 10 usos rende 11.
--
--   checkout_item_reservar  A reserva do item do upsell PRECISA ser o mesmo
--                           comando que testa se ele já está lá. Em dois
--                           comandos, dois cliques no botão passam ambos pelo
--                           teste e o cartão é cobrado duas vezes.
--
--   checkout_item_baixar    Confirmar (marcar pago, somar ao total) e desistir
--                           (remover a reserva) mexem no MESMO array; separar
--                           em dois PATCHes de leitura-escrita traria de volta
--                           a corrida que a reserva acabou de fechar.
--
-- Todas são SECURITY DEFINER e ficam FORA da superfície pública de RPC: a
-- service role as chama ignorando RLS; anon e authenticated não as enxergam.

-- Incrementa o uso do cupom respeitando o limite, em um único comando.
-- Devolve true se o uso foi registrado; false se o cupom sumiu, foi desativado
-- ou estourou o limite entre a validação e a aprovação do pagamento.
create or replace function public.cupom_registrar_uso(p_cupom_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.cupons
     set usos = usos + 1
   where id = p_cupom_id
     and ativo
     and (validade is null or validade > now())
     and (limite_uso is null or usos < limite_uso)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

comment on function public.cupom_registrar_uso(uuid) is
  'Incrementa cupons.usos respeitando limite e validade, atomicamente. Chamada só pela service role, após pagamento APROVADO.';

-- Reserva um item no pedido antes de cobrar o cartão.
-- Devolve true se reservou; false se o pedido não existe, não está pago, ou já
-- tem esse produto (reservado ou pago) — que é exatamente a idempotência do
-- upsell. O item entra com "pago": false e NÃO soma ao total: reserva não é
-- cobrança, e um total inflado por uma cobrança que ainda pode ser recusada é
-- pior do que não ter reserva nenhuma.
create or replace function public.checkout_item_reservar(
  p_pedido_id uuid,
  p_item jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.pedidos
     set itens = itens || jsonb_build_array(p_item)
   where id = p_pedido_id
     and status = 'pago'
     and not exists (
       select 1
       from jsonb_array_elements(itens) as item
       where item ->> 'produto_id' = p_item ->> 'produto_id'
     )
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

comment on function public.checkout_item_reservar(uuid, jsonb) is
  'Reserva um item no pedido em um único comando (guarda de idempotência do upsell). Não soma ao total. Só service role.';

-- Fecha a reserva feita acima.
--   p_aprovado = true  → marca o item como pago, grava o id do pagamento no MP
--                        e soma o preço ao total do pedido.
--   p_aprovado = false → remove a reserva, deixando o pedido como estava.
-- O preço somado vem do ITEM JÁ GRAVADO, não de parâmetro: assim o valor
-- somado ao total é obrigatoriamente o mesmo que a reserva registrou, e nem um
-- bug na edge function nem uma chamada repetida conseguem inflar o total.
create or replace function public.checkout_item_baixar(
  p_pedido_id uuid,
  p_produto_id uuid,
  p_aprovado boolean,
  p_mp_payment_id text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_preco integer;
begin
  -- Preço da reserva ainda não paga. Se não achar, não há o que fazer:
  -- ou o item nunca existiu, ou já foi confirmado numa chamada anterior.
  select (item ->> 'preco_centavos')::integer
    into v_preco
    from public.pedidos p,
         lateral jsonb_array_elements(p.itens) as item
   where p.id = p_pedido_id
     and item ->> 'produto_id' = p_produto_id::text
     and coalesce((item ->> 'pago')::boolean, false) = false
   limit 1;

  if v_preco is null then
    return false;
  end if;

  if p_aprovado then
    update public.pedidos
       set itens = (
             select jsonb_agg(
               case
                 when item ->> 'produto_id' = p_produto_id::text
                   then item
                        || jsonb_build_object('pago', true)
                        || jsonb_build_object('mp_payment_id', p_mp_payment_id)
                 else item
               end
             )
             from jsonb_array_elements(itens) as item
           ),
           subtotal_centavos = subtotal_centavos + v_preco,
           total_centavos = total_centavos + v_preco
     where id = p_pedido_id;
  else
    update public.pedidos
       set itens = coalesce(
             (
               select jsonb_agg(item)
               from jsonb_array_elements(itens) as item
               where not (
                 item ->> 'produto_id' = p_produto_id::text
                 and coalesce((item ->> 'pago')::boolean, false) = false
               )
             ),
             '[]'::jsonb
           )
     where id = p_pedido_id;
  end if;

  return true;
end;
$$;

comment on function public.checkout_item_baixar(uuid, uuid, boolean, text) is
  'Confirma (soma ao total) ou desfaz a reserva de um item do upsell. O valor somado vem do próprio item gravado. Só service role.';

-- ---------------------------------------------------------------------------
-- 8. RPC pública da página de checkout
-- ---------------------------------------------------------------------------
-- Mesmo padrão de get_payment_info (20260802210000): SECURITY DEFINER, lida
-- por anon, e devolvendo uma PROJEÇÃO — não a linha inteira.
--
-- O que fica de fora é a parte importante:
--   • nenhum pedido, nenhum cliente, nenhum e-mail de terceiro;
--   • nenhum cupom (nem código, nem valor, nem limite) — quem confere cupom é
--     a cupom-validar, uma chamada por vez, e quem decide o desconto de
--     verdade é a checkout-pagar. Devolver a lista aqui entregaria o catálogo
--     de descontos a qualquer visitante;
--   • nenhuma coluna interna de produto além de nome, descrição e preços.
--
-- `upsell` e `downsell` VÊM na resposta, mas só nome/preço/copy. Não é
-- vazamento: são ofertas feitas ao próprio comprador logo depois do pagamento,
-- e a página precisa delas montadas antes para não piscar. Quem valida se
-- aquele produto pode ser cobrado naquele pedido é a checkout-upsell, contra
-- estas mesmas colunas — o navegador não escolhe o que comprar.
--
-- Checkout inativo é tratado como inexistente (mesma exceção): dizer "existe,
-- mas está desativado" descreve o painel para quem está do lado de fora.

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
      'downsell_produto_id', dp.id
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
    'cronometro_ate', c.cronometro_ate
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
  'Dados públicos da página de checkout. Projeção estreita: nunca cupom, nunca pedido, nunca dado de outro cliente.';

-- ---------------------------------------------------------------------------
-- 8b. RPC pública do pedido (tela de obrigado)
-- ---------------------------------------------------------------------------
-- A tela de obrigado precisa dizer o que a pessoa REALMENTE comprou, e não o
-- que o checkout oferecia: afirmar "você levou o bump" com base na configuração
-- da página é prometer ao cliente algo que ele pode não ter marcado.
--
-- O `p_pedido_id` é um uuid v4 — 122 bits de aleatoriedade, não adivinhável —
-- e é o mesmo tipo de credencial-por-URL que o payment_token da página de
-- pagamento já usa desde 20260802210000. Ainda assim, a projeção é estreita
-- POR CIMA disso, porque um id que anda em URL vaza por histórico, print e
-- Referer, e o que vaza junto tem de ser o mínimo:
--
--   SAI:   status, e-mail, valores, itens (nome/tipo/preço/pago), bump_aceito,
--          plano_code, data.
--   NÃO SAI: documento (CPF/CNPJ), telefone, nome do titular, e NADA do
--          cartão — nem mp_card_id, nem mp_customer_id, nem mp_payment_id.
--          O cartão só é referenciado pela checkout-info, que é POST e não
--          deixa rastro em histórico de navegador.
--
-- O e-mail sai inteiro porque é o que a própria pessoa acabou de digitar na
-- página anterior, e a tela precisa dele para dizer "enviamos para X" — mesmo
-- critério já aceito em get_payment_info, que devolve o e-mail do cliente.

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
  'Resumo público de um pedido para a tela de obrigado. Nunca devolve documento, telefone nem qualquer identificador de cartão.';

-- ---------------------------------------------------------------------------
-- 9. Segurança
-- ---------------------------------------------------------------------------
-- Os default privileges do projeto dão tudo a anon/authenticated em tabela
-- nova, incluindo truncate — que NÃO passa por RLS e apagaria a tabela inteira
-- por baixo de qualquer policy. Aqui devolvemos, explicitamente, só o que cada
-- papel precisa.
--
-- AS TABELAS SE DIVIDEM EM DUAS METADES, e a divisão é a decisão importante
-- desta seção:
--
--   produtos, checkouts, cupons — CONFIGURAÇÃO.
--     São o catálogo e a oferta, operados por gente logada no admin: criar
--     produto, montar checkout, cadastrar cupom de campanha. A equipe escreve
--     (insert/update/delete) sob RLS de is_team_member(), exatamente como já
--     escreve clientes, projetos e propostas. Sem isso o painel de
--     configuração não existe — foi para editar essas três que ele foi pedido.
--
--   pedidos — REGISTRO FINANCEIRO.
--     Continua SOMENTE LEITURA para a interface, e a diferença é deliberada.
--     Um pedido é o que foi cobrado do cartão de alguém: o valor, os itens e o
--     status precisam corresponder ao extrato do Mercado Pago, e qualquer
--     edição pela tela quebraria essa correspondência sem deixar rastro. Toda
--     escrita passa pelas edge functions (service role), que só mudam o pedido
--     como consequência de uma resposta do gateway. Estorno e correção se
--     fazem no Mercado Pago, e chegam aqui pelo mesmo caminho.
--
-- `anon` não recebe nada em nenhuma das quatro. A página pública lê pelas RPCs
-- SECURITY DEFINER (get_checkout_info / get_pedido_info), que devolvem
-- projeções estreitas, e escreve pelas edge functions.
--
-- Sobre grants x policies: os dois são necessários e independentes. A policy
-- sem o grant dá 42501 (permission denied) mesmo estando correta, e o grant
-- sem a policy não devolve linha nenhuma. Por isso cada verbo liberado abaixo
-- aparece nos DOIS lugares. Nenhum grant é por coluna — são todos de tabela
-- inteira, então não sobra privilégio de coluna pendurado de um `revoke` que
-- só listou privilégios.

alter table public.produtos  enable row level security;
alter table public.checkouts enable row level security;
alter table public.cupons    enable row level security;
alter table public.pedidos   enable row level security;

revoke all on public.produtos  from anon;
revoke all on public.checkouts from anon;
revoke all on public.cupons    from anon;
revoke all on public.pedidos   from anon;

-- Zera para authenticated e reconcede na medida, em vez de subtrair do default:
-- assim o privilégio de cada tabela é lido nesta migration, e não depende de
-- lembrar o que os default privileges do projeto davam.
revoke all on public.produtos  from authenticated;
revoke all on public.checkouts from authenticated;
revoke all on public.cupons    from authenticated;
revoke all on public.pedidos   from authenticated;

-- Configuração: a equipe opera pelo painel. truncate, trigger e references
-- ficam de fora — truncate por não passar por RLS, os outros por serem
-- privilégios de DDL que nenhuma tela usa.
grant select, insert, update, delete on public.produtos  to authenticated;
grant select, insert, update, delete on public.checkouts to authenticated;
grant select, insert, update, delete on public.cupons    to authenticated;

-- Registro financeiro: leitura e nada mais (ver acima).
grant select on public.pedidos to authenticated;

-- Sequences: nenhuma destas tabelas usa serial/identity (todas as chaves são
-- uuid com gen_random_uuid()), então não há grant de sequence a fazer.

-- ---- produtos ----
drop policy if exists "checkout_equipe_le_produtos" on public.produtos;
create policy "checkout_equipe_le_produtos" on public.produtos
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "checkout_equipe_cria_produtos" on public.produtos;
create policy "checkout_equipe_cria_produtos" on public.produtos
  for insert to authenticated
  with check (public.is_team_member());

-- `using` E `with check` no update: sem o `with check`, um membro poderia
-- alterar uma linha para um estado que ele mesmo não teria direito de criar.
drop policy if exists "checkout_equipe_edita_produtos" on public.produtos;
create policy "checkout_equipe_edita_produtos" on public.produtos
  for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Apagar produto que já está em um checkout falha na FK (on delete restrict),
-- e é para falhar: o painel mostra o erro e a pessoa desativa em vez de apagar.
-- Produto com cupom vinculado leva o cupom junto (on delete cascade).
drop policy if exists "checkout_equipe_apaga_produtos" on public.produtos;
create policy "checkout_equipe_apaga_produtos" on public.produtos
  for delete to authenticated
  using (public.is_team_member());

-- ---- checkouts ----
drop policy if exists "checkout_equipe_le_checkouts" on public.checkouts;
create policy "checkout_equipe_le_checkouts" on public.checkouts
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "checkout_equipe_cria_checkouts" on public.checkouts;
create policy "checkout_equipe_cria_checkouts" on public.checkouts
  for insert to authenticated
  with check (public.is_team_member());

drop policy if exists "checkout_equipe_edita_checkouts" on public.checkouts;
create policy "checkout_equipe_edita_checkouts" on public.checkouts
  for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Apagar checkout que já tem pedido falha na FK (on delete restrict). Também
-- é para falhar: sumir com a oferta apagaria a origem de vendas já feitas.
drop policy if exists "checkout_equipe_apaga_checkouts" on public.checkouts;
create policy "checkout_equipe_apaga_checkouts" on public.checkouts
  for delete to authenticated
  using (public.is_team_member());

-- ---- cupons ----
drop policy if exists "checkout_equipe_le_cupons" on public.cupons;
create policy "checkout_equipe_le_cupons" on public.cupons
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "checkout_equipe_cria_cupons" on public.cupons;
create policy "checkout_equipe_cria_cupons" on public.cupons
  for insert to authenticated
  with check (public.is_team_member());

drop policy if exists "checkout_equipe_edita_cupons" on public.cupons;
create policy "checkout_equipe_edita_cupons" on public.cupons
  for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

drop policy if exists "checkout_equipe_apaga_cupons" on public.cupons;
create policy "checkout_equipe_apaga_cupons" on public.cupons
  for delete to authenticated
  using (public.is_team_member());

-- ---- pedidos: só leitura, de propósito (ver cabeçalho da seção) ----
drop policy if exists "checkout_equipe_le_pedidos" on public.pedidos;
create policy "checkout_equipe_le_pedidos" on public.pedidos
  for select to authenticated
  using (public.is_team_member());

-- Funções de escrita: fora da superfície pública de RPC. Uma função nova nasce
-- com EXECUTE para PUBLIC; sem estes revokes, `cupom_registrar_uso` seria
-- chamável por qualquer visitante em /rest/v1/rpc/ e zeraria um cupom.
revoke execute on function public.cupom_registrar_uso(uuid)
  from public, anon, authenticated;
revoke execute on function public.checkout_item_reservar(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.checkout_item_baixar(uuid, uuid, boolean, text)
  from public, anon, authenticated;

-- As RPCs de leitura, ao contrário, SÃO as portas das páginas públicas.
grant execute on function public.get_checkout_info(text) to anon, authenticated;
grant execute on function public.get_pedido_info(uuid) to anon, authenticated;
