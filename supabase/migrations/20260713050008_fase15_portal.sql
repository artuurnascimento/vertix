-- =============================================================================
-- Vertix Admin — Fase 15: Portal do cliente 2.0 (aprovação de etapa)
-- RPC pública approve_project_stage.
--
-- Decisão de dados: o enum projects.status é
--   ('lead', 'briefing_enviado', 'briefing_recebido', 'em_desenvolvimento',
--    'revisao', 'entregue')
-- A etapa imediatamente anterior a 'entregue' é 'revisao' (confirmado via
-- check constraint projects_status_check). O gate de aprovação do cliente,
-- portanto, exige status = 'revisao' (não 'em_desenvolvimento').
-- =============================================================================

create or replace function public.approve_project_stage(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
begin
  select * into v_project
  from public.projects
  where portal_token = p_token
  for update;

  if not found then
    raise exception 'Projeto não encontrado.';
  end if;

  if v_project.status = 'entregue' then
    raise exception 'Este projeto já foi marcado como entregue.';
  end if;

  if v_project.status <> 'revisao' then
    raise exception 'A entrega só pode ser aprovada quando o projeto está em revisão.';
  end if;

  update public.projects
  set status = 'entregue'
  where id = v_project.id;

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_project.id,
    null,
    'sistema',
    'Entrega aprovada pelo cliente'
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.approve_project_stage(uuid) from public;
grant execute on function public.approve_project_stage(uuid) to anon, authenticated;
