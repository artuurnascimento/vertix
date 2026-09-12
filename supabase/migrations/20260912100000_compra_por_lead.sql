-- ============================================================================
-- Compra do Plano de Correção amarrada ao LEAD, não à análise
-- ============================================================================
--
-- O Vertix Scan reaproveita a análise por domínio (cache de 7 dias). Duas
-- pessoas diferentes — o dono da loja e uma agência, por exemplo — passam pelo
-- portão e recebem o MESMO analysis_id, cada uma com o próprio lead.
--
-- O índice único parcial `raiox_compras_analysis_ativa_key` dizia "uma compra
-- viva por análise". Com duas pessoas na mesma análise isso virava:
--
--   1. a segunda pessoa não conseguia abrir a própria compra enquanto a da
--      primeira estivesse viva (aguardando_pagamento ou pago);
--   2. pior: a scan-comprar, ao encontrar a compra viva da análise, devolvia
--      o payment_url DELA para a segunda pessoa — com o token que pré-preenche
--      o checkout com nome, e-mail e WhatsApp de quem chegou primeiro.
--
-- A regra passa a ser "uma compra viva por LEAD". A scan-comprar recebe o
-- lead_id do worker (que o resolve pelo report_code, único por lead) e faz a
-- idempotência por ele. O clique duplo continua devolvendo a mesma compra;
-- outra pessoa na mesma loja recebe uma compra própria.
--
-- `pedidos.lead_id` faz o mesmo no checkout novo: a checkout-pagar recebe o
-- token da compra (o `t` da URL), resolve o lead pela raiox_compras e grava
-- aqui. É o que permite ao worker escrever o plano com a plataforma e o
-- faturamento de QUEM pagou, e não do lead mais recente da análise.
--
-- Sem FK em lead_id, pelo mesmo motivo de raiox_compras.lead_id
-- (20260907160000): faxina no Scan não pode arrastar nem bloquear venda.
-- ============================================================================

drop index if exists public.raiox_compras_analysis_ativa_key;

-- Parcial nos dois estados que significam "compra viva": cancelada ou
-- reembolsada não impede o mesmo lead de comprar de novo. Linhas antigas sem
-- lead_id ficam fora do índice (NULL nunca colide) — são anteriores a esta
-- regra e não ganham compra nova por aqui.
create unique index if not exists raiox_compras_lead_ativa_key
  on public.raiox_compras (lead_id)
  where status in ('aguardando_pagamento', 'pago') and lead_id is not null;

comment on index public.raiox_compras_lead_ativa_key is
  'Uma compra viva por lead. Substitui raiox_compras_analysis_ativa_key: a análise é compartilhada entre leads (cache por domínio), o lead não.';

alter table public.pedidos
  add column if not exists lead_id uuid;

comment on column public.pedidos.lead_id is
  'Lead do Scan (public.leads) que fez este pedido. Resolvido pela checkout-pagar a partir do token da compra. Sem FK: faxina no Scan não pode arrastar venda. NULL nos pedidos anteriores e nos que não vêm do Scan.';
