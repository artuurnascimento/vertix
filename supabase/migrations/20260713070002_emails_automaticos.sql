-- =============================================================================
-- Vertix Admin — Emails automáticos ao cliente
-- Triggers AFTER que disparam a Edge Function notify-client via
-- supabase_functions.http_request, no MESMO padrão de
-- 20260712192855_briefing_webhook.sql (pg_net assíncrono).
--
-- ATENÇÃO (produção): a URL abaixo é do stack LOCAL. O trigger roda dentro do
-- container do Postgres, então usa host.docker.internal:54321 para alcançar o
-- Kong do host (que roteia /functions/v1 para o edge runtime do
-- `supabase functions serve`). Em produção, recrie os triggers apontando para
--   https://<project-ref>.supabase.co/functions/v1/notify-client
-- e troque o Bearer abaixo pela anon key do projeto (a chave local usada aqui
-- é a demo key pública do supabase start — não é segredo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. proposals AFTER UPDATE — sent_at era null e passou a não-null →
--    evento 'proposta_enviada'
-- -----------------------------------------------------------------------------

create trigger notify_client_proposta_enviada
  after update on public.proposals
  for each row
  when (old.sent_at is null and new.sent_at is not null)
  execute function supabase_functions.http_request(
    'http://host.docker.internal:54321/functions/v1/notify-client',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"}',
    '{"event":"proposta_enviada"}',
    '5000'
  );

-- -----------------------------------------------------------------------------
-- 2. projects AFTER UPDATE — status muda para 'entregue' →
--    evento 'projeto_entregue'
-- -----------------------------------------------------------------------------

create trigger notify_client_projeto_entregue
  after update on public.projects
  for each row
  when (new.status = 'entregue' and old.status is distinct from new.status)
  execute function supabase_functions.http_request(
    'http://host.docker.internal:54321/functions/v1/notify-client',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"}',
    '{"event":"projeto_entregue"}',
    '5000'
  );

-- -----------------------------------------------------------------------------
-- 3. receivables AFTER INSERT — evento 'parcela_criada'
-- -----------------------------------------------------------------------------

create trigger notify_client_parcela_criada
  after insert on public.receivables
  for each row
  execute function supabase_functions.http_request(
    'http://host.docker.internal:54321/functions/v1/notify-client',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"}',
    '{"event":"parcela_criada"}',
    '5000'
  );
