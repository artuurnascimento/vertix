-- ============================================================================
-- Marcação de call pelo Scan: o evento nasce no Google Calendar (com Meet) e
-- na Agenda do painel ao mesmo tempo
-- ============================================================================
--
-- A trilha consultiva do Scan terminava em "fale com a Vertix" no WhatsApp, e
-- "reunião marcada" só existia como status que alguém mudava à mão. Agora o
-- lead escolhe um horário na página /agendar/<código>, a edge function
-- `scan-agendar` cria o evento no Google Calendar da Vertix (que gera o link
-- do Meet e convida o e-mail do lead) e grava o MESMO evento aqui, na
-- agenda_events — para o time ver a call na semana com o botão de entrar.
--
--   agenda_events.meet_url         link da videochamada
--   agenda_events.google_event_id  id do evento no Google, para reconciliar
--   agenda_events.lead_id          quem marcou (public.leads); sem FK, como
--                                  nas outras tabelas do Scan — faxina de
--                                  leads não pode apagar uma reunião marcada
--   leads.reuniao_em               quando a call foi marcada (a data da call,
--                                  não a do clique)
-- ============================================================================

alter table public.agenda_events
  add column if not exists meet_url text,
  add column if not exists google_event_id text,
  add column if not exists lead_id uuid;

comment on column public.agenda_events.meet_url is
  'Link do Google Meet quando o evento é uma call marcada pelo Scan.';
comment on column public.agenda_events.google_event_id is
  'Id do evento no Google Calendar da Vertix (scan-agendar). NULL nos eventos criados no painel.';
comment on column public.agenda_events.lead_id is
  'Lead do Scan que marcou a call (public.leads). Sem FK de propósito.';

create index if not exists idx_agenda_events_lead on public.agenda_events (lead_id)
  where lead_id is not null;

alter table public.leads
  add column if not exists reuniao_em timestamptz;

comment on column public.leads.reuniao_em is
  'Início da call marcada pelo lead na página de agendamento. NULL = nunca marcou.';
