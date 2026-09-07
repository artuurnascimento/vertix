-- ---------------------------------------------------------------------------
-- Colunas do plano entregue no pedido do checkout
-- ---------------------------------------------------------------------------
-- O worker do Scan gera o Plano de Correção quando o pedido inclui um produto
-- de entrega `plano_scan`, e precisa de onde guardá-lo. Sem `plano`, a página
-- /plano/:code responde "em preparo" para sempre, mesmo com o pedido pago e o
-- e-mail entregue; sem `plano_gerado_em`, a idempotência da entrega vale só
-- dentro do processo do worker — uma reinicialização, ou uma segunda máquina,
-- geraria e enviaria tudo de novo.
--
-- Espelha o que `raiox_compras` já faz para a venda do funil antigo, para os
-- dois caminhos de venda terem a mesma forma.
--
-- Aditiva: nenhuma coluna existente é alterada, nada é removido.
-- ---------------------------------------------------------------------------

alter table public.pedidos
  add column if not exists plano jsonb,
  add column if not exists plano_gerado_em timestamptz;

comment on column public.pedidos.plano is
  'Plano de Correção já redigido, servido por GET /api/plano/:code. Guardado para não regerar por IA a cada abertura da página: caro, lento e com texto diferente a cada visita, num documento que a pessoa pagou.';

comment on column public.pedidos.plano_gerado_em is
  'Quando o plano foi gerado. É o carimbo que torna a entrega idempotente entre processos — sem ele, duas máquinas ou um reinício entregariam o mesmo pedido duas vezes.';

-- A varredura de recuperação do worker procura pedido pago cujo plano ainda
-- não saiu; o índice parcial tem o tamanho da fila, não o da tabela.
create index if not exists pedidos_plano_pendente_idx
  on public.pedidos (status, created_at)
  where plano_gerado_em is null;
