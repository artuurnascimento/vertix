-- ---------------------------------------------------------------------------
-- checkout_item_recebivel — reaplicação
-- ---------------------------------------------------------------------------
-- Esta função nasceu na migration 20260908140000, mas foi acrescentada a ela
-- DEPOIS que aquela já havia sido aplicada em produção — e o Supabase não
-- reaplica migration já executada. Sem esta cópia, o vínculo entre o item do
-- upsell e o recebível que o cobrou nunca seria gravado no banco atual, e o
-- Financeiro perderia a segunda linha da venda.
--
-- É `create or replace`, então conviver com a definição da migration anterior
-- é inofensivo: quem criar o banco do zero aplica as duas e termina igual.
-- ---------------------------------------------------------------------------

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
