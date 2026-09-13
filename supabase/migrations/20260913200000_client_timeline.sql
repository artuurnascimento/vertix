-- ---------------------------------------------------------------------------
-- Jornada única — fase 3: a linha do tempo do cliente como view
-- ---------------------------------------------------------------------------
-- Os fatos do relacionamento já estão gravados, cada um na sua tabela, com
-- chave para o cliente (direta ou via projeto / lead). Ninguém os lia em
-- ordem. Esta view é a leitura: uma linha por evento, sempre com quem, quando,
-- o quê e para onde ir — a tela do cliente só ordena e desenha.
--
-- View, não tabela: zero duplicação e nada para manter em sincronia. Cada
-- ramo do union é um evento com carimbo de data próprio; o que ainda não
-- aconteceu (sent_at nulo, pago_em nulo) simplesmente não entra.
--
-- security_invoker: respeita a RLS das tabelas de origem (só a equipe vê).
-- ---------------------------------------------------------------------------

create or replace view public.client_timeline
  with (security_invoker = true)
as
-- Scan: análise, lead, relatório aberto, reunião marcada pelo lead
select l.client_id,
       a.created_at as quando,
       'analise' as tipo,
       'Analisou a loja no Scan' as titulo,
       concat_ws(' · ', a.domain, case when a.score is not null then 'nota ' || replace(round(a.score, 1)::text, '.', ',') end) as detalhe,
       '/admin/leads-raiox' as link,
       a.id as ref_id
  from public.leads l
  join public.analyses a on a.id = l.analysis_id
 where l.client_id is not null
union all
select l.client_id, l.created_at, 'lead', 'Virou lead do Scan',
       concat_ws(' · ', nullif(l.plataforma, ''), nullif(l.dor, ''),
                 case when l.faturamento_mensal is not null then 'fatura R$ ' || l.faturamento_mensal || '/mês' end),
       '/admin/leads-raiox', l.id
  from public.leads l
 where l.client_id is not null
union all
select l.client_id, l.relatorio_aberto_em, 'relatorio_aberto', 'Abriu o relatório do Scan', null, '/admin/leads-raiox', l.id
  from public.leads l
 where l.client_id is not null and l.relatorio_aberto_em is not null
union all
select l.client_id, l.reuniao_em, 'reuniao', 'Marcou reunião pelo Scan', null, '/admin/agenda', l.id
  from public.leads l
 where l.client_id is not null and l.reuniao_em is not null
union all
-- Compras do Scan (fluxo antigo, raiox_compras) e do checkout próprio (pedidos)
select c.client_id, c.pago_em, 'compra_plano', 'Comprou o Plano de Correção',
       concat_ws(' · ', 'R$ ' || replace((c.valor_centavos / 100.0)::numeric(12,2)::text, '.', ','), 'plano ' || c.plano_code),
       '/admin/scan', c.id
  from public.raiox_compras c
 where c.client_id is not null and c.status = 'pago' and c.pago_em is not null
union all
select p.client_id, p.created_at, 'pedido', 'Pedido pago no checkout',
       'R$ ' || replace((p.total_centavos / 100.0)::numeric(12,2)::text, '.', ','),
       '/admin/pedidos', p.id
  from public.pedidos p
 where p.client_id is not null and p.status = 'pago'
union all
select p.client_id, e.created_at, 'correcao_contratada', 'Contratou a Correção Aplicada',
       case e.entrega when 'correcao_criticos' then 'só os 3 críticos' else 'plano completo' end,
       '/admin/pedidos', e.id
  from public.pedido_entregas e
  join public.pedidos p on p.id = e.pedido_id
 where p.client_id is not null and e.entrega in ('correcao_aplicada', 'correcao_criticos')
union all
select p.client_id, e.concluida_em, 'correcao_concluida', 'Correção Aplicada concluída', null, '/admin/pedidos', e.id
  from public.pedido_entregas e
  join public.pedidos p on p.id = e.pedido_id
 where p.client_id is not null and e.concluida_em is not null
union all
-- Projeto, proposta, contrato
select pr.client_id, pr.created_at, 'projeto', 'Projeto criado: ' || pr.nome, pr.tipo_servico, '/admin/projetos/' || pr.id, pr.id
  from public.projects pr
union all
select pr.client_id, pr.perdido_em, 'perdido', 'Oportunidade perdida: ' || pr.nome, pr.motivo_perda, '/admin/projetos/' || pr.id, pr.id
  from public.projects pr
 where pr.perdido_em is not null
