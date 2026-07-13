-- =============================================================================
-- Vertix Admin — Fase 10: Contratos com aceite digital
-- contract_templates (seed dos 3 tipos) + contracts + RPCs públicas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  tipo_servico text not null unique
    check (tipo_servico in ('ecommerce', 'sistema', 'site')),
  corpo text not null
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  corpo_final text not null,
  status text not null default 'enviado'
    check (status in ('enviado', 'assinado')),
  token uuid not null unique default gen_random_uuid(),
  signer_name text,
  signer_document text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Índices
-- -----------------------------------------------------------------------------

create index idx_contracts_project_id on public.contracts (project_id);
-- contracts.token: índice único já criado pela constraint UNIQUE.

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------

alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;

-- contract_templates
create policy "team can select contract_templates"
  on public.contract_templates for select to authenticated
  using (public.is_team_member());

create policy "team can insert contract_templates"
  on public.contract_templates for insert to authenticated
  with check (public.is_team_member());

create policy "team can update contract_templates"
  on public.contract_templates for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete contract_templates"
  on public.contract_templates for delete to authenticated
  using (public.is_team_member());

-- contracts
create policy "team can select contracts"
  on public.contracts for select to authenticated
  using (public.is_team_member());

create policy "team can insert contracts"
  on public.contracts for insert to authenticated
  with check (public.is_team_member());

create policy "team can update contracts"
  on public.contracts for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team can delete contracts"
  on public.contracts for delete to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 4. Seed dos 3 templates (pt-BR, prestação de serviço de desenvolvimento web)
-- -----------------------------------------------------------------------------

