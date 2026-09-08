-- ---------------------------------------------------------------------------
-- Reembolso da compra do Vertix Scan
-- ---------------------------------------------------------------------------
-- A 20260908220000 deu reembolso a `pedidos` — o checkout novo, que hoje está
-- VAZIO. As vendas que existem de verdade moram em `raiox_compras` e aparecem
-- em Captação → Vertix Scan → Vendas. Esta migration estende para elas o mesmo
-- ciclo, com o mesmo vocabulário, para não haver duas ideias de reembolso no
-- sistema.
--
-- O QUE É DIFERENTE AQUI, E É A RAZÃO DESTE ARQUIVO EXISTIR
--   `pedidos` guarda `mp_payment_id` na própria linha. `raiox_compras` NÃO
--   guarda o id do pagamento em coluna nenhuma: a compra aponta para um
--   recebível (`receivable_id`), e é o recebível que tem `gateway_payment_id`.
--   Só que essa coluna ficou NULA em todas as vendas até 2026-09-08 — nenhum
--   código a escrevia —, então o id precisa ser DESCOBERTO no Mercado Pago
--   antes de existir reembolso.
--
--   A descoberta é possível porque `external_reference` do pagamento é o id do
--   recebível: quem monta a cobrança (process-payment) grava
--   `external_reference: receivable.id`, e quem confirma (payment-webhook) lê
--   `payment.external_reference` para achar a parcela. A edge function
--   scan-reembolsar busca por essa referência e grava o id encontrado com a
--   scan_compra_reembolso_pagamento() abaixo — o que recupera as vendas
--   antigas uma a uma, sem migration de dados que chute ids.
--
-- Tudo o mais é o padrão já decidido na 20260908220000, e a leitura daquele
-- arquivo vale por metade deste:
--   • ciclo em duas etapas — RESERVAR antes do gateway, CONCLUIR depois dele;
--   • a reserva é `select ... for update`, para a resposta poder dizer POR QUE
--     não reservou sem ler fora da disputa;
--   • a reserva EXPIRA (p_retomar_apos) e a retomada é segura porque a chave
--     de idempotência do MP é a mesma;
--   • liberar a reserva só quando se CONFIRMOU que nada saiu;
--   • o recebível vira 'cancelado' (não negativo, não status novo) — as três
--     alternativas estão pesadas na 20260908220000, seção 4;
--   • SÓ REEMBOLSO TOTAL.
--
-- REVOGAÇÃO DO ACESSO. O produto é o `plano_code`, servido pelo worker do Scan
-- em GET /api/plano/:code. O worker já recusa compra cujo status não seja
-- 'pago', então basta o status virar 'reembolsado' no MESMO comando que grava
-- o rastro — que é o que a scan_compra_reembolso_concluir() faz. Nenhum índice
-- novo: `plano_code` já é `unique`.
--
-- COMPRAR DE NOVO CONTINUA POSSÍVEL. `raiox_compras_analysis_ativa_key`
-- (20260907160000) é parcial em ('aguardando_pagamento','pago'); uma compra
-- reembolsada sai do índice e o mesmo lead pode comprar outra vez.
--
-- Aditiva: `if not exists` em tudo, nenhuma coluna existente é alterada,
-- nenhum check é afrouxado — 'reembolsado' já está no check de
-- `raiox_compras.status` desde a 20260907160000. Compra antiga fica com o
-- rastro em NULL, que é exatamente o que aconteceu com ela.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. O rastro do reembolso
-- ---------------------------------------------------------------------------
-- Mesmas cinco colunas de `pedidos`, com os mesmos nomes de propósito: quem
-- ler as duas tabelas lado a lado num relatório não deve precisar traduzir
-- nada. `reembolso_iniciado_em` carrega o peso todo — ela é a RESERVA, não um
-- carimbo de relatório (ver a seção 2 e a 3).

alter table public.raiox_compras
  add column if not exists reembolso_iniciado_em timestamptz,
  add column if not exists reembolsado_em timestamptz,
  add column if not exists reembolso_por uuid
    references public.profiles (id) on delete set null,
  add column if not exists reembolso_mp_id text,
  add column if not exists reembolso_valor_centavos integer
    check (reembolso_valor_centavos >= 0);

comment on column public.raiox_compras.reembolso_iniciado_em is
  'RESERVA do reembolso, não um carimbo de relatório. Preenchida com reembolsado_em ainda NULL significa: existe uma chamada ao Mercado Pago cujo desfecho o banco não conhece. É o estado que a reconciliação procura.';

