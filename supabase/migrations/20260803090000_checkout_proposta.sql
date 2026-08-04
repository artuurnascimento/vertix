-- =============================================================================
-- Vertix Admin — Checkout da entrada na proposta pública
-- get_proposal_by_token passa a devolver a "entrada" (primeiro receivable não
-- cancelado da proposta): a página /proposta/:token usa isso para, após o
-- aceite, exibir o checkout dos 30% e só liberar os próximos passos quando o
-- pagamento for confirmado (payment-webhook ou baixa manual no Financeiro).
-- =============================================================================

create or replace function public.get_proposal_by_token(t uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'proposta', json_build_object(
      'id', pr.id,
      'titulo', pr.titulo,
      'itens', pr.itens,
      'desconto', pr.desconto,
      'valor_total', pr.valor_total,
      'condicoes', pr.condicoes,
      'parcelas', pr.parcelas,
      'validade', pr.validade,
      'status', pr.status,
      'accepted_at', pr.accepted_at,
      'aceite_nome', pr.aceite_nome,
      'sent_at', pr.sent_at,
      'apresentacao', pr.apresentacao,
      'entrada', (
        select json_build_object(
          'id', r.id,
          'valor', r.valor,
          'vencimento', r.vencimento,
          'status', r.status,
          'payment_link', r.payment_link
        )
        from public.receivables r
        where r.proposal_id = pr.id
          and r.status <> 'cancelado'
        order by r.vencimento asc, r.created_at asc
        limit 1
      )
    ),
    'projeto_nome', p.nome,
    'cliente', json_build_object(
      'nome', c.nome,
      'empresa', c.empresa
    )
  )
  from public.proposals pr
  join public.projects p on p.id = pr.project_id
  join public.clients c on c.id = p.client_id
  where pr.token = t
    and pr.status <> 'rascunho';
$$;
