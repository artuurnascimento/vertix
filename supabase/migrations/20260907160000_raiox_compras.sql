-- ============================================================================
-- Vertix Scan — venda automática do Plano de Correção
-- ============================================================================
-- Até agora o comprador do Plano de Correção era digitado à mão: alguém via o
-- lead no módulo "Leads Raio-X", criava cliente, projeto e recebível no
-- Financeiro e mandava o link de pagamento. A decisão (2026-09-07) é que quem
-- compra pelo Scan vire cliente de verdade automaticamente, entrando no mesmo
-- funil financeiro dos clientes de agência.
--
-- Duas coisas nascem aqui:
--
--   1. `origem` em clients/projects/receivables. Sem isso não dá para separar
--      no painel o faturamento do Scan (produto, ticket baixo, entrega
--      automática) do trabalho de agência. `clients.origem` já existe desde o
--      núcleo operacional; o `if not exists` deixa a migration idempotente e
--      documenta que a coluna faz parte deste conjunto.
--
--   2. `raiox_compras`: a ponte entre a análise do Scan e o recebível, mais o
--      estado da entrega (plano gerado, recibo enviado, reanálise agendada).
--      Esse estado não cabe em `receivables` — recebível é dinheiro, não
--      entrega — e nem em `leads`, que é do worker do Scan.
--
-- Quem escreve é a service role: a edge function `scan-comprar` cria a linha e
-- a `payment-webhook` a marca como paga e agenda a reanálise. O painel só lê.
-- Por isso `authenticated` recebe apenas SELECT e `anon` não recebe nada —
-- mesmo padrão de analyses/leads (20260905100000_raiox_scan.sql).
--
-- `analysis_id` e `lead_id` são uuid SEM foreign key de propósito: a equipe
-- apaga leads e análises de teste com raiox_excluir_lead()/raiox_zerar_tudo(),
-- e isso NUNCA pode arrastar junto o registro de uma compra que já foi paga.
-- As referências que apontam para dinheiro (client/project/receivable) usam
-- `on delete set null` pelo mesmo motivo: a compra sobrevive à faxina.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Origem dos registros comerciais
-- ---------------------------------------------------------------------------

alter table public.clients     add column if not exists origem text;
alter table public.projects    add column if not exists origem text;
alter table public.receivables add column if not exists origem text;

comment on column public.projects.origem is
  'De onde veio o projeto. ''scan'' = comprou o Plano de Correção no Vertix Scan.';
comment on column public.receivables.origem is
  'De onde veio a cobrança. ''scan'' = venda automática do Plano de Correção.';

-- ---------------------------------------------------------------------------
-- 2. Tabela das compras do Scan
-- ---------------------------------------------------------------------------

