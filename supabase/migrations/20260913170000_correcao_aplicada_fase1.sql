-- ---------------------------------------------------------------------------
-- Correção Aplicada — Fase 1 (spec 2026-09-12-correcao-aplicada-upsell-design)
-- ---------------------------------------------------------------------------
-- 1. `produtos.entrega` ganha os tipos novos: `correcao_aplicada`,
--    `correcao_criticos` (a Vertix aplica o plano na loja) e
--    `acompanhamento_30d` (três medições semanais + a reanálise). O
--    `concorrentes_extra` já existia no código do painel, mas o CHECK do
--    banco nunca o aceitou — entra também.
-- 2. `pedido_entregas`: o ciclo de vida de um item que alguém entrega à mão
--    (aguardando_contato → em_contato → aplicando → concluida | cancelada).
--    O worker (service role) insere; a equipe atualiza status, observações
--    e datas. `unique (pedido_id, produto_id)` é a idempotência.
-- 3. `pedido_medicoes`: as três medições do Acompanhamento. Só o worker
--    escreve; a equipe lê. O dia 30 é a reanálise de raiox_compras.
-- 4. Catálogo: as duas Correções trocam a entrega `manual` pelos tipos
--    novos; nasce o Acompanhamento de 30 dias (bump, R$ 47 / âncora R$ 97) e
--    ele entra no lugar do "+3 concorrentes" no checkout plano-correcao, com
--    a copy da spec; o "+3 concorrentes" fica inativo.
-- ---------------------------------------------------------------------------

alter table public.produtos drop constraint if exists produtos_entrega_check;
alter table public.produtos
  add constraint produtos_entrega_check
  check (entrega in ('plano_scan', 'manual', 'concorrentes_extra', 'correcao_aplicada', 'correcao_criticos', 'acompanhamento_30d'));

-- ---------------------------------------------------------------------------
-- pedido_entregas
-- ---------------------------------------------------------------------------

create table if not exists public.pedido_entregas (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  produto_id       uuid not null references public.produtos(id),
  entrega          text not null
                   check (entrega in ('correcao_aplicada', 'correcao_criticos', 'manual')),
  status           text not null default 'aguardando_contato'
                   check (status in ('aguardando_contato', 'em_contato', 'aplicando', 'concluida', 'cancelada')),
  observacoes      text,
  contato_em       timestamptz,
  concluida_em     timestamptz,
  email_enviado_em timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (pedido_id, produto_id)
);

comment on table public.pedido_entregas is
  'Itens pagos que alguém da Vertix entrega à mão (Correção Aplicada, manual): status, contato, conclusão. O worker insere; a equipe acompanha.';

create index if not exists pedido_entregas_status_idx on public.pedido_entregas (status);
create index if not exists pedido_entregas_pedido_idx on public.pedido_entregas (pedido_id);

drop trigger if exists set_updated_at on public.pedido_entregas;
create trigger set_updated_at
  before update on public.pedido_entregas
  for each row execute function public.set_updated_at();

alter table public.pedido_entregas enable row level security;
revoke all on public.pedido_entregas from anon;
revoke all on public.pedido_entregas from authenticated;
grant select, update on public.pedido_entregas to authenticated;

drop policy if exists "entregas_equipe_le" on public.pedido_entregas;
create policy "entregas_equipe_le" on public.pedido_entregas
  for select to authenticated
  using (public.is_team_member());

drop policy if exists "entregas_equipe_atualiza" on public.pedido_entregas;
create policy "entregas_equipe_atualiza" on public.pedido_entregas
  for update to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- ---------------------------------------------------------------------------
-- pedido_medicoes
-- ---------------------------------------------------------------------------

create table if not exists public.pedido_medicoes (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  semana           smallint not null check (semana between 1 and 3),
  agendada_para    timestamptz not null,
  analysis_id      uuid references public.analyses(id),
  tentativas       smallint not null default 0,
  email_enviado_em timestamptz,
  created_at       timestamptz not null default now(),
  unique (pedido_id, semana)
);

comment on table public.pedido_medicoes is
  'As três medições semanais do Acompanhamento de 30 dias (dias 7, 14 e 21). Só o worker escreve; o dia 30 é a reanálise de raiox_compras.';

create index if not exists pedido_medicoes_agenda_idx
  on public.pedido_medicoes (agendada_para)
  where email_enviado_em is null;

alter table public.pedido_medicoes enable row level security;
revoke all on public.pedido_medicoes from anon;
revoke all on public.pedido_medicoes from authenticated;
grant select on public.pedido_medicoes to authenticated;

drop policy if exists "medicoes_equipe_le" on public.pedido_medicoes;
create policy "medicoes_equipe_le" on public.pedido_medicoes
  for select to authenticated
  using (public.is_team_member());

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

update public.produtos set entrega = 'correcao_aplicada' where slug = 'correcao-aplicada';
update public.produtos set entrega = 'correcao_criticos' where slug = 'correcao-critica';

insert into public.produtos (nome, slug, descricao, tipo, entrega, preco_centavos, preco_ancora_centavos, ativo)
select
  'Acompanhamento de 30 dias',
  'acompanhamento-30d',
  'Três medições semanais da loja (dias 7, 14 e 21) e a reanálise completa do dia 30, cada uma com um e-mail: o que melhorou, o que quebrou, o que ainda falta.',
  'bump',
  'acompanhamento_30d',
  4700,
  9700,
  true
where not exists (select 1 from public.produtos where slug = 'acompanhamento-30d');

update public.produtos set ativo = false where slug = 'concorrentes-extra';

update public.checkouts c
   set bump_produto_id = (select id from public.produtos where slug = 'acompanhamento-30d'),
       bump_titulo = 'Quer saber se as correções estão funcionando?',
       bump_texto = E'Toda semana, por 30 dias, medimos sua loja de novo e te contamos.\n• Nota, velocidade e links conferidos toda semana\n• Um e-mail com o que melhorou e o que quebrou\n• No dia 30, o antes e depois completo',
       upsell_texto = E'O plano é seu e está pronto. Se faltar tempo para executar, a Vertix entra no tema da sua loja e faz as correções.\n• Todas as correções do plano aplicadas na sua loja Shopify ou Nuvemshop\n• Contato em até 1 dia útil; aplicação em 7 a 10 dias úteis depois do acesso\n• Resumo do que mudou, ponto a ponto, e reanálise comprovando a nota nova',
       downsell_texto = E'Se o pacote completo não couber agora, a gente aplica os três pontos de maior impacto do seu plano.\n• Os passos 1, 2 e 3 do plano aplicados na sua loja\n• Contato em até 1 dia útil; aplicação em até 5 dias úteis depois do acesso\n• Resumo do que mudou e reanálise comprovando a nota nova'
 where c.slug = 'plano-correcao';
