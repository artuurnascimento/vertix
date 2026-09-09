-- ============================================================================
-- Conserta o "Zerar tudo" do Vertix Scan.
--
-- SINTOMA
--   O botão falhava com `DELETE requires a WHERE clause` e nenhum lead era
--   apagado. A exclusão de UM lead continuava funcionando — foi a pista.
--
-- CAUSA
--   O Supabase habilita por padrão a extensão `safeupdate` (pg-safeupdate),
--   que recusa DELETE e UPDATE sem WHERE. É proteção contra apagar uma tabela
--   inteira por engano, e vale para o comando executado — inclusive dentro de
--   uma função SECURITY DEFINER, que é onde o nosso estava. A versão anterior
--   (migration 20260907100000) fazia `delete from public.leads` puro.
--
--   Por isso `raiox_excluir_lead` nunca quebrou: ela filtra por `id`.
--
-- CORREÇÃO
--   `where id is not null`, e não `where true` nem `where 1=1`.
--
--   Predicado constante é dobrado pelo planejador e pode desaparecer do plano
--   antes de a extensão olhar — ou seja, "where true" às vezes acaba sendo
--   exatamente igual a não ter WHERE. `id is not null` é predicado sobre
--   coluna real, sobrevive ao planejamento, e como `id` é chave primária ele
--   casa com todas as linhas. Mesma semântica de antes, agora explícita.
--
-- O QUE NÃO MUDA
--   Assinatura, retorno, `security definer`, o `search_path` e a trava de
--   `is_team_member()`. E o zerar continua NÃO tocando em `raiox_compras`,
--   `clients`, `projects` ou `receivables`: faxina de teste jamais pode
--   arrastar registro de venda paga (ver 20260907160000).
-- ============================================================================

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

  -- Leads primeiro: eles apontam para `analyses`.
  with d as (delete from public.leads where id is not null returning 1)
  select count(*) into v_leads from d;

  with d as (delete from public.analyses where id is not null returning 1)
  select count(*) into v_analises from d;

  return query select v_leads, v_analises;
end;
$$;

-- `create or replace` preserva as ACLs, mas repetir deixa a migration completa
-- para quem aplicar num banco novo lendo só este arquivo.
revoke all on function public.raiox_zerar_tudo() from public, anon;
grant execute on function public.raiox_zerar_tudo() to authenticated;
