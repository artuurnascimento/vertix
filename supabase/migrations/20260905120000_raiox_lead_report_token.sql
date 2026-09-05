-- ============================================================================
-- Vertix Scan — token do relatório gravado no lead
-- ============================================================================
-- O relatório completo é entregue pelo WhatsApp, não no site. O worker grava
-- o token assinado no lead na hora do unlock; o painel (Leads Raio-X) monta
-- o link /relatorio/:id?token=... e o inclui na mensagem do WhatsApp.
-- Sem o token o link não abre (o worker valida a assinatura).
-- ============================================================================

alter table public.leads add column report_token text;