create table if not exists public.raiox_compras (
  id uuid primary key default gen_random_uuid(),
  -- Análise que originou a compra (public.analyses). Sem FK — ver cabeçalho.
  analysis_id uuid not null,
  lead_id uuid,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  receivable_id uuid references public.receivables (id) on delete set null,
  valor_centavos integer not null check (valor_centavos > 0),
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento','pago','cancelado','reembolsado')),
  -- Código curto do plano entregue, no mesmo formato do report_code do Scan.
  plano_code text unique,
  plano_gerado_em timestamptz,
  recibo_enviado_em timestamptz,
  concorrentes text[],
  reanalise_agendada_em timestamptz,
  reanalise_analysis_id uuid,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.raiox_compras is
  'Compras do Plano de Correção pelo Vertix Scan: liga a análise ao recebível e guarda o estado da entrega. Escrita só por service role (edge functions).';

-- ---------------------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------------------

-- Busca principal: "esta análise já comprou?" (idempotência do scan-comprar).
create index if not exists raiox_compras_analysis_id_idx
  on public.raiox_compras (analysis_id);

-- Painel filtra por status; e a payment-webhook busca pelo recebível pago.
create index if not exists raiox_compras_status_idx
  on public.raiox_compras (status);
create index if not exists raiox_compras_receivable_id_idx
  on public.raiox_compras (receivable_id);

-- Guarda de idempotência de verdade. A checagem "já existe compra?" que a
-- edge function faz antes de criar é ler-depois-escrever: dois cliques
-- simultâneos passam os dois pela leitura e criam cliente/projeto/recebível em
-- duplicidade. Este índice faz o segundo insert falhar (23505), e a function
-- desfaz o que tinha criado e devolve a compra que já existia.
-- Parcial nos dois estados que significam "compra viva": cancelada ou
-- reembolsada não pode impedir o mesmo lead de comprar de novo.
create unique index if not exists raiox_compras_analysis_ativa_key
  on public.raiox_compras (analysis_id)
  where status in ('aguardando_pagamento', 'pago');

-- ---------------------------------------------------------------------------
-- 4. Trigger updated_at (reusa public.set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists set_updated_at on public.raiox_compras;
create trigger set_updated_at
  before update on public.raiox_compras
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Segurança
-- ---------------------------------------------------------------------------
-- Os default privileges do projeto dão tudo a anon/authenticated em tabela
-- nova (incluindo truncate, que NÃO passa por RLS). Devolvemos só o SELECT da
-- equipe; toda escrita é da service role, que ignora RLS.

alter table public.raiox_compras enable row level security;

revoke all on public.raiox_compras from anon;
revoke insert, update, delete, truncate, trigger, references
  on public.raiox_compras from authenticated;
grant select on public.raiox_compras to authenticated;

drop policy if exists "raiox_equipe_le_compras" on public.raiox_compras;
create policy "raiox_equipe_le_compras" on public.raiox_compras
  for select to authenticated
  using (public.is_team_member());

-- ---------------------------------------------------------------------------
-- 6. O comprador do Scan não recebe o e-mail "nova cobrança"
-- ---------------------------------------------------------------------------
-- `notify_client_parcela_criada` (20260728120001) dispara a edge notify-client
-- a cada insert em receivables, avisando o cliente que há uma cobrança nova.
-- Isso faz sentido para a agência, onde a parcela nasce de um contrato e o
-- cliente precisa ser avisado — e não faz nenhum para o Scan, onde a cobrança
-- nasce no exato instante em que a pessoa está olhando o checkout. O e-mail
-- chegaria junto com a tela de pagamento, confundindo e parecendo falha.
--
-- Só a CONDIÇÃO do trigger muda; a função _notify_parcela_criada() continua
-- intacta e o comportamento dos recebíveis de agência é idêntico ao de hoje:
-- `origem` deles é NULL, e `null is distinct from 'scan'` é verdadeiro.
--
-- A recuperação de quem abandona o checkout do Scan é outra e mora no worker:
-- uma sequência de venda, com a linguagem de quem ainda não é cliente.

drop trigger if exists notify_client_parcela_criada on public.receivables;
create trigger notify_client_parcela_criada
  after insert on public.receivables
  for each row
  when (new.origem is distinct from 'scan')
  execute function public._notify_parcela_criada();

-- ---------------------------------------------------------------------------
-- 7. Sequência de recuperação (quem não comprou) e o plano já redigido
-- ---------------------------------------------------------------------------
-- Quem abandona o checkout entra numa sequência de três e-mails de venda,
-- tocada pelo worker do Scan — é ela que substitui a régua de cobrança, da
-- qual a seção 6 e a payment-reminders tiraram essas vendas.
--
--   emails_sequencia / ultimo_email_em
--     Memória da sequência. Sem elas a varredura do worker é amnésica: cada
--     passagem reenviaria o mesmo e-mail para a mesma pessoa, que foi
--     exatamente o defeito corrigido na régua de cobrança em 2026-09-05.
--
--   plataforma
--     O que o lead declara nas perguntas do funil (Shopify, Nuvemshop, Tray).
--     O Plano de Correção usa isso para dizer ONDE clicar no painel dela; sem
--     o dado o texto sai genérico e o produto perde o diferencial. Texto livre
--     de propósito: um check constraint aqui viraria erro de insert no worker
--     no dia em que o funil ganhar mais uma opção de plataforma.
--
--   plano (jsonb)
--     O plano já redigido. Sem ela, GET /api/plano/:code teria que regerar o
--     documento por IA a cada abertura da página — caro, lento e com texto
--     diferente a cada vez, num documento que a pessoa pagou.

alter table public.leads
  add column if not exists emails_sequencia integer not null default 0,
  add column if not exists ultimo_email_em timestamptz,
  add column if not exists plataforma text;

alter table public.raiox_compras
  add column if not exists plano jsonb;

comment on column public.leads.plataforma is
  'Plataforma declarada pelo lead no funil (Shopify, Nuvemshop, Tray...). Texto livre.';
comment on column public.raiox_compras.plano is
  'Plano de Correção já redigido; servido por GET /api/plano/:code sem regerar por IA.';

-- Varredura da sequência: "quem ainda não recebeu os três e-mails e cujo
-- último saiu há tempo suficiente?". O índice é COMPOSTO, e não só por
-- ultimo_email_em, porque o filtro que manda é emails_sequencia — um btree só
-- em ultimo_email_em não seria usado para ele, e a coluna começa NULL em toda
-- linha, o que a torna pouco seletiva sozinha. Nesta ordem o banco busca o
-- passo da sequência e varre a faixa de tempo dentro dele.
-- Sem predicado parcial de propósito: fixar `emails_sequencia < 3` no índice o
-- faria parar de cobrir a consulta em silêncio no dia em que a sequência
-- virar quatro e-mails.
create index if not exists leads_sequencia_idx
  on public.leads (emails_sequencia, ultimo_email_em);

-- Os novos campos são escritos pelo worker (service role, ignora RLS). A
-- equipe já enxerga tudo pelo grant de SELECT de tabela feito na 20260905100000;
-- nenhum grant novo é necessário, e `anon` continua sem nada.
