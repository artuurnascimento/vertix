-- ============================================================================
-- Vertix Scan — faturamento informado pelo lojista
-- ============================================================================
-- O formulário do relatório pergunta "quanto você fatura (ou pretende
-- faturar) por mês", em faixas. O worker guarda o valor de referência da
-- faixa e usa na perda estimada (relatório, e-mail e PDF). Também qualifica
-- o lead no painel.
-- ============================================================================

alter table public.leads add column faturamento_mensal integer;

comment on column public.leads.faturamento_mensal is
  'Faturamento mensal em reais informado no formulário (valor de referência da faixa). Null nos leads anteriores a 2026-09-06.';