union all
select pr.client_id, po.sent_at, 'proposta_enviada', 'Proposta enviada: ' || po.titulo,
       'R$ ' || replace(po.valor_total::numeric(12,2)::text, '.', ','), '/admin/propostas?abrir=' || po.id, po.id
  from public.proposals po
  join public.projects pr on pr.id = po.project_id
 where po.sent_at is not null
union all
select pr.client_id, po.accepted_at, 'proposta_aceita', 'Proposta aceita: ' || po.titulo,
       concat_ws(' · ', 'R$ ' || replace(po.valor_total::numeric(12,2)::text, '.', ','), po.aceite_nome),
       '/admin/propostas?abrir=' || po.id, po.id
  from public.proposals po
  join public.projects pr on pr.id = po.project_id
 where po.accepted_at is not null
union all
select pr.client_id, po.updated_at, 'proposta_recusada', 'Proposta recusada: ' || po.titulo, null, '/admin/propostas?abrir=' || po.id, po.id
  from public.proposals po
  join public.projects pr on pr.id = po.project_id
 where po.status = 'recusada'
union all
select pr.client_id, ct.signed_at, 'contrato', 'Contrato assinado', ct.signer_name, '/admin/projetos/' || pr.id, ct.id
  from public.contracts ct
  join public.projects pr on pr.id = ct.project_id
 where ct.signed_at is not null
union all
-- Dinheiro
select r.client_id, r.pago_em::timestamptz, 'recebivel_pago', 'Pagamento recebido: ' || r.descricao,
       concat_ws(' · ', 'R$ ' || replace(r.valor::numeric(12,2)::text, '.', ','), r.forma_pagamento),
       '/admin/financeiro?abrir=' || r.id, r.id
  from public.receivables r
 where r.client_id is not null and r.status = 'pago' and r.pago_em is not null
union all
select r.client_id, r.vencimento::timestamptz, 'recebivel_vencido', 'Cobrança vencida: ' || r.descricao,
       'R$ ' || replace(r.valor::numeric(12,2)::text, '.', ',') || ' · há ' || (current_date - r.vencimento) || ' dias',
       '/admin/financeiro?abrir=' || r.id, r.id
  from public.receivables r
 where r.client_id is not null and r.status = 'pendente' and r.vencimento < current_date
union all
select s.client_id, s.started_at::timestamptz, 'assinatura', 'Recorrência iniciada: ' || s.descricao,
       'R$ ' || replace(s.valor_mensal::numeric(12,2)::text, '.', ',') || '/mês', '/admin/financeiro', s.id
  from public.subscriptions s
union all
-- Relacionamento: reuniões, chamados, NPS, atividade
select coalesce(pr.client_id, l.client_id), e.inicio, 'reuniao', 'Reunião: ' || e.titulo, e.descricao, '/admin/agenda', e.id
  from public.agenda_events e
  left join public.projects pr on pr.id = e.project_id
  left join public.leads l on l.id = e.lead_id
 where coalesce(pr.client_id, l.client_id) is not null
union all
select pr.client_id, t.created_at, 'ticket', 'Chamado aberto: ' || t.titulo, t.prioridade, '/admin/projetos/' || pr.id, t.id
  from public.support_tickets t
  join public.projects pr on pr.id = t.project_id
union all
select pr.client_id, t.resolved_at, 'ticket_resolvido', 'Chamado resolvido: ' || t.titulo, null, '/admin/projetos/' || pr.id, t.id
  from public.support_tickets t
  join public.projects pr on pr.id = t.project_id
 where t.resolved_at is not null
union all
select coalesce(n.client_id, pr.client_id), n.responded_at, 'nps', 'NPS respondido: nota ' || n.score, n.comentario,
       case when pr.id is not null then '/admin/projetos/' || pr.id end, n.id
  from public.nps_surveys n
  left join public.projects pr on pr.id = n.project_id
 where n.responded_at is not null and n.score is not null and coalesce(n.client_id, pr.client_id) is not null
union all
select pr.client_id, al.created_at, 'atividade', coalesce(nullif(al.descricao, ''), al.tipo), pr.nome, '/admin/projetos/' || pr.id, al.id
  from public.activity_log al
  join public.projects pr on pr.id = al.project_id;

comment on view public.client_timeline is
  'Linha do tempo do cliente: um evento por linha (análise, lead, compra, pedido, correção, projeto, proposta, contrato, pagamento, cobrança vencida, recorrência, reunião, chamado, NPS, atividade), com quando/tipo/título/detalhe/link. Lida pela aba "Linha do tempo" da tela do cliente.';

grant select on public.client_timeline to authenticated;
