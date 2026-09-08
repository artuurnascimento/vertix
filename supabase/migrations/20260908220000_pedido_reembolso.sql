-- ---------------------------------------------------------------------------
-- Reembolso de pedido do checkout
-- ---------------------------------------------------------------------------
-- `pedidos.status` já aceitava 'reembolsado' desde a 20260908100000, mas nada
-- no sistema sabia chegar lá: o valor só era gravado quando a checkout-info
-- consultava o Mercado Pago e descobria um pagamento estornado POR FORA (pelo
-- painel do MP, ou por contestação do titular do cartão). Não existia
-- reembolso pedido pela Vertix, e por isso não existia nem rastro nem defesa
-- contra pedir o mesmo reembolso duas vezes.
--
-- Esta migration acrescenta as duas coisas que faltavam:
--
--   1. O RASTRO. Quando, quem, qual o id do reembolso no Mercado Pago e quanto
--      voltou. Sem isso, "esse pedido foi reembolsado" é uma afirmação sem
--      como ser conferida contra o extrato.
--
--   2. A TRAVA. O ciclo em duas etapas — reservar antes de chamar o gateway
--      (pedido_reembolso_iniciar), concluir depois que ele confirmou
--      (pedido_reembolso_concluir) —, mais a desistência para o único caso em
--      que se sabe que nada saiu (pedido_reembolso_liberar). É o que impede
--      dois cliques de virarem dois reembolsos e o que faz uma falha no meio
--      convergir na tentativa seguinte em vez de devolver o dinheiro de novo.
--
-- SÓ REEMBOLSO TOTAL. Não há coluna de valor parcial nem soma de reembolsos:
-- `reembolso_valor_centavos` é quanto o MP confirmou ter devolvido, guardado
-- para conferência com o extrato, e o status do pedido é binário. Reembolso
-- parcial exigiria repensar o item pago, o recebível e a revogação do acesso —
-- e nenhuma dessas três coisas tem hoje meia resposta.
--
-- REVOGAÇÃO DO ACESSO. O produto entregue é o `plano_code`, servido pelo
-- worker do Scan em GET /api/plano/:code. Quem revoga é o worker, recusando
-- pedido cujo `status` não seja 'pago' — do lado do banco basta que o status
-- vire 'reembolsado' no MESMO comando que grava o rastro, que é o que a
-- pedido_reembolso_concluir() faz. Nenhum índice novo é preciso para essa
-- consulta: `pedidos.plano_code` já é `unique`, então o worker chega à linha
-- (e ao `status` dela) por index scan de uma chave só.
--
-- Aditiva: `if not exists` em tudo, nenhuma coluna existente é alterada,
-- nenhum check é afrouxado. Pedido antigo fica com o rastro em NULL, que é
-- exatamente o que aconteceu com ele — nunca foi reembolsado.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. O rastro do reembolso
-- ---------------------------------------------------------------------------
-- `reembolso_iniciado_em` é a coluna que carrega o peso todo, e por isso vem
-- primeiro. Ela não é "quando começou" no sentido de relatório: ela é a
-- RESERVA. Enquanto ela está preenchida e `reembolsado_em` está vazio, existe
-- uma chamada ao Mercado Pago cujo desfecho o banco não conhece — que é
-- exatamente o estado perigoso, aquele em que o dinheiro pode ter voltado sem
-- o sistema saber. Ver a seção 3 e o índice da seção 2.
--
-- `reembolso_por` referencia `profiles` e não `auth.users`, como todo o resto
-- do sistema (agenda_events.criado_por, arquivos.uploaded_by): é o perfil que
-- o painel sabe exibir por nome. `on delete set null` porque desligar alguém
-- da equipe não pode apagar o registro de um reembolso — perde-se o nome, não
-- o fato.

alter table public.pedidos
  add column if not exists reembolso_iniciado_em timestamptz,
  add column if not exists reembolsado_em timestamptz,
  add column if not exists reembolso_por uuid
    references public.profiles (id) on delete set null,
  add column if not exists reembolso_mp_id text,
  add column if not exists reembolso_valor_centavos integer
    check (reembolso_valor_centavos >= 0);

comment on column public.pedidos.reembolso_iniciado_em is
  'RESERVA do reembolso, não um carimbo de relatório. Preenchida com reembolsado_em ainda NULL significa: existe uma chamada ao Mercado Pago cujo desfecho o banco não conhece. É o estado que a reconciliação procura.';

comment on column public.pedidos.reembolsado_em is
  'Quando o Mercado Pago CONFIRMOU o reembolso. Só é gravada junto com status = reembolsado, no mesmo comando.';

comment on column public.pedidos.reembolso_por is
  'Perfil do painel que pediu o reembolso. NULL em reembolso originado fora da Vertix (estorno pelo painel do MP, contestação do titular).';

