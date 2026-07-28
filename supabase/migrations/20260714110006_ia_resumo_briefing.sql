-- =============================================================================
-- Vertix Admin — IA aplicada: resumo de briefing
--
-- Ponto de entrada mais barato da IA: transformar as 21-22 respostas do
-- briefing em um resumo executivo estruturado (objetivo, escopo, público,
-- riscos, próximos passos). A geração fica na edge summarize-briefing (usa a
-- API da Anthropic se ANTHROPIC_API_KEY existir, senão cai num resumo
-- extrativo). Aqui só persistimos o resultado.
-- =============================================================================

alter table public.briefings
  add column if not exists resumo text,
  add column if not exists resumo_meta jsonb,
  add column if not exists resumo_gerado_em timestamptz;

comment on column public.briefings.resumo is
  'Resumo executivo em texto gerado a partir de respostas (IA ou extrativo).';
comment on column public.briefings.resumo_meta is
  'Blocos estruturados do resumo: objetivo, escopo, publico, riscos, proximos_passos, fonte.';
