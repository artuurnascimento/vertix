-- Link de bio: a equipe pode zerar as métricas (visitas e cliques), para
-- limpar os números de teste antes de divulgar a página.
--
-- Chamada por src/pages/Bio.tsx (botão "Zerar métricas") via supabase.rpc.
-- bio_events não tem policy de escrita para ninguém (só a RPC de medição
-- grava), então a limpeza passa por uma função SECURITY DEFINER com
-- public.is_team_member(), no mesmo padrão das funções do Raio-X.

create or replace function public.bio_zerar_eventos()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_apagados bigint;
begin
  if not public.is_team_member() then
    raise exception 'apenas a equipe pode zerar as métricas do link de bio'
      using errcode = '42501';
  end if;

  with d as (delete from public.bio_events returning 1)
  select count(*) into v_apagados from d;

  return v_apagados;
end;
$$;

revoke all on function public.bio_zerar_eventos() from public, anon;
grant execute on function public.bio_zerar_eventos() to authenticated;
