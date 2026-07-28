-- =============================================================================
-- Hardening de privilégios — correção de escalação via profiles.role
-- =============================================================================
--
-- CRÍTICO corrigido aqui: a policy "user can update own profile" restringe a
-- LINHA (id = auth.uid()) mas não as COLUNAS. Como is_admin() lê justamente
-- profiles.role, qualquer colaborador autenticado podia se auto-promover com
-- um único PATCH na REST API:
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
--
-- ...ganhando acesso a delete de clientes, templates de proposta (preços),
-- settings da empresa e disparo manual de cobrança recorrente.
--
-- Defesa em duas camadas:
--   1. Privilégio de coluna: authenticated só pode atualizar `nome`.
--   2. Trigger: bloqueia mudança de `role` por quem não é admin, cobrindo
--      qualquer via futura (RPC nova, policy alterada) que contorne a camada 1.
--
-- Mudanças de papel passam a ser feitas por service_role (edge function
-- invite-user, que já valida role='admin') ou pelo SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Privilégio de coluna
-- -----------------------------------------------------------------------------
-- O app nunca faz update em profiles (só select) — verificado em auth.tsx,
-- TeamSettingsCard e TasksCard. Restringir a `nome` não quebra nada e deixa
-- espaço para uma futura tela de "editar meu perfil".

revoke update on public.profiles from authenticated;
grant update (nome) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Trigger de defesa em profundidade
-- -----------------------------------------------------------------------------

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só interessa quando o papel muda de fato.
  if new.role is distinct from old.role then
    -- service_role (edge functions internas) e o próprio postgres passam.
    if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
      return new;
    end if;

    if not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o papel de um usuário.'
        using errcode = '42501';
    end if;

    -- Ninguém se auto-promove, nem mesmo quem já é admin: evita que uma conta
    -- comprometida se blinde sozinha e força a mudança a passar por outro admin.
    if new.id = auth.uid() then
      raise exception 'Não é permitido alterar o próprio papel.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.prevent_role_escalation() is
  'Bloqueia mudança de profiles.role por não-admins e auto-alteração de papel.';

drop trigger if exists prevent_role_escalation on public.profiles;
create trigger prevent_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_role_escalation();
