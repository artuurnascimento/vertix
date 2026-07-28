-- =============================================================================
-- Vertix Admin — URLs de produção (cloud)
--
-- As migrations originais foram escritas para o stack LOCAL e chamam as Edge
-- Functions via host.docker.internal. Aqui reescrevemos as duas rotinas
-- autônomas de maior valor — que já usam net.http_post (pg_net) — para apontar
-- ao endpoint de produção do projeto cloud.
--
--   • _cron_payment_reminders  → lembretes de pagamento (cron diário)
--   • create_nps_on_delivery   → e-mail de NPS quando o projeto é entregue
--
-- A chave abaixo é a anon (pública) deste projeto. Os e-mails só saem de fato
-- depois de `supabase secrets set RESEND_API_KEY=...` (sem ela as functions
-- respondem 200 no-op).
--
-- NOTA: os webhooks notify-client / notify-briefing-submitted (que no local
-- usavam supabase_functions.http_request) seguem inertes no cloud — dependem de
-- adaptar o payload; ficam para um passo seguinte, se necessário.
-- =============================================================================

-- Lembretes de pagamento (chamado pelo cron vertix-lembretes-pagamento).
create or replace function public._cron_payment_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://ukgkjrfvilbdkyevsoxz.supabase.co/functions/v1/payment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZ2tqcmZ2aWxiZGt5ZXZzb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzk3OTAsImV4cCI6MjEwMDgxNTc5MH0.-b0ykhEYpZqGqNEQOzTzKPe9ps8lbY737_c_9H7nSMA'
    ),
    body := '{}'::jsonb
  );

  insert into public.job_runs (job, status, detalhe)
  values ('lembretes-pagamento', 'ok', 'requisição enviada ao edge (Resend)');
exception when others then
  insert into public.job_runs (job, status, itens, detalhe)
  values ('lembretes-pagamento', 'erro', 0, left(sqlerrm, 500));
end;
$$;

-- NPS pós-entrega: cria a pesquisa + dispara o e-mail com o link.
create or replace function public.create_nps_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
begin
  if new.status = 'entregue' and old.status is distinct from new.status then
    insert into public.nps_surveys (project_id, client_id, sent_at)
    values (new.id, new.client_id, now())
    on conflict (project_id) do nothing
    returning id into v_survey_id;

    if v_survey_id is not null then
      perform public.push_notification(
        'nps',
        'Pesquisa NPS enviada',
        'Projeto entregue: ' || new.nome || '. Pesquisa de satisfação enviada.',
        '/admin/relatorios'
      );

      perform net.http_post(
        url := 'https://ukgkjrfvilbdkyevsoxz.supabase.co/functions/v1/nps-request',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZ2tqcmZ2aWxiZGt5ZXZzb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzk3OTAsImV4cCI6MjEwMDgxNTc5MH0.-b0ykhEYpZqGqNEQOzTzKPe9ps8lbY737_c_9H7nSMA'
        ),
        body := jsonb_build_object('survey_id', v_survey_id)
      );
    end if;
  end if;
  return new;
end;
$$;
