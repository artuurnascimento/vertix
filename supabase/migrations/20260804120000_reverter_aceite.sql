-- =============================================================================
-- Reverter aceite de proposta (ação do painel)
-- =============================================================================
--
-- Aceites de teste (ou por engano do cliente) travavam a proposta no estado
-- pós-aceite sem caminho de volta. Esta função desfaz o aceite com as devidas
-- proteções:
--   • só equipe autenticada (ou service_role) pode chamar;
--   • se QUALQUER parcela da proposta já estiver paga, recusa — dinheiro
--     recebido não se desfaz por botão;
--   • apaga as parcelas em aberto geradas pelo aceite, limpa os campos de
--     aceite e volta o projeto de em_desenvolvimento para lead (só se o
--     aceite o tiver movido);
--   • registra tudo no activity_log.
-- =============================================================================

create or replace function public.revert_proposal_acceptance(p_proposal_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_removidas integer;
  v_is_service boolean;
begin
  v_is_service :=
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';

  if not v_is_service
     and not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Apenas a equipe pode reverter um aceite.'
      using errcode = '42501';
  end if;

  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposta não encontrada.';
  end if;

  if v_proposal.status <> 'aceita' then
    raise exception 'Só propostas aceitas podem ser revertidas.';
  end if;

  if exists (
    select 1 from public.receivables
    where proposal_id = v_proposal.id and status = 'pago'
  ) then
    raise exception
      'Há parcela paga nesta proposta — estorne o pagamento antes de reverter.';
  end if;

  delete from public.receivables
  where proposal_id = v_proposal.id;
  get diagnostics v_removidas = row_count;

  update public.proposals
  set status = 'enviada',
      accepted_at = null,
      aceite_nome = null,
      aceite_ip = null,
      aceite_user_agent = null
  where id = v_proposal.id;

  -- Desfaz a promoção automática feita pelo aceite; outros status ficam.
  update public.projects
  set status = 'lead'
  where id = v_proposal.project_id
    and status = 'em_desenvolvimento';

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_proposal.project_id,
    auth.uid(),
    'proposta',
    'Aceite da proposta "' || v_proposal.titulo || '" revertido ('
      || v_removidas || ' parcela(s) em aberto removida(s)).'
  );

  return json_build_object('ok', true, 'parcelas_removidas', v_removidas);
end;
$$;

revoke execute on function public.revert_proposal_acceptance(uuid) from public, anon;
grant execute on function public.revert_proposal_acceptance(uuid) to authenticated;
