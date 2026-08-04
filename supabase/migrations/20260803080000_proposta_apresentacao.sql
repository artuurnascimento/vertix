-- =============================================================================
-- Vertix Admin — Apresentação slide-deck da proposta
-- Adiciona proposals.apresentacao (deck JSON versionado) e reexpõe o campo no
-- RPC público get_proposal_by_token. Propostas sem apresentacao continuam
-- renderizando o layout clássico da página /proposta/:token.
-- =============================================================================

alter table public.proposals
  add column if not exists apresentacao jsonb;

comment on column public.proposals.apresentacao is
  'Deck de apresentação da proposta ({versao:1, slides:[...], aprovacao, posAceite}). Null = layout clássico.';

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
      'apresentacao', pr.apresentacao
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
