-- Agenda da equipe: eventos com janela de tempo, cor e vínculo opcional a
-- projeto. Acesso exclusivo do time (RLS via is_team_member) — sem anon.

create table public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 120),
  descricao text,
  inicio timestamptz not null,
  fim timestamptz not null,
  cor text not null default 'accent'
    check (cor in ('accent', 'sky', 'emerald', 'amber')),
  project_id uuid references public.projects (id) on delete set null,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint agenda_fim_apos_inicio check (fim > inicio)
);

create index idx_agenda_events_inicio on public.agenda_events (inicio);

alter table public.agenda_events enable row level security;

create policy "team seleciona agenda"
  on public.agenda_events for select
  to authenticated
  using (public.is_team_member());

create policy "team insere agenda"
  on public.agenda_events for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza agenda"
  on public.agenda_events for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui agenda"
  on public.agenda_events for delete
  to authenticated
  using (public.is_team_member());
