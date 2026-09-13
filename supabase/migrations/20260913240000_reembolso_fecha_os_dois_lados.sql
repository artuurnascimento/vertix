-- ---------------------------------------------------------------------------
-- Reembolso fecha os dois lados da mesma venda
-- ---------------------------------------------------------------------------
-- Uma venda do Plano de Correção pelo checkout novo vive em DUAS linhas: o
-- `pedido` (com os order bumps) e a `raiox_compras` da mesma análise, que o
-- worker fecha como paga quando entrega o pedido — e é NELA que fica agendada
-- a reanálise de 30 dias (`reanalise_agendada_em`) e que rodam os e-mails de
-- acompanhamento do Scan.
--
-- O reembolso do pedido (`pedido_reembolso_concluir`) virava só o pedido: as
-- medições semanais do bump paravam (o worker exige pedido pago), mas a compra
-- do Scan continuava 'pago' — e a reanálise de 30 dias dispararia, com e-mail
-- comparativo, para quem já tinha recebido o dinheiro de volta. O caminho
-- inverso tinha a mesma brecha: reembolsar pela aba do Scan deixava o pedido
-- pago, com a página do plano e as medições do bump no ar.
--
-- O pagamento no Mercado Pago é um só e o reembolso é total; então cada
-- função passa a revogar também o outro lado, sempre pela mesma análise e só
-- o que ainda está 'pago' (idempotente). O recebível não é tocado aqui: os
-- dois lados apontam para o MESMO recebível (o checkout paga o token da
-- compra), e ele já é cancelado pelo caminho que iniciou o reembolso.
-- ---------------------------------------------------------------------------