comment on column public.pedidos.reembolso_mp_id is
  'ID do reembolso no Mercado Pago (resposta de POST /v1/payments/{id}/refunds). É por ele que a linha do pedido casa com a do extrato.';

comment on column public.pedidos.reembolso_valor_centavos is
  'Quanto o Mercado Pago confirmou ter devolvido, em centavos. Guardado para conferência com o extrato: como só existe reembolso total, diferir de total_centavos é sinal de que algo foi estornado por fora.';

-- ---------------------------------------------------------------------------
-- 2. O índice da reconciliação
-- ---------------------------------------------------------------------------
-- A pergunta que este índice responde é a única que importa depois de uma
-- falha: "que pedidos têm reembolso reservado e não confirmado?". Parcial de
-- propósito — a fila tem o tamanho dos casos em aberto (normalmente zero), não
-- o da tabela de pedidos, e um índice cheio aqui seria peso morto no caminho
-- de escrita de toda venda.

create index if not exists pedidos_reembolso_em_aberto_idx
  on public.pedidos (reembolso_iniciado_em)
  where reembolso_iniciado_em is not null and reembolsado_em is null;

-- ---------------------------------------------------------------------------
-- 3. pedido_reembolso_iniciar — a reserva, antes de tocar no gateway
-- ---------------------------------------------------------------------------
-- POR QUE DUAS ETAPAS, E NÃO UM UPDATE DEPOIS DA RESPOSTA DO MP
--   Reembolsar é a operação em que uma tentativa a mais custa dinheiro de
--   verdade. Se o pedido só mudasse de estado DEPOIS da resposta do gateway,
--   dois cliques em sequência (ou dois operadores, ou um retry de rede)
--   encontrariam o pedido ainda 'pago' e chamariam o MP duas vezes. A chave de
--   idempotência do MP cobre esse caso, mas depender só dela significa que a
--   defesa mora inteira do outro lado da rede.
--
-- A TRAVA É UM LOCK DE LINHA DO POSTGRES (`select ... for update`), e não um
-- UPDATE condicionado como nas outras funções deste módulo. A diferença
-- importa: aqui a resposta precisa dizer POR QUE não reservou — a tela mostra
-- coisas diferentes para "já foi reembolsado" e para "outra pessoa está
-- reembolsando agora" —, e ler o motivo depois de um UPDATE que não pegou
-- seria ler fora da disputa, com a linha livre para mudar entre as duas
-- consultas. Com o lock, o segundo chamador espera o primeiro terminar e
-- então lê um estado que não muda mais debaixo dele. A RPC é uma transação
-- curta; a espera é a de um UPDATE.
--
-- POR QUE A RESERVA EXPIRA (p_retomar_apos)
--   Uma reserva eterna transformaria qualquer falha de meio de caminho —
--   timeout de plataforma, function morta no meio — num pedido travado para
--   sempre, que ninguém consegue reembolsar nem conciliar sem SQL na mão.
--   Passada a janela, a próxima tentativa RETOMA a reserva e chama o MP de
--   novo com a MESMA chave de idempotência: o gateway devolve o reembolso que
--   já existe em vez de criar um segundo. É assim que o caso perigoso — MP
--   reembolsou, banco não gravou — converge, em vez de devolver duas vezes.
--
-- Devolve jsonb com um `resultado` que a edge function traduz em HTTP, e os
-- campos que ela precisa para chamar o gateway sem uma segunda ida ao banco.
-- Recusa que não é erro ('ja_reembolsado') vem separada de recusa que é
-- ('status_invalido'): reembolsar duas vezes o que já foi reembolsado é
-- sucesso, e o cabeçalho da edge function explica por quê.