comment on column public.raiox_compras.reembolsado_em is
  'Quando o Mercado Pago CONFIRMOU o reembolso. Só é gravada junto com status = reembolsado, no mesmo comando.';

comment on column public.raiox_compras.reembolso_por is
  'Perfil do painel que pediu o reembolso. NULL em reembolso originado fora da Vertix (estorno pelo painel do MP, contestação do titular).';

comment on column public.raiox_compras.reembolso_mp_id is
  'ID do reembolso no Mercado Pago (resposta de POST /v1/payments/{id}/refunds). É por ele que a linha da compra casa com a do extrato.';

comment on column public.raiox_compras.reembolso_valor_centavos is
  'Quanto o Mercado Pago confirmou ter devolvido, em centavos. Guardado para conferência com o extrato: como só existe reembolso total, diferir de valor_centavos é sinal de que algo foi estornado por fora.';

-- ---------------------------------------------------------------------------
-- 2. O índice da reconciliação
-- ---------------------------------------------------------------------------
-- Responde a única pergunta que importa depois de uma falha: "que compras têm
-- reembolso reservado e não confirmado?". Parcial, pelo mesmo motivo do índice
-- gêmeo em `pedidos`: a fila tem o tamanho dos casos em aberto (normalmente
-- zero), e um índice cheio aqui seria peso morto na escrita de toda venda.

create index if not exists raiox_compras_reembolso_em_aberto_idx
  on public.raiox_compras (reembolso_iniciado_em)
  where reembolso_iniciado_em is not null and reembolsado_em is null;

-- ---------------------------------------------------------------------------
-- 3. scan_compra_reembolso_iniciar — a reserva, antes de tocar no gateway
-- ---------------------------------------------------------------------------
-- Igual à pedido_reembolso_iniciar em tudo que é decisão (lock de linha,
-- resultado que explica a recusa, reserva que expira), com uma diferença de
-- dados: o id do pagamento não está na compra. Ele é buscado no recebível pelo
-- LEFT JOIN abaixo, e pode voltar NULL — o que NÃO é motivo de recusa aqui.
--
-- POR QUE 'sem_pagamento' NÃO EXISTE NESTA FUNÇÃO
--   Na pedido_reembolso_iniciar, `mp_payment_id is null` é uma linha que ficou
--   pela metade e a reserva é recusada. Aqui é o caso NORMAL de toda venda
--   feita até 2026-09-08, e recusá-las seria recusar exatamente as vendas que
--   este trabalho existe para reembolsar. A reserva devolve
--   `gateway_payment_id` possivelmente nulo e o `receivable_id`, e a edge
--   function decide: com id, reembolsa; sem id, DESCOBRE pelo
--   external_reference e grava com a função da seção 4.
--
--   Sem recebível, porém, não há nem por onde descobrir — `sem_recebivel` é
--   recusa, e é a única que nasce aqui.
--
-- `valor_centavos` volta junto porque a edge function usa esse número para
-- CONFERIR o pagamento que encontrou no Mercado Pago. Reembolsar um pagamento
-- de valor diferente do que a compra cobrou é dinheiro na conta errada.

