-- ---------------------------------------------------------------------------
-- Jornada única — fase 5: automações visíveis e papéis
-- ---------------------------------------------------------------------------
-- 1. `job_status`: o estado atual de cada rotina automática. O cron do
--    Postgres já deixa trilha em `job_runs` (uma linha por disparo); as nove
--    varreduras do worker do Scan rodam a cada minuto e não deixavam nada —
--    uma linha por minuto por varredura seria lixo. Aqui é UMA linha por
--    rotina, sobrescrita: quando rodou, quando foi bem, quando falhou e o
--    erro. O painel "Automações" lê as duas fontes.
--
-- 2. `entregas_pendentes`: quem pagou e ainda não recebeu — pedido do
--    checkout pago sem plano entregue ou sem recibo, e compra do Scan paga
--    sem plano gerado ou sem recibo. As varreduras já tentam de novo
--    sozinhas; a lista existe para a equipe ver o que está preso e mandar
--    reprocessar sem esperar.
--
-- 3. `profiles.role` ganha os papéis que a segunda pessoa vai precisar
--    (comercial, operação). Nada muda para quem é admin/colaborador hoje;
--    `is_team_member()` continua aceitando qualquer perfil.
-- ---------------------------------------------------------------------------

create table public.job_status (
  job text primary key,
  origem text not null default 'worker' check (origem in ('worker', 'cron')),
  ultimo_inicio timestamptz,
  ultimo_ok timestamptz,
  ultimo_erro timestamptz,
  erro text,
  itens integer,
  updated_at timestamptz not null default now()
);

comment on table public.job_status is
  'Estado atual de cada rotina automática (varreduras do worker do Scan): última execução, último sucesso, última falha e o erro. Uma linha por rotina, sobrescrita pelo worker (service role).';

alter table public.job_status enable row level security;

create policy "team seleciona job_status"
  on public.job_status for select
  to authenticated
  using (public.is_team_member());

-- ---------------------------------------------------------------------------

create or replace view public.entregas_pendentes
  with (security_invoker = true)
as
select 'pedido' as tipo,
       p.id,
       p.created_at as pago_em,
       p.cliente_nome as cliente,
       p.cliente_email as email,
       (p.total_centavos / 100.0)::numeric(12,2) as valor,
       case
         when p.entregue_em is null and p.recibo_enviado_em is null then 'plano e recibo'
         when p.entregue_em is null then 'plano'
         else 'recibo'
       end as faltando,
       p.plano_code
  from public.pedidos p
 where p.status = 'pago'
   and (p.entregue_em is null or p.recibo_enviado_em is null)
union all
select 'compra',
       c.id,
       coalesce(c.pago_em, c.created_at),
       l.name,
       l.email,
       (c.valor_centavos / 100.0)::numeric(12,2),
       case
         when c.plano_gerado_em is null and c.recibo_enviado_em is null then 'plano e recibo'
         when c.plano_gerado_em is null then 'plano'
         else 'recibo'
       end,
       c.plano_code
  from public.raiox_compras c
  left join public.leads l on l.id = c.lead_id
 where c.status = 'pago'
   and (c.plano_gerado_em is null or c.recibo_enviado_em is null);

comment on view public.entregas_pendentes is
  'Pagou e não recebeu: pedidos do checkout e compras do Scan pagos que ainda não tiveram plano entregue ou recibo enviado. Lida pelo painel Automações; o reprocessamento chama o worker.';

grant select on public.entregas_pendentes to authenticated;

-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'comercial', 'operacao', 'colaborador'));

comment on column public.profiles.role is
  'admin (tudo), comercial (leads, propostas, clientes), operacao (projetos, entregas), colaborador (legado = operação). Só admin edita configurações e equipe.';