insert into public.contract_templates (tipo_servico, corpo) values
(
  'site',
  E'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO WEB\n\n' ||
  E'Pelo presente instrumento particular, de um lado {{empresa}}, doravante denominada CONTRATADA, ' ||
  E'e de outro lado {{cliente}}, doravante denominado CONTRATANTE, têm entre si justo e contratado o ' ||
  E'seguinte, referente ao projeto "{{projeto}}":\n\n' ||
  E'CLÁUSULA 1ª — DO OBJETO\n' ||
  E'O presente contrato tem como objeto a prestação de serviços de desenvolvimento e entrega de um site ' ||
  E'institucional/comercial, conforme escopo definido no briefing e na proposta comercial aceita pelo CONTRATANTE.\n\n' ||
  E'CLÁUSULA 2ª — DO PRAZO\n' ||
  E'Os serviços serão executados no prazo estimado de {{prazo}}, contado a partir da confirmação do pagamento ' ||
  E'inicial e do recebimento de todo o material necessário (textos, imagens, acessos) por parte do CONTRATANTE.\n\n' ||
  E'CLÁUSULA 3ª — DO VALOR E FORMA DE PAGAMENTO\n' ||
  E'Pelos serviços ora contratados, o CONTRATANTE pagará à CONTRATADA o valor total de {{valor}}, ' ||
  E'nas condições e parcelas definidas na proposta comercial aceita.\n\n' ||
  E'CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATADA\n' ||
  E'A CONTRATADA se compromete a desenvolver o projeto com qualidade técnica, seguindo as boas práticas de ' ||
  E'mercado, e a manter o CONTRATANTE informado sobre o andamento das etapas.\n\n' ||
  E'CLÁUSULA 5ª — DAS OBRIGAÇÕES DO CONTRATANTE\n' ||
  E'O CONTRATANTE se compromete a fornecer, em tempo hábil, todo o material e as informações necessárias ' ||
  E'para a execução do projeto, bem como efetuar os pagamentos nas datas acordadas.\n\n' ||
  E'CLÁUSULA 6ª — DA PROPRIEDADE INTELECTUAL\n' ||
  E'Após a quitação integral do valor contratado, os direitos de uso sobre o site desenvolvido serão ' ||
  E'transferidos ao CONTRATANTE, ressalvadas bibliotecas, frameworks e ferramentas de terceiros.\n\n' ||
  E'CLÁUSULA 7ª — DA CONFIDENCIALIDADE\n' ||
  E'As partes se comprometem a manter sigilo sobre informações confidenciais trocadas durante a execução deste contrato.\n\n' ||
  E'CLÁUSULA 8ª — DO SUPORTE E MANUTENÇÃO\n' ||
  E'Correções de bugs identificados em até 30 (trinta) dias após a entrega serão realizadas sem custo adicional. ' ||
  E'Novas funcionalidades ou alterações de escopo serão orçadas à parte.\n\n' ||
  E'CLÁUSULA 9ª — DA RESCISÃO\n' ||
  E'O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito, ' ||
  E'sendo devidos os valores proporcionais aos serviços já executados até a data da rescisão.\n\n' ||
  E'CLÁUSULA 10ª — DO FORO\n' ||
  E'Fica eleito o foro da comarca da CONTRATADA para dirimir quaisquer dúvidas oriundas deste contrato.\n\n' ||
  E'Por estarem justas e contratadas, as partes firmam o presente instrumento em {{data}}.'
),
(
  'ecommerce',
  E'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO DE E-COMMERCE\n\n' ||
  E'Pelo presente instrumento particular, de um lado {{empresa}}, doravante denominada CONTRATADA, ' ||
  E'e de outro lado {{cliente}}, doravante denominado CONTRATANTE, têm entre si justo e contratado o ' ||
  E'seguinte, referente ao projeto "{{projeto}}":\n\n' ||
  E'CLÁUSULA 1ª — DO OBJETO\n' ||
  E'O presente contrato tem como objeto a prestação de serviços de desenvolvimento, configuração e entrega ' ||
  E'de uma loja virtual (e-commerce), incluindo catálogo de produtos, carrinho, checkout e integrações de ' ||
  E'pagamento e/ou envio conforme escopo definido no briefing e na proposta comercial aceita.\n\n' ||
  E'CLÁUSULA 2ª — DO PRAZO\n' ||
  E'Os serviços serão executados no prazo estimado de {{prazo}}, contado a partir da confirmação do pagamento ' ||
  E'inicial e do recebimento do catálogo de produtos e demais materiais necessários.\n\n' ||
  E'CLÁUSULA 3ª — DO VALOR E FORMA DE PAGAMENTO\n' ||
  E'Pelos serviços ora contratados, o CONTRATANTE pagará à CONTRATADA o valor total de {{valor}}, ' ||
  E'nas condições e parcelas definidas na proposta comercial aceita.\n\n' ||
  E'CLÁUSULA 4ª — DAS INTEGRAÇÕES DE TERCEIROS\n' ||
  E'Taxas cobradas por gateways de pagamento, plataformas de e-commerce, transportadoras ou quaisquer ' ||
  E'serviços de terceiros são de responsabilidade exclusiva do CONTRATANTE.\n\n' ||
  E'CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA\n' ||
  E'A CONTRATADA se compromete a desenvolver o projeto com qualidade técnica, seguindo as boas práticas de ' ||
  E'mercado e de segurança para transações online.\n\n' ||
  E'CLÁUSULA 6ª — DAS OBRIGAÇÕES DO CONTRATANTE\n' ||
  E'O CONTRATANTE se compromete a fornecer catálogo de produtos, imagens, políticas comerciais e credenciais ' ||
  E'de integração em tempo hábil, bem como efetuar os pagamentos nas datas acordadas.\n\n' ||
  E'CLÁUSULA 7ª — DA PROPRIEDADE INTELECTUAL\n' ||
  E'Após a quitação integral do valor contratado, os direitos de uso sobre a loja desenvolvida serão ' ||
  E'transferidos ao CONTRATANTE, ressalvadas bibliotecas, frameworks e plataformas de terceiros.\n\n' ||
  E'CLÁUSULA 8ª — DA CONFIDENCIALIDADE\n' ||
  E'As partes se comprometem a manter sigilo sobre informações confidenciais, incluindo dados comerciais e ' ||
  E'de clientes, trocadas durante a execução deste contrato.\n\n' ||
  E'CLÁUSULA 9ª — DO SUPORTE E MANUTENÇÃO\n' ||
  E'Correções de bugs identificados em até 30 (trinta) dias após a entrega serão realizadas sem custo adicional. ' ||
  E'Novas funcionalidades ou alterações de escopo serão orçadas à parte.\n\n' ||
  E'CLÁUSULA 10ª — DO FORO\n' ||
  E'Fica eleito o foro da comarca da CONTRATADA para dirimir quaisquer dúvidas oriundas deste contrato.\n\n' ||
  E'Por estarem justas e contratadas, as partes firmam o presente instrumento em {{data}}.'
),
(
  'sistema',
  E'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO DE SISTEMA\n\n' ||
  E'Pelo presente instrumento particular, de um lado {{empresa}}, doravante denominada CONTRATADA, ' ||
  E'e de outro lado {{cliente}}, doravante denominado CONTRATANTE, têm entre si justo e contratado o ' ||
  E'seguinte, referente ao projeto "{{projeto}}":\n\n' ||
  E'CLÁUSULA 1ª — DO OBJETO\n' ||
  E'O presente contrato tem como objeto a prestação de serviços de análise, desenvolvimento e entrega de ' ||
  E'um sistema/aplicação sob medida, conforme escopo funcional definido no briefing e na proposta comercial aceita.\n\n' ||
  E'CLÁUSULA 2ª — DO PRAZO\n' ||
  E'Os serviços serão executados no prazo estimado de {{prazo}}, contado a partir da confirmação do pagamento ' ||
  E'inicial e da validação dos requisitos funcionais pelo CONTRATANTE.\n\n' ||
  E'CLÁUSULA 3ª — DO VALOR E FORMA DE PAGAMENTO\n' ||
  E'Pelos serviços ora contratados, o CONTRATANTE pagará à CONTRATADA o valor total de {{valor}}, ' ||
  E'nas condições e parcelas definidas na proposta comercial aceita.\n\n' ||
  E'CLÁUSULA 4ª — DE ALTERAÇÕES DE ESCOPO\n' ||
  E'Alterações de escopo solicitadas após a aprovação do briefing serão avaliadas quanto a impacto em prazo ' ||
  E'e custo, e formalizadas em aditivo ou nova proposta antes da execução.\n\n' ||
  E'CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA\n' ||
  E'A CONTRATADA se compromete a desenvolver o sistema com qualidade técnica, seguindo boas práticas de ' ||
  E'engenharia de software, testes e documentação mínima necessária para operação.\n\n' ||
  E'CLÁUSULA 6ª — DAS OBRIGAÇÕES DO CONTRATANTE\n' ||
  E'O CONTRATANTE se compromete a fornecer especificações, acessos e validações necessárias em tempo hábil, ' ||
  E'bem como efetuar os pagamentos nas datas acordadas.\n\n' ||
  E'CLÁUSULA 7ª — DA PROPRIEDADE INTELECTUAL E CÓDIGO-FONTE\n' ||
  E'Após a quitação integral do valor contratado, os direitos de uso e o código-fonte desenvolvido ' ||
  E'especificamente para o CONTRATANTE serão a ele transferidos, ressalvadas bibliotecas e frameworks de terceiros.\n\n' ||
  E'CLÁUSULA 8ª — DA CONFIDENCIALIDADE\n' ||
  E'As partes se comprometem a manter sigilo sobre informações confidenciais, dados de negócio e regras ' ||
  E'internas trocadas durante a execução deste contrato.\n\n' ||
  E'CLÁUSULA 9ª — DO SUPORTE E MANUTENÇÃO\n' ||
  E'Correções de bugs identificados em até 30 (trinta) dias após a entrega serão realizadas sem custo adicional. ' ||
  E'Evoluções e novas funcionalidades serão orçadas à parte.\n\n' ||
  E'CLÁUSULA 10ª — DO FORO\n' ||
  E'Fica eleito o foro da comarca da CONTRATADA para dirimir quaisquer dúvidas oriundas deste contrato.\n\n' ||
  E'Por estarem justas e contratadas, as partes firmam o presente instrumento em {{data}}.'
);

