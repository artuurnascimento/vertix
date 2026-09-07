-- ============================================================================
-- Checkout próprio — entrega do pedido pago
-- ============================================================================
-- A migration 20260908100000_checkout.sql deu à Vertix catálogo, oferta e
-- pedido: o checkout já cobra certo. O que ela não modelou é o DEPOIS. Hoje o
-- cliente paga, a linha em `pedidos` vira 'pago' e nada mais acontece: ninguém
-- gera o Plano de Correção, ninguém manda o recibo, e nenhuma varredura
-- consegue sequer LISTAR quem ficou pago sem receber — porque não existe
-- coluna que diga se já foi entregue.
--
-- Três colunas aditivas resolvem isso, e nenhuma delas é opcional para o
-- funcionamento da entrega:
--
--   analysis_id
--     A análise do Vertix Scan que originou a venda. O Plano de Correção só
--     faz sentido vendido a partir de um relatório: o funil manda a pessoa
--     para /c/<slug>?a=<analysis_id>, a `checkout-pagar` guarda o valor aqui e
--     o WORKER DO SCAN LÊ ESTA COLUNA para saber sobre qual loja escrever o
--     plano. Sem ela o worker recebe um pedido pago e não tem o que analisar.
--
--     uuid SEM foreign key, pelo mesmo motivo de raiox_compras.analysis_id
--     (20260907160000): a equipe apaga análises e leads de teste com
--     raiox_excluir_lead()/raiox_zerar_tudo(), e uma faxina no Scan NUNCA pode
--     arrastar junto — nem bloquear — o registro de uma venda já paga.
--
--     Fica NULL nos pedidos que não vêm do Scan (um produto qualquer vendido
--     numa página de checkout própria), e isso é estado normal, não defeito.
--
--   entregue_em
--     Quando a entrega foi de fato concluída pelo worker. É o que torna
--     possível a varredura "pagou e não recebeu" — a rede de segurança que
--     transforma uma falha de aviso em atraso, e não em cliente lesado.
--
--   recibo_enviado_em
--     Quando o recibo saiu por e-mail. Separado de `entregue_em` de propósito:
--     são dois e-mails diferentes, que falham de formas diferentes, e juntar
--     os dois num campo só faria uma reentrega reenviar o recibo (ou o
--     contrário) sem que ninguém conseguisse distinguir os casos depois.
--
-- Quem escreve continua sendo a service role: as edge functions do checkout
-- gravam `analysis_id`, e o worker do Scan marca `entregue_em` e
-- `recibo_enviado_em`. O painel só lê (as policies de `pedidos` da migration
-- 20260908100000 continuam valendo, e nada aqui as toca).
--
-- Migration puramente aditiva: só `add column if not exists` e
-- `create index if not exists`. Nada é apagado, alterado ou renomeado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colunas
-- ---------------------------------------------------------------------------

alter table public.pedidos
  add column if not exists analysis_id uuid,
  add column if not exists entregue_em timestamptz,
  add column if not exists recibo_enviado_em timestamptz;

comment on column public.pedidos.analysis_id is
  'Análise do Vertix Scan que originou a venda (public.analyses). Sem FK de propósito: faxina de leads/análises não pode arrastar uma venda paga. NULL em pedido que não veio do Scan.';
comment on column public.pedidos.entregue_em is
  'Quando o worker do Scan concluiu a entrega deste pedido. NULL = pago e ainda não entregue — é o que a varredura de recuperação procura.';
comment on column public.pedidos.recibo_enviado_em is
  'Quando o recibo foi enviado por e-mail. Separado de entregue_em porque são dois e-mails distintos, que falham de formas distintas.';

-- ---------------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------------
-- Mesmo espírito dos índices já existentes em `pedidos` (status, checkout_id,
-- mp_payment_id, created_at): cobrir o que alguém realmente consulta.