create or replace function public.scan_compra_reembolso_iniciar(
  p_compra_id uuid,
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
  v_atual      public.raiox_compras%rowtype;
  v_pagamento  text;
  v_retomada   boolean;
begin
  select * into v_atual
    from public.raiox_compras
   where id = p_compra_id
     for update;

  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;

  if v_atual.status = 'reembolsado' then
    return jsonb_build_object(
      'resultado',       'ja_reembolsado',
      'compra_id',       v_atual.id,
      'reembolso_mp_id', v_atual.reembolso_mp_id,
      'reembolsado_em',  v_atual.reembolsado_em,
      'receivable_id',   v_atual.receivable_id
    );
  end if;

  if v_atual.status <> 'pago' then
    return jsonb_build_object('resultado', 'status_invalido', 'status', v_atual.status);
  end if;

  if v_atual.receivable_id is null then
    -- Sem recebível não há external_reference, e sem external_reference não há
    -- como nem descobrir o pagamento. Erro próprio para a tela poder dizer que
    -- o estorno é manual, em vez de um 404 indecifrável do gateway.
    return jsonb_build_object('resultado', 'sem_recebivel');
  end if;

  if v_atual.reembolso_iniciado_em is not null
     and v_atual.reembolso_iniciado_em >= now() - p_retomar_apos then
    return jsonb_build_object(
      'resultado',             'em_andamento',
      'reembolso_iniciado_em', v_atual.reembolso_iniciado_em
    );
  end if;

  select r.gateway_payment_id into v_pagamento
    from public.receivables r
   where r.id = v_atual.receivable_id;

  -- Reserva anterior existia e venceu: esta chamada está RETOMANDO uma
  -- tentativa de desfecho desconhecido. A edge function loga o caso — é a
  -- pista de que o dinheiro pode já ter voltado.
  v_retomada := v_atual.reembolso_iniciado_em is not null;

  update public.raiox_compras
     set reembolso_iniciado_em = now(),
         -- coalesce e não sobrescrita: numa retomada, quem pediu primeiro
         -- continua sendo o autor. Quem retomou aparece no log da edge
         -- function; o registro da compra guarda quem decidiu.
         reembolso_por = coalesce(reembolso_por, p_usuario_id)
   where id = p_compra_id;

  return jsonb_build_object(
    'resultado',          'reservado',
    'compra_id',          v_atual.id,
    'receivable_id',      v_atual.receivable_id,
    -- Pode ser NULL. Ver o bloco acima: é o caso normal das vendas antigas.
    'gateway_payment_id', v_pagamento,
    'valor_centavos',     v_atual.valor_centavos,
    'plano_code',         v_atual.plano_code,
    'retomada',           v_retomada
  );
end;
$$;

comment on function public.scan_compra_reembolso_iniciar(uuid, uuid, interval) is
  'Reserva o reembolso de uma compra paga do Scan com lock de linha, antes de chamar o Mercado Pago, e devolve o gateway_payment_id do recebível (que pode ser NULL nas vendas antigas). Reserva parada há mais que p_retomar_apos é retomada. Só service role.';

-- ---------------------------------------------------------------------------
-- 4. scan_compra_reembolso_pagamento — gravar o id descoberto
-- ---------------------------------------------------------------------------
-- Fecha o buraco que deixou toda venda anterior sem como ser estornada. A edge
-- function encontra o pagamento no Mercado Pago pelo `external_reference` (=
-- id do recebível), confirma que ele é aprovado e do valor certo, e chama esta
-- função para o id passar a existir no banco.
--
-- ESCREVE SÓ QUANDO ESTÁ NULO, e isso é a regra da função. Um id já gravado é
-- autoritativo — veio da payment-webhook, no instante em que o MP confirmou
-- aquele pagamento específico. Sobrescrevê-lo com o resultado de uma BUSCA
-- (que é uma inferência, e pode trazer o pagamento errado quando há mais de um
-- na mesma referência) trocaria um fato por um palpite, justamente na coluna
-- que decide de qual pagamento o dinheiro sai.
--
-- Não mexe em `raiox_compras`: o id do pagamento é do recebível, e duplicá-lo
-- na compra criaria duas fontes de verdade que teriam de concordar para
-- sempre.

create or replace function public.scan_compra_reembolso_pagamento(
  p_receivable_id uuid,
  p_gateway_payment_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_atual    text;
  v_gravou   boolean := false;
begin
  if p_gateway_payment_id is null or btrim(p_gateway_payment_id) = '' then
    return jsonb_build_object('resultado', 'id_invalido');
  end if;

  update public.receivables
     set gateway_payment_id = p_gateway_payment_id
   where id = p_receivable_id
     and gateway_payment_id is null
  returning gateway_payment_id into v_atual;

  v_gravou := found;

  if not v_gravou then
    select gateway_payment_id into v_atual
      from public.receivables
     where id = p_receivable_id;
    if not found then
      return jsonb_build_object('resultado', 'nao_encontrado');
    end if;
  end if;

  return jsonb_build_object(
    -- 'gravado' = a coluna estava vazia e agora tem o id. 'ja_tinha' = havia um
    -- id; ele volta em `gateway_payment_id` e é ELE que manda, mesmo quando
    -- difere do que a busca encontrou.
    'resultado',          case when v_gravou then 'gravado' else 'ja_tinha' end,
    'gateway_payment_id', v_atual
  );
end;
$$;

comment on function public.scan_compra_reembolso_pagamento(uuid, text) is
  'Grava no recebível o id do pagamento no Mercado Pago descoberto por external_reference, e SÓ quando a coluna está nula — id já gravado veio do webhook e é autoritativo. Devolve o id que vale. Só service role.';

-- ---------------------------------------------------------------------------
-- 5. scan_compra_reembolso_concluir — o desfecho, num comando só
-- ---------------------------------------------------------------------------
-- Grava o rastro, vira o status para 'reembolsado' (que é o que REVOGA o
-- acesso do lado do worker) e tira o recebível da receita — a mesma decisão,
-- pelos mesmos motivos da pedido_reembolso_concluir.
--
-- `pago_em` é DELIBERADAMENTE preservado, e `reanalise_agendada_em` também: o
-- dinheiro entrou naquele dia e a reanálise foi mesmo agendada. Apagar
-- qualquer um dos dois não desfaz o que aconteceu, só apaga a metade da
-- história que permite conciliar. Quem decide não rodar a reanálise de uma
-- compra reembolsada é o worker, olhando o status — mesma regra do plano.
--
-- IDEMPOTÊNCIA: o UPDATE é condicionado a `status = 'pago'`, então a segunda
-- chamada não escreve nada e não é erro. Mas ela AINDA passa pelo cancelamento
-- do recebível, de propósito: se a primeira morreu entre virar a compra e
-- mexer no Financeiro, é a segunda que fecha a diferença. Convergir é o
-- objetivo; escrever exatamente uma vez, não.

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
    -- 'reembolsado' = esta chamada virou a compra. 'ja_reembolsado' = outra
    -- virou antes; para quem chamou, os dois são sucesso.
    'resultado',            case when v_escreveu then 'reembolsado' else 'ja_reembolsado' end,
    'compra_id',            v_compra.id,
    'reembolso_mp_id',      v_compra.reembolso_mp_id,
    'reembolsado_em',       v_compra.reembolsado_em,
    'plano_code',           v_compra.plano_code,
    'receivable_id',        v_receivable_id,
    'receivable_cancelado', v_cancelou
  );
end;
$$;

comment on function public.scan_compra_reembolso_concluir(uuid, text, integer) is
  'Fecha o reembolso da compra do Scan: status reembolsado (o que revoga o plano no worker), rastro do MP e recebível cancelado para sair da receita. Idempotente e convergente — a segunda chamada não reescreve a compra mas ainda acerta o Financeiro. Só service role.';

-- ---------------------------------------------------------------------------
-- 6. scan_compra_reembolso_liberar — desistir da reserva, e SÓ quando dá
-- ---------------------------------------------------------------------------
-- Existe para os casos em que se SABE que nada saiu: o Mercado Pago recusou de
-- forma definitiva e a consulta do pagamento confirmou que ele não está
-- reembolsado, ou a busca por external_reference não achou pagamento nenhum —
-- e aí não houve sequer chamada de estorno.
--
-- Fora desses casos a reserva não é liberada, e a distinção é a coisa mais
-- importante desta função: "o gateway recusou" e "não deu para saber" parecem
-- o mesmo erro na tela e são opostos aqui. Na dúvida a reserva fica e vence
-- sozinha; a retomada é segura porque a chave de idempotência é a mesma.

create or replace function public.scan_compra_reembolso_liberar(
  p_compra_id uuid
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
  update public.raiox_compras
     set reembolso_iniciado_em = null
   where id = p_compra_id
     and status = 'pago'
     and reembolsado_em is null
     and reembolso_iniciado_em is not null
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

comment on function public.scan_compra_reembolso_liberar(uuid) is
  'Solta a reserva de reembolso de uma compra do Scan que continua paga. Só deve ser chamada quando se CONFIRMOU que nada saiu do gateway — na dúvida a reserva fica e vence sozinha. Só service role.';

-- ---------------------------------------------------------------------------
-- 7. Superfície de RPC
-- ---------------------------------------------------------------------------
-- Funções de ESCRITA que mexem em dinheiro: fora do /rest/v1/rpc/ público,
-- igual às três da 20260908220000. Uma função nova nasce com EXECUTE para
-- PUBLIC; sem estes revokes, qualquer usuário autenticado do painel — e, com
-- `anon`, qualquer visitante — poderia reembolsar uma compra chamando a RPC
-- direto, contornando a checagem de permissão da edge function.

revoke execute on function public.scan_compra_reembolso_iniciar(uuid, uuid, interval)
  from public, anon, authenticated;
revoke execute on function public.scan_compra_reembolso_pagamento(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.scan_compra_reembolso_concluir(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.scan_compra_reembolso_liberar(uuid)
  from public, anon, authenticated;