create or replace function public.pedido_reembolso_concluir(
  p_pedido_id uuid,
  p_mp_refund_id text default null,
  p_valor_centavos integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pedido        public.pedidos%rowtype;
  v_escreveu      boolean := false;
  v_receivable_id uuid;
  v_cancelou      boolean := false;
  v_compras       integer := 0;
begin
  update public.pedidos
     set status                   = 'reembolsado',
         reembolsado_em           = now(),
         reembolso_mp_id          = coalesce(p_mp_refund_id, reembolso_mp_id),
         reembolso_valor_centavos = coalesce(p_valor_centavos, total_centavos)
   where id = p_pedido_id
     and status = 'pago'
  returning * into v_pedido;

  v_escreveu := found;

  if not v_escreveu then
    select * into v_pedido from public.pedidos where id = p_pedido_id;
    if not found then
      return jsonb_build_object('resultado', 'nao_encontrado');
    end if;
    if v_pedido.status <> 'reembolsado' then
      return jsonb_build_object('resultado', 'status_invalido', 'status', v_pedido.status);
    end if;
  end if;

  v_receivable_id := v_pedido.receivable_id;

  -- Recebível fora da receita. Condicionado a `status <> 'cancelado'` para a
  -- segunda passagem não reescrever a descrição e empilhar o sufixo.
  if v_receivable_id is not null then
    update public.receivables
       set status = 'cancelado',
           descricao = descricao || ' — REEMBOLSADO'
     where id = v_receivable_id
       and status <> 'cancelado';
    v_cancelou := found;
  end if;

  -- A compra do Scan da mesma análise: sem isto a reanálise de 30 dias e os
  -- e-mails de acompanhamento continuariam para um cliente reembolsado.
  -- Roda também na segunda passagem (convergente), e só sobre o que está pago.
  if v_pedido.analysis_id is not null then
    update public.raiox_compras
       set status                   = 'reembolsado',
           reembolsado_em           = now(),
           reembolso_mp_id          = coalesce(p_mp_refund_id, reembolso_mp_id),
           reembolso_valor_centavos = coalesce(p_valor_centavos, valor_centavos)
     where analysis_id = v_pedido.analysis_id
       and status = 'pago';
    get diagnostics v_compras = row_count;
  end if;

  return jsonb_build_object(
    'resultado',            case when v_escreveu then 'reembolsado' else 'ja_reembolsado' end,
    'pedido_id',            v_pedido.id,
    'reembolso_mp_id',      v_pedido.reembolso_mp_id,
    'reembolsado_em',       v_pedido.reembolsado_em,
    'plano_code',           v_pedido.plano_code,
    'receivable_id',        v_receivable_id,
    'receivable_cancelado', v_cancelou,
    'outro_lado_revogado',  v_compras
  );
end;
$$;

comment on function public.pedido_reembolso_concluir(uuid, text, integer) is
  'Fecha o reembolso do pedido: status reembolsado (revoga o acesso no worker e para as medições do bump), rastro do MP, recebível cancelado e a compra do Scan da mesma análise também reembolsada (cancela a reanálise de 30 dias e os e-mails). Idempotente e convergente. Só service role.';

create or replace function public.scan_compra_reembolso_concluir(
  p_compra_id uuid,
  p_mp_refund_id text default null,
  p_valor_centavos integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_compra        public.raiox_compras%rowtype;
  v_escreveu      boolean := false;
  v_receivable_id uuid;
  v_cancelou      boolean := false;
  v_pedidos       integer := 0;
begin
  update public.raiox_compras
     set status                   = 'reembolsado',
         reembolsado_em           = now(),
         reembolso_mp_id          = coalesce(p_mp_refund_id, reembolso_mp_id),
         reembolso_valor_centavos = coalesce(p_valor_centavos, valor_centavos)
   where id = p_compra_id
     and status = 'pago'
  returning * into v_compra;

  v_escreveu := found;

  if not v_escreveu then
    select * into v_compra from public.raiox_compras where id = p_compra_id;
    if not found then
      return jsonb_build_object('resultado', 'nao_encontrado');
    end if;
    if v_compra.status <> 'reembolsado' then
      return jsonb_build_object('resultado', 'status_invalido', 'status', v_compra.status);
    end if;
  end if;

  v_receivable_id := v_compra.receivable_id;

  if v_receivable_id is not null then
    update public.receivables
       set status = 'cancelado',
           descricao = descricao || ' — REEMBOLSADO'
     where id = v_receivable_id
       and status <> 'cancelado';
    v_cancelou := found;
  end if;

  -- O pedido do checkout da mesma análise (com os bumps): o pagamento é um só
  -- e o reembolso é total, então a página do plano e as medições semanais
  -- do Acompanhamento param junto.
  if v_compra.analysis_id is not null then
    update public.pedidos
       set status                   = 'reembolsado',
           reembolsado_em           = now(),
           reembolso_mp_id          = coalesce(p_mp_refund_id, reembolso_mp_id),
           reembolso_valor_centavos = coalesce(p_valor_centavos, total_centavos)
     where analysis_id = v_compra.analysis_id
       and status = 'pago';
    get diagnostics v_pedidos = row_count;
  end if;

  return jsonb_build_object(
    'resultado',            case when v_escreveu then 'reembolsado' else 'ja_reembolsado' end,
    'compra_id',            v_compra.id,
    'reembolso_mp_id',      v_compra.reembolso_mp_id,
    'reembolsado_em',       v_compra.reembolsado_em,
    'plano_code',           v_compra.plano_code,
    'receivable_id',        v_receivable_id,
    'receivable_cancelado', v_cancelou,
    'outro_lado_revogado',  v_pedidos
  );
end;
$$;

comment on function public.scan_compra_reembolso_concluir(uuid, text, integer) is
  'Fecha o reembolso da compra do Scan: status reembolsado (revoga o plano e cancela a reanálise de 30 dias), rastro do MP, recebível cancelado e o pedido do checkout da mesma análise também reembolsado (para as medições do bump). Idempotente e convergente. Só service role.';

-- `create or replace` preserva os privilégios já ajustados nas migrations de
-- origem (execute só para service_role); os revokes ficam aqui por garantia.
revoke execute on function public.pedido_reembolso_concluir(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.scan_compra_reembolso_concluir(uuid, text, integer)
  from public, anon, authenticated;
