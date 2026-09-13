-- ---------------------------------------------------------------------------
-- Jornada única — fase 1: a fila comercial
-- ---------------------------------------------------------------------------
-- O painel sabia o que estava ATRASADO (nudges) mas não o que estava
-- COMBINADO: sem "próxima ação em", uma oportunidade que não gera evento
-- (proposta, briefing) some da vista. Oportunidade = projeto em `lead` /
-- `briefing_*` — sem entidade nova, para preservar Kanban, propostas e
-- portal; a "transferência" da venda para a execução é a mudança de coluna
-- que já existe.
--
-- Colunas em `projects`: responsável, próxima ação (texto + data), valor
-- estimado, previsão de fechamento e a perda (motivo + quando). Um projeto
-- perdido não muda de status — sai do Kanban e da fila por `perdido_em`.
--
-- View `fila_comercial`: o que a tela "Hoje" precisa numa consulta —
-- oportunidades abertas com cliente, responsável, a próxima ação e os
-- sinais do Scan (comprou o plano, pediu ajuda, marcou reunião, abriu o
-- relatório), que pesam mais que a nota da loja.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists responsavel_id uuid references public.profiles(id) on delete set null,
  add column if not exists proxima_acao text,
  add column if not exists proxima_acao_em date,
  add column if not exists valor_estimado numeric(12, 2),
  add column if not exists previsao_fechamento date,
  add column if not exists motivo_perda text,
  add column if not exists perdido_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_valor_estimado_positivo') then
    alter table public.projects
      add constraint projects_valor_estimado_positivo
      check (valor_estimado is null or valor_estimado >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_motivo_perda_valido') then
    alter table public.projects
      add constraint projects_motivo_perda_valido
      check (motivo_perda is null or motivo_perda in ('preco', 'timing', 'sem_resposta', 'concorrente', 'sem_fit', 'outro'));
  end if;
end $$;

create index if not exists projects_proxima_acao_idx
  on public.projects (proxima_acao_em)
  where perdido_em is null;

comment on column public.projects.responsavel_id is 'Quem cuida desta oportunidade/projeto.';
comment on column public.projects.proxima_acao is 'O que combinamos fazer em seguida ("ligar para fechar", "mandar proposta").';
comment on column public.projects.proxima_acao_em is 'Até quando. Vencida = aparece no topo da fila "Hoje".';
comment on column public.projects.valor_estimado is 'Quanto a oportunidade vale, em reais, antes da proposta.';
comment on column public.projects.previsao_fechamento is 'Quando esperamos fechar.';
comment on column public.projects.motivo_perda is 'preco | timing | sem_resposta | concorrente | sem_fit | outro.';
comment on column public.projects.perdido_em is 'Quando desistimos. Preenchido = sai do Kanban e da fila; o histórico fica.';

-- ---------------------------------------------------------------------------
-- fila_comercial
-- ---------------------------------------------------------------------------

create or replace view public.fila_comercial
  with (security_invoker = true)
as
select p.id as project_id,
       p.nome as projeto,
       p.status,
       p.client_id,
       c.nome as cliente,
       c.empresa,
       p.responsavel_id,
       pr.nome as responsavel,
       p.proxima_acao,
       p.proxima_acao_em,
       p.valor_estimado,
       p.previsao_fechamento,
       p.updated_at,
       (exists (select 1 from public.raiox_compras rc where rc.client_id = p.client_id and rc.status = 'pago')
        or exists (select 1 from public.pedidos pe where pe.client_id = p.client_id and pe.status = 'pago')) as comprou_plano,
       (select l.dor from public.leads l
         where l.client_id = p.client_id and l.dor is not null
         order by l.created_at desc limit 1) as pediu_ajuda,
       (select min(l.reuniao_em) from public.leads l where l.client_id = p.client_id) as reuniao_em,
       (select min(l.relatorio_aberto_em) from public.leads l where l.client_id = p.client_id) as relatorio_aberto_em,
       (select count(*) from public.support_tickets t
         where t.project_id = p.id and t.status <> 'resolvido') as tickets_abertos
  from public.projects p
  join public.clients c on c.id = p.client_id
  left join public.profiles pr on pr.id = p.responsavel_id
 where p.status <> 'entregue'
   and p.perdido_em is null;

comment on view public.fila_comercial is
  'Oportunidades e projetos abertos com a próxima ação, o responsável e os sinais do Scan — a base do bloco "Hoje" do painel.';

grant select on public.fila_comercial to authenticated;
