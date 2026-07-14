-- =============================================================================
-- Vertix Admin — Templates de proposta comercial
-- proposal_templates — RLS team select, admin update. Seed com 3 tipos de
-- serviço (ecommerce/sistema/site) usando o MESMO shape de itens já em uso em
-- public.proposals.itens: array de {descricao, quantidade, valor_unitario}.
-- =============================================================================

create table public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  tipo_servico text not null unique
    check (tipo_servico in ('ecommerce', 'sistema', 'site')),
  titulo text not null,
  -- array de {descricao, quantidade, valor_unitario} — mesmo shape de proposals.itens
  itens jsonb not null default '[]',
  condicoes text
);

alter table public.proposal_templates enable row level security;

create policy "team seleciona proposal_templates"
  on public.proposal_templates for select
  to authenticated
  using (public.is_team_member());

create policy "admin insere proposal_templates"
  on public.proposal_templates for insert
  to authenticated
  with check (public.is_admin());

create policy "admin atualiza proposal_templates"
  on public.proposal_templates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin exclui proposal_templates"
  on public.proposal_templates for delete
  to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Seed — 3 templates com itens realistas de agência pt-BR.
-- -----------------------------------------------------------------------------

insert into public.proposal_templates (tipo_servico, titulo, itens, condicoes)
values
  (
    'ecommerce',
    'Loja virtual completa',
    '[
      {"descricao": "Setup e configuração da loja (catálogo, frete e checkout)", "quantidade": 1, "valor_unitario": 6800},
      {"descricao": "Design de tema exclusivo mobile-first", "quantidade": 1, "valor_unitario": 4200},
      {"descricao": "Integração de meios de pagamento (Pix, cartão e boleto)", "quantidade": 1, "valor_unitario": 1800},
      {"descricao": "Cadastro e otimização de produtos (até 50 itens)", "quantidade": 1, "valor_unitario": 1500},
      {"descricao": "SEO técnico + Google Merchant Center", "quantidade": 1, "valor_unitario": 1400}
    ]'::jsonb,
    '50% na aprovação, 50% na entrega. Prazo médio de 30 dias úteis após aprovação do briefing. Alterações fora do escopo são orçadas à parte.'
  ),
  (
    'sistema',
    'Sistema sob medida',
    '[
      {"descricao": "Levantamento de requisitos e modelagem de dados", "quantidade": 1, "valor_unitario": 3200},
      {"descricao": "Desenvolvimento das telas principais e fluxos de uso", "quantidade": 1, "valor_unitario": 9800},
      {"descricao": "Gestão de permissões e perfis de acesso", "quantidade": 1, "valor_unitario": 2400},
      {"descricao": "Homologação e ajustes finais", "quantidade": 1, "valor_unitario": 1800},
      {"descricao": "Deploy e suporte na virada de chave", "quantidade": 1, "valor_unitario": 1200}
    ]'::jsonb,
    '50% na aprovação, 50% na entrega. Prazo médio de 45 dias úteis após aprovação do briefing. Alterações fora do escopo são orçadas à parte.'
  ),
  (
    'site',
    'Site institucional',
    '[
      {"descricao": "Design e desenvolvimento do site institucional (5 páginas)", "quantidade": 1, "valor_unitario": 5900},
      {"descricao": "Conteúdo e copywriting das páginas", "quantidade": 1, "valor_unitario": 1600},
      {"descricao": "SEO técnico + Google Business Profile", "quantidade": 1, "valor_unitario": 1400},
      {"descricao": "Formulários de contato e integração com WhatsApp", "quantidade": 1, "valor_unitario": 900}
    ]'::jsonb,
    '50% na aprovação, 50% na entrega. Prazo médio de 20 dias úteis após aprovação do briefing. Alterações fora do escopo são orçadas à parte.'
  );
