-- ============================================================================
-- Funil comercial do Vertix Scan: qualificação, origem, progresso e trilhas
-- ============================================================================
--
-- Quatro correções do funil, todas aditivas, num só passe:
--
--   leads.dor
--     O que a pessoa respondeu em "o que mais te incomoda na sua loja". Era
--     perguntado no quiz e depois JOGADO FORA: o cadastro não mandava ao
--     worker, e só a tela de falha usava. É o melhor gancho que existe para
--     o e-mail e para a conversa — agora fica no lead.
--
--   leads.origem
--     De onde a pessoa veio: utm_source/medium/campaign/content/term, fbclid
--     e referrer, capturados no primeiro acesso e enviados no cadastro. Sem
--     isso a origem morria no primeiro clique e nenhuma venda era atribuível
--     a campanha nenhuma. jsonb porque as chaves variam por canal; a compra e
--     o pedido chegam à origem pelo lead_id (20260912100000).
--
--   leads.status 'perdido'
--     Recusa ou pedido para parar. Antes, qualquer status diferente de 'novo'
--     interrompia a sequência de e-mails — inclusive 'contatado', que pode
--     ser só uma tentativa de contato. Agora a sequência para em reuniao,
--     cliente e perdido; 'contatado' continua recebendo.
--
--   passos_feitos / acompanhamento_enviado_em / recuperacao_enviada_em
--     O progresso do Plano de Correção morava só no localStorage do
--     navegador: o painel não sabia quem travou em que passo, e o
--     acompanhamento pós-venda não tinha em que se basear. Passa a ser
--     gravado no servidor (lista de `ordem` dos passos concluídos), nas duas
--     tabelas de venda. Os dois carimbos marcam o e-mail de acompanhamento de
--     quem comprou e o de recuperação de quem abriu o checkout e não pagou —
--     cada um sai uma vez.
-- ============================================================================

alter table public.leads
  add column if not exists dor text,
  add column if not exists origem jsonb;

comment on column public.leads.dor is
  'Dor declarada no quiz do funil: pouca_visita | nao_compra | carrinho_abandonado | loja_lenta | nao_sei. NULL quando o quiz foi pulado.';
comment on column public.leads.origem is
  'Origem do acesso, capturada no primeiro carregamento: {utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, referrer}. Só chaves conhecidas, valores de até 200 caracteres.';

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (
  status in ('novo','contatado','reuniao','cliente','perdido')
);

alter table public.raiox_compras
  add column if not exists passos_feitos jsonb not null default '[]'::jsonb,
  add column if not exists acompanhamento_enviado_em timestamptz,
  add column if not exists recuperacao_enviada_em timestamptz;

comment on column public.raiox_compras.passos_feitos is
  'Ordens (inteiros) dos passos do plano que o cliente marcou como feitos. Gravado pelo worker via POST /api/plano/:code/progresso.';
comment on column public.raiox_compras.acompanhamento_enviado_em is
  'Quando saiu o e-mail de acompanhamento (3 dias após a entrega). Uma vez só.';
comment on column public.raiox_compras.recuperacao_enviada_em is
  'Quando saiu o e-mail de recuperação do checkout aberto e não pago. Uma vez só.';

alter table public.pedidos
  add column if not exists passos_feitos jsonb not null default '[]'::jsonb,
  add column if not exists acompanhamento_enviado_em timestamptz;

comment on column public.pedidos.passos_feitos is
  'Ordens (inteiros) dos passos do plano que o cliente marcou como feitos. Gravado pelo worker via POST /api/plano/:code/progresso.';
comment on column public.pedidos.acompanhamento_enviado_em is
  'Quando saiu o e-mail de acompanhamento (3 dias após a entrega). Uma vez só.';
