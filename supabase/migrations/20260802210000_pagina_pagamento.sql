-- =============================================================================
-- Página de pagamento própria (/pagar/:token)
-- =============================================================================
--
-- Cada parcela ganha um token público não adivinhável. A página pública lê os
-- dados via get_payment_info(token) — mesma mecânica dos tokens de proposta e
-- contrato — e o pagamento em si é criado pela edge function process-payment,
-- que consulta a parcela pelo mesmo token e NUNCA confia em valor vindo do
-- navegador.
-- =============================================================================

alter table public.receivables
  add column if not exists payment_token uuid not null default gen_random_uuid();

create unique index if not exists receivables_payment_token_idx
  on public.receivables (payment_token);

-- -----------------------------------------------------------------------------
-- RPC pública: dados exibidos na página de pagamento
-- -----------------------------------------------------------------------------
-- Devolve apenas o necessário para renderizar a cobrança. O e-mail do cliente
-- entra para pré-preencher o formulário (menos digitação = mais conversão) e é
-- aceitável porque o token é secreto e chega ao cliente pelo próprio link.

create or replace function public.get_payment_info(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'descricao', r.descricao,
    'valor', r.valor,
    'vencimento', r.vencimento,
    'status', r.status,
    'projeto_nome', p.nome,
    'cliente_nome', c.nome,
    'cliente_email', c.email
  )
  into v_result
  from public.receivables r
  join public.projects p on p.id = r.project_id
  join public.clients c on c.id = r.client_id
  where r.payment_token = p_token;

  if v_result is null then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_payment_info(uuid) to anon, authenticated;
