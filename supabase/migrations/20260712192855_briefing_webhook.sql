-- =============================================================================
-- Vertix Admin — Webhook de briefing preenchido (Fase 4)
--
-- Trigger AFTER UPDATE em public.briefings: quando o status vira 'preenchido',
-- dispara um POST (via supabase_functions.http_request / pg_net, assíncrono)
-- para a Edge Function notify-briefing-submitted, que envia o email ao admin.
--
-- ATENÇÃO (produção): a URL abaixo é do stack LOCAL. O trigger roda dentro do
-- container do Postgres, então usa host.docker.internal:54321 para alcançar o
-- Kong do host (que roteia /functions/v1 para o edge runtime do
-- `supabase functions serve`). Em produção, recrie o trigger apontando para
--   https://<project-ref>.supabase.co/functions/v1/notify-briefing-submitted
-- e troque o Bearer abaixo pela anon key do projeto (a chave local usada aqui
-- é a demo key pública do supabase start — não é segredo).
-- =============================================================================

create trigger notify_briefing_submitted_webhook
  after update on public.briefings
  for each row
  when (new.status = 'preenchido' and old.status is distinct from new.status)
  execute function supabase_functions.http_request(
    'http://host.docker.internal:54321/functions/v1/notify-briefing-submitted',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"}',
    '{}',
    '5000'
  );