-- "Qual pedido veio desta análise?" — o worker resolve o caminho de volta por
-- aqui, e o painel liga a venda ao relatório do Scan.
--
-- Parcial: a maioria dos pedidos não vem do Scan e teria `analysis_id` NULL.
-- O predicado é `is not null`, e não um valor fixo — ele não deixa de cobrir a
-- consulta quando o negócio ganhar mais um caso, que é a armadilha que o
-- índice da sequência de e-mails (20260907160000) evitou.
create index if not exists pedidos_analysis_id_idx
  on public.pedidos (analysis_id)
  where analysis_id is not null;

-- A varredura de recuperação do worker: "pedido pago que ainda não foi
-- entregue, do mais antigo para o mais novo". `status` vem primeiro porque é
-- ele que manda na consulta (só 'pago' interessa) e `created_at` ordena dentro
-- da faixa. O predicado parcial mantém o índice do tamanho da FILA, não da
-- tabela: cada entrega concluída tira a linha do índice.
create index if not exists pedidos_entrega_pendente_idx
  on public.pedidos (status, created_at)
  where entregue_em is null;

-- ---------------------------------------------------------------------------
-- 3. Vínculo item ↔ recebível (o upsell é uma SEGUNDA cobrança)
-- ---------------------------------------------------------------------------
-- Um upsell aprovado é um pagamento novo no Mercado Pago: id próprio, data
-- própria, linha própria no extrato. No Financeiro ele vira um recebível novo,
-- e não um aumento do valor do recebível original — uma linha de R$ 1.394 que
-- não corresponde a nenhuma transação real é mais difícil de conciliar, não
-- menos. Duas cobranças, duas linhas, extrato batendo uma a uma.
--
-- Para não criar duas vezes o mesmo recebível, o vínculo mora no PRÓPRIO item
-- do `itens` jsonb, ao lado do `mp_payment_id` que já está lá. Sem coluna nova:
-- a informação é do item, não do pedido, e um pedido pode ter vários itens
-- pagos em cobranças distintas.
--
-- Por que uma função e não um PATCH da edge function: gravar isso pelo
-- PostgREST exigiria ler `itens`, alterar em memória e reescrever o array
-- inteiro — e um upsell e um downsell acontecendo juntos fariam o segundo
-- apagar o item do primeiro. Aqui é um comando só, exatamente como
-- checkout_item_reservar() e checkout_item_baixar() já fazem.
--
-- O `exists` com `receivable_id is null` é a guarda de idempotência: quem
-- chegar segundo não encontra item sem vínculo, não escreve nada e recebe
-- false — sinal de que o recebível que ele acabou de criar está duplicado e
-- precisa aparecer no log.

create or replace function public.checkout_item_recebivel(
  p_pedido_id uuid,
  p_produto_id uuid,
  p_receivable_id uuid
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
     set itens = (
           select jsonb_agg(
             case
               when item ->> 'produto_id' = p_produto_id::text
                 then item || jsonb_build_object('receivable_id', p_receivable_id)
               else item
             end
           )
           from jsonb_array_elements(itens) as item
         )
   where id = p_pedido_id
     and exists (
       select 1
       from jsonb_array_elements(itens) as item
       where item ->> 'produto_id' = p_produto_id::text
         and item ->> 'receivable_id' is null
     )
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

comment on function public.checkout_item_recebivel(uuid, uuid, uuid) is
  'Amarra um item do pedido ao recebível que o cobrou, num único comando. Só grava se o item ainda não tinha vínculo (idempotência do upsell). Só service role.';

-- Função de escrita: fora da superfície pública de RPC, igual às da migration
-- 20260908100000. Uma função nova nasce com EXECUTE para PUBLIC, e sem este
-- revoke qualquer visitante poderia reescrever `itens` pelo /rest/v1/rpc/.
revoke execute on function public.checkout_item_recebivel(uuid, uuid, uuid)
  from public, anon, authenticated;