-- -----------------------------------------------------------------------------
-- 5. RPCs públicas (SECURITY DEFINER — único acesso do anon)
-- -----------------------------------------------------------------------------

-- Contrato público por token.
create or replace function public.get_contract_by_token(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'corpo_final', c.corpo_final,
    'status', c.status,
    'signer_name', c.signer_name,
    'signed_at', c.signed_at,
    'projeto_nome', p.nome,
    'cliente', json_build_object(
      'nome', cl.nome,
      'empresa', cl.empresa
    )
  )
  from public.contracts c
  join public.projects p on p.id = c.project_id
  join public.clients cl on cl.id = p.client_id
  where c.token = p_token;
$$;

-- Assinatura do contrato pelo cliente. Só age sobre status 'enviado'.
create or replace function public.sign_contract(
  p_token uuid,
  p_signer_name text,
  p_signer_document text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts%rowtype;
begin
  select * into v_contract
  from public.contracts
  where token = p_token
  for update;

  if not found then
    raise exception 'Contrato não encontrado.';
  end if;

  if v_contract.status = 'assinado' then
    raise exception 'Este contrato já foi assinado.';
  end if;

  if p_signer_name is null or btrim(p_signer_name) = '' then
    raise exception 'Nome do assinante é obrigatório.';
  end if;

  update public.contracts
  set status = 'assinado',
      signed_at = now(),
      signer_name = p_signer_name,
      signer_document = p_signer_document
  where id = v_contract.id;

  insert into public.activity_log (project_id, user_id, tipo, descricao)
  values (
    v_contract.project_id,
    null,
    'sistema',
    'Contrato assinado por ' || p_signer_name
  );

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.get_contract_by_token(uuid) from public;
revoke execute on function public.sign_contract(uuid, text, text) from public;

grant execute on function public.get_contract_by_token(uuid) to anon, authenticated;
grant execute on function public.sign_contract(uuid, text, text) to anon, authenticated;
