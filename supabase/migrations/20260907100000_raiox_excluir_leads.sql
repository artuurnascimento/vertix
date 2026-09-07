-- Vertix Scan (Raio-X): a equipe pode excluir um lead (com a análise dele)
-- e zerar tudo (leads + análises), para limpar os testes antes da campanha.
--
-- As tabelas seguem sem grant de delete para authenticated: a exclusão passa
-- por funções SECURITY DEFINER que exigem public.is_team_member().

create or replace function public.raiox_excluir_lead(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_analysis_id uuid;
begin
  if not public.is_team_member() then
    raise exception 'apenas a equipe pode excluir leads' using errcode = '42501';
  end if;

  select analysis_id into v_analysis_id from public.leads where id = p_lead_id;
  if v_analysis_id is null then
    return;
  end if;

  delete from public.leads where id = p_lead_id;
  -- A análise só sai junto se nenhum outro lead apontar para ela.
  delete from public.analyses a
   where a.id = v_analysis_id
     and not exists (select 1 from public.leads l where l.analysis_id = a.id);
end;
$$;

create or replace function public.raiox_zerar_tudo()
returns table (leads_apagados bigint, analises_apagadas bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leads bigint;
  v_analises bigint;
begin
  if not public.is_team_member() then
    raise exception 'apenas a equipe pode zerar o Vertix Scan' using errcode = '42501';
  end if;

  with d as (delete from public.leads returning 1) select count(*) into v_leads from d;
  with d as (delete from public.analyses returning 1) select count(*) into v_analises from d;
  return query select v_leads, v_analises;
end;
$$;

revoke all on function public.raiox_excluir_lead(uuid) from public, anon;
revoke all on function public.raiox_zerar_tudo() from public, anon;
grant execute on function public.raiox_excluir_lead(uuid) to authenticated;
grant execute on function public.raiox_zerar_tudo() to authenticated;
