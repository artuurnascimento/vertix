-- ============================================================================
-- Vertix Scan — e-mail do lead e entrega automática do relatório
-- ============================================================================
-- O relatório passa a ser ENTREGUE por e-mail assim que a análise profunda
-- termina (Resend, remetente no-reply@vertix.studio). O WhatsApp continua
-- sendo coletado, mas para o contato direto da Vertix — não para a entrega.
-- ============================================================================

alter table public.leads add column email text;
alter table public.leads add column relatorio_enviado_em timestamptz;

comment on column public.leads.email is
  'Para onde o relatório é enviado. Null nos leads anteriores a 2026-09-05.';
comment on column public.leads.relatorio_enviado_em is
  'Quando o e-mail com o relatório saiu; null = ainda não enviado.';

-- Busca dos leads pendentes de envio (worker, service_role).
create index leads_envio_pendente_idx on public.leads (relatorio_enviado_em)
  where relatorio_enviado_em is null;
