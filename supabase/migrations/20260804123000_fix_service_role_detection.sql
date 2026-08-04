-- =============================================================================
-- Detecção de service_role compatível com o PostgREST atual
-- =============================================================================
--
-- O PostgREST moderno publica as claims do JWT no GUC `request.jwt.claims`
-- (json); o GUC granular `request.jwt.claim.role` é legado e vem vazio aqui.
-- prevent_role_escalation e revert_proposal_acceptance liam só o legado, então
-- a exceção para service_role nunca disparava. Centraliza a leitura num helper
-- que aceita os dois formatos e recria as duas funções por cima dele.
-- =============================================================================

create or replace function public.is_service_role()
returns boolean
language plpgsql
stable
as $$
declare
  v_claims json;
begin
  begin
    v_claims := current_setting('request.jwt.claims', true)::json;
  exception when others then
    v_claims := null;
  end;

  return coalesce(v_claims ->> 'role', '') = 'service_role'
    or coalesce(current_setting('request.jwt.claim.role', true), '')
       = 'service_role';
end;
$$;

revoke execute on function public.is_service_role() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- revert_proposal_acceptance — guard via helper
-- ---------------------------------------------------------------------------

create or replace function public.revert_proposal_acceptance(p_proposal_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_removidas integer;
begin
  if not public.is_service_role()
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

-- ---------------------------------------------------------------------------
-- prevent_role_escalation — mesma correção (a exceção de service_role era
-- letra morta com o GUC legado)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if public.is_service_role() then
      return new;
    end if;
    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o papel de um usuário.'
        using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception 'Não é permitido alterar o próprio papel.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
