-- =============================================================================
-- Vertix Admin — Fase 9: Cobrança automática
-- Colunas de integração com gateway de pagamento em receivables.
-- =============================================================================

alter table public.receivables
  add column payment_link text,
  add column gateway_payment_id text;
