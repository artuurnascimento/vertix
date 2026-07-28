-- =============================================================================
-- Vertix Admin — Shim de compatibilidade com Supabase Cloud
--
-- As migrations seguintes foram escritas para o stack LOCAL, onde já existem
-- o schema `supabase_functions` (Database Webhooks) e as extensões pg_net /
-- pg_cron. Num projeto cloud recém-criado nada disso existe ainda, então o
-- `db push` falha em briefing_webhook / emails_automaticos / scheduler.
--
-- Este shim roda ANTES dessas migrations e garante os pré-requisitos, sem
-- depender de nenhum toggle no painel:
--   1. extensões pg_net e pg_cron;
--   2. um supabase_functions.http_request() no-op, criado APENAS se a função
--      real (Database Webhooks) ainda não existir — assim os triggers de
--      webhook aplicam e ficam inertes (as URLs deles apontam para o stack
--      local; serão reescritas com a URL do projeto numa migration de produção).
-- Idempotente: se os Webhooks forem ligados depois, a função real prevalece.
-- =============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists supabase_functions;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'supabase_functions'
      and p.proname = 'http_request'
  ) then
    -- Trigger function no-op: recebe os argumentos via TG_ARGV e não faz nada.
    execute $fn$
      create function supabase_functions.http_request()
      returns trigger
      language plpgsql
      as $body$
      begin
        return new;
      end;
      $body$;
    $fn$;
  end if;
end;
$$;
