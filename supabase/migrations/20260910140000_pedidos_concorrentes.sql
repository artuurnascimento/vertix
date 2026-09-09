-- ============================================================================
-- O bônus dos concorrentes passa a existir para o checkout novo.
--
-- O QUE ESTAVA QUEBRADO
--   O bônus "analisamos 2 concorrentes seus" era gravado em
--   `raiox_compras.concorrentes`. Quando a venda do Plano de Correção migrou
--   para o checkout próprio, ela passou a nascer em `public.pedidos` — que não
--   tem esse campo. O resultado: o formulário aparecia na página do plano e o
--   resgate morria em 404, porque a rota do worker só procurava a compra
--   antiga. Todo mundo que comprou pelo checkout novo perdeu o bônus.
--
-- POR QUE UMA COLUNA, E NÃO UMA TABELA
--   É uma lista curta, imutável e de uso único, que só faz sentido junto do
--   pedido — exatamente como já era em `raiox_compras`. Uma tabela própria
--   traria join e ciclo de vida para guardar dois ou cinco domínios.
--
-- `text[]` e não jsonb: são domínios já normalizados pelo mesmo validador da
-- análise pública (`validateStoreUrl`), sem estrutura interna. Igual à coluna
-- que já existe em `raiox_compras`, para os dois caminhos se lerem do mesmo
-- jeito.
--
-- NULO vs ARRAY VAZIO
--   `null` = bônus ainda não resgatado (o formulário aparece).
--   Array com itens = já resgatado (o formulário vira a lista).
--   Array vazio não deve acontecer, e a rota não grava um.
--
-- Migration puramente aditiva: `add column if not exists`. Nada é apagado,
-- alterado ou renomeado, e as policies de `pedidos` seguem valendo — quem
-- escreve aqui é a service role do worker.
-- ============================================================================

alter table public.pedidos
  add column if not exists concorrentes text[];

comment on column public.pedidos.concorrentes is
  'Domínios dos concorrentes que o cliente indicou no bônus do Plano de Correção. NULL = ainda não resgatado. Espelha raiox_compras.concorrentes, do fluxo antigo.';