create or replace function public.pedido_reembolso_iniciar(
  p_pedido_id uuid,
  p_usuario_id uuid default null,
  p_retomar_apos interval default interval '2 minutes'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_atual    public.pedidos%rowtype;
  v_retomada boolean;
begin
  select * into v_atual
    from public.pedidos
   where id = p_pedido_id
     for update;

  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;

  if v_atual.status = 'reembolsado' then
    return jsonb_build_object(
      'resultado',       'ja_reembolsado',
      'pedido_id',       v_atual.id,
      'reembolso_mp_id', v_atual.reembolso_mp_id,
      'reembolsado_em',  v_atual.reembolsado_em,
      'receivable_id',   v_atual.receivable_id
    );
  end if;

  if v_atual.status <> 'pago' then
    return jsonb_build_object('resultado', 'status_invalido', 'status', v_atual.status);
  end if;

  if v_atual.mp_payment_id is null then
    -- Pedido 'pago' sem pagamento no MP não é um caso normal: é uma linha que
    -- ficou pela metade. Um erro próprio evita mandar
    -- POST /v1/payments/null/refunds e receber um 404 indecifrável.
    return jsonb_build_object('resultado', 'sem_pagamento');
  end if;

  if v_atual.reembolso_iniciado_em is not null
     and v_atual.reembolso_iniciado_em >= now() - p_retomar_apos then
    return jsonb_build_object(
      'resultado',             'em_andamento',
      'reembolso_iniciado_em', v_atual.reembolso_iniciado_em
    );
  end if;

  -- Reserva anterior existia e venceu: esta chamada está RETOMANDO uma
  -- tentativa de desfecho desconhecido. A edge function loga o caso — é a
  -- pista de que o dinheiro pode já ter voltado.
  v_retomada := v_atual.reembolso_iniciado_em is not null;

  update public.pedidos
     set reembolso_iniciado_em = now(),
         -- coalesce e não sobrescrita: numa retomada, quem pediu primeiro
         -- continua sendo o autor do reembolso. Quem retomou aparece no log da
         -- edge function; o registro do pedido guarda quem decidiu.
         reembolso_por = coalesce(reembolso_por, p_usuario_id)
   where id = p_pedido_id;

  return jsonb_build_object(
    'resultado',      'reservado',
    'pedido_id',      v_atual.id,
    'mp_payment_id',  v_atual.mp_payment_id,
    'total_centavos', v_atual.total_centavos,
    'receivable_id',  v_atual.receivable_id,
    'plano_code',     v_atual.plano_code,
    'retomada',       v_retomada
  );
end;
$$;

comment on function public.pedido_reembolso_iniciar(uuid, uuid, interval) is
  'Reserva o reembolso de um pedido pago num único UPDATE condicionado, antes de chamar o Mercado Pago. Reserva parada há mais que p_retomar_apos é retomada (a chave de idempotência do MP torna a rechamada segura). Só service role.';

-- ---------------------------------------------------------------------------
-- 4. pedido_reembolso_concluir — o desfecho, num comando só
-- ---------------------------------------------------------------------------
-- Grava o rastro, vira o status para 'reembolsado' (que é o que REVOGA o
-- acesso do lado do worker) e tira o recebível da receita. Tudo dentro da
-- mesma função, porque são a mesma decisão: um pedido reembolsado cujo
-- recebível continuasse 'pago' inflaria o faturamento do mês com dinheiro que
-- não está mais na conta.
--
-- O QUE ACONTECE COM O RECEBÍVEL, E POR QUÊ 'cancelado'
--   Três caminhos foram considerados:
--
--   (a) LANÇAMENTO NEGATIVO — criar um recebível de valor negativo que anule o
--       original. Impossível sem afrouxar `receivables_valor_check`
--       (`valor > 0`, migration 20260712223847), que hoje protege TODA a
--       cobrança da agência contra parcela de valor absurdo. Trocar essa
--       proteção — que vale para contrato, proposta e assinatura — por um caso
--       de reembolso de produto é caro demais pelo que resolve. Some-se que
--       nenhuma tela soma valores com sinal: `ResultadoMensal`,
--       `ReceitaPorTipo`, `TopClientes` e `CashFlowSummary` filtram
--       `status === 'pago'` e somam; um negativo pago apareceria como uma
--       venda de valor negativo em quatro relatórios ao mesmo tempo.
--
--   (b) STATUS NOVO ('reembolsado' em receivables) — exigiria mexer no check
--       de `receivables.status`, e aí cada tela que hoje conhece três valores
--       passaria a receber um quarto que ela não sabe classificar. O
--       ReceivablesSummaryCards trata "não é pago" como pendente: um recebível
--       reembolsado viraria dinheiro A RECEBER, que é o oposto exato do fato.
--       O front é de outro dono e o deploy não é atômico; um status que só
--       metade do sistema entende é pior que nenhum.
--
--   (c) 'cancelado' — já está no check desde a 20260712223847, e as quatro
--       telas de receita citadas acima já o excluem, porque todas somam apenas
--       `status = 'pago'`. É o único caminho em que a receita fica correta no
--       INSTANTE do reembolso, sem deploy de front e sem tocar em constraint
--       compartilhada com a cobrança da agência.
--
--   Escolhido (c). O que 'cancelado' sozinho não conta — que foi reembolso e
--   não desistência — vai na `descricao`, com o sufixo abaixo, para quem olha
--   o Financeiro não precisar abrir o pedido para entender a linha.
--
-- `itens` NÃO é tocado, e a marca `pago` de cada item continua true. Tentador
-- virá-la para false, mas isso criaria uma SEGUNDA fonte de verdade sobre o
-- reembolso, que teria de concordar com `status` para sempre — e nenhum leitor
-- precisa dela: o worker do Scan olha `status`, checkout_item_reservar()
-- exige `status = 'pago'`, e o Financeiro olha o recebível. O array é o
-- snapshot do que foi COMPRADO, ao preço da hora; que o dinheiro voltou é um
-- fato posterior, e ele mora nas colunas de reembolso.
--
-- `pago_em` é DELIBERADAMENTE preservado. O dinheiro entrou naquele dia; isso
-- é um fato do extrato, e apagá-lo não desfaz a transação — só apaga a metade
-- da história que permite conciliar entrada e saída. Quando o reembolso
-- aconteceu está em `pedidos.reembolsado_em`.
--
-- IDEMPOTÊNCIA: o UPDATE do pedido é condicionado a `status = 'pago'`, então a
-- segunda chamada não escreve nada e não é erro. Mas ela AINDA passa pelo
-- cancelamento do recebível — de propósito: se a primeira chamada morreu entre
-- virar o pedido e mexer no Financeiro, é a segunda que fecha a diferença.
-- Convergir é o objetivo; escrever exatamente uma vez, não.

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

  return jsonb_build_object(
    -- 'reembolsado' = esta chamada virou o pedido. 'ja_reembolsado' = outra
    -- virou antes; para quem chamou, os dois são sucesso.
    'resultado',            case when v_escreveu then 'reembolsado' else 'ja_reembolsado' end,
    'pedido_id',            v_pedido.id,
    'reembolso_mp_id',      v_pedido.reembolso_mp_id,
    'reembolsado_em',       v_pedido.reembolsado_em,
    'plano_code',           v_pedido.plano_code,
    'receivable_id',        v_receivable_id,
    'receivable_cancelado', v_cancelou
  );
end;
$$;

comment on function public.pedido_reembolso_concluir(uuid, text, integer) is
  'Fecha o reembolso: status reembolsado (o que revoga o acesso no worker), rastro do MP, itens marcados como não pagos e recebível cancelado para sair da receita. Idempotente e convergente — a segunda chamada não reescreve o pedido mas ainda acerta o Financeiro. Só service role.';

-- ---------------------------------------------------------------------------
-- 5. pedido_reembolso_liberar — desistir da reserva, e SÓ quando dá
-- ---------------------------------------------------------------------------
-- Existe para um caso só: o Mercado Pago RECUSOU o reembolso de forma
-- definitiva e a edge function confirmou, consultando o pagamento, que ele NÃO
-- está reembolsado. Aí nada saiu, e segurar a reserva até ela vencer só
-- obrigaria quem opera a esperar sem motivo.
--
-- Fora desse caso a reserva não é liberada, e a distinção é a coisa mais
-- importante desta função: "o gateway recusou" e "não deu para saber" parecem
-- o mesmo erro na tela e são opostos aqui. Liberar em cima de uma dúvida
-- convidaria o próximo clique a chamar o gateway enquanto o anterior talvez
-- esteja devolvendo o dinheiro — que é exatamente o reembolso em dobro que
-- toda esta migration existe para impedir. Na dúvida, a reserva fica e vence
-- sozinha; a retomada é segura porque a chave de idempotência do MP é a mesma.
--
-- `status = 'pago'` no where é o cinto de segurança: pedido já reembolsado não
-- perde a marca de quando a operação começou por causa de uma chamada
-- atrasada.

create or replace function public.pedido_reembolso_liberar(
  p_pedido_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.pedidos
     set reembolso_iniciado_em = null
   where id = p_pedido_id
     and status = 'pago'
     and reembolsado_em is null
     and reembolso_iniciado_em is not null
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

comment on function public.pedido_reembolso_liberar(uuid) is
  'Solta a reserva de reembolso de um pedido que continua pago. Só deve ser chamada quando se CONFIRMOU que o gateway não reembolsou — na dúvida a reserva fica e vence sozinha. Só service role.';

-- ---------------------------------------------------------------------------
-- 6. Superfície de RPC
-- ---------------------------------------------------------------------------
-- Funções de ESCRITA, e escrita que mexe em dinheiro: fora do /rest/v1/rpc/
-- público, igual a cupom_registrar_uso e checkout_item_reservar. Uma função
-- nova nasce com EXECUTE para PUBLIC; sem estes revokes, qualquer usuário
-- autenticado do painel — e, com `anon`, qualquer visitante — poderia
-- reembolsar um pedido chamando a RPC direto, contornando a checagem de
-- permissão da edge function.

revoke execute on function public.pedido_reembolso_iniciar(uuid, uuid, interval)
  from public, anon, authenticated;
revoke execute on function public.pedido_reembolso_concluir(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.pedido_reembolso_liberar(uuid)
  from public, anon, authenticated;
