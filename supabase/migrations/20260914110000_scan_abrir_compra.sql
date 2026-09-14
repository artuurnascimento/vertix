-- ============================================================================
-- scan_abrir_compra — abrir a compra do Plano de Correção em UMA ida ao banco
-- ============================================================================
-- Até aqui a edge function scan-comprar (sa-east-1) fazia cinco ou seis
-- chamadas PostgREST em série ao Postgres (us-east-1) para abrir uma compra:
-- consultar compra viva, buscar/criar cliente, criar projeto, criar recebível,
-- criar a compra — e desfazia na mão o que já tinha criado se algo falhasse.
-- Cada ida custa 150–200 ms de distância; a pessoa que clicou em "comprar"
-- esperava ~1 s só nisso antes de o checkout começar a abrir.
--
-- Esta função faz tudo isso numa transação só, com a mesma lógica, na mesma
-- ordem e com os mesmos campos que a edge function gravava. Falhou no meio?
-- Nada fica pela metade — é o Postgres quem desfaz.
--
-- Só a service role executa: é o mesmo poder que a edge function já tinha.
-- ============================================================================

create or replace function public.scan_abrir_compra(
  p_analysis_id uuid,
  p_lead_id uuid,
  p_nome text,
  p_email text,
  p_whatsapp text,
  p_dominio text,
  p_valor_centavos integer,
  -- Começo da URL do checkout, sem o token: a função cola o payment_token
  -- no fim para o `payment_link` nascer preenchido junto com o recebível.
  p_link_prefixo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existente record;
  v_client_id uuid;
  v_project_id uuid;
  v_receivable_id uuid;
  v_token uuid := gen_random_uuid();
  v_compra_id uuid;
  v_plano_code text;
begin
  if p_analysis_id is null or p_lead_id is null or v_email = '' then
    raise exception 'scan_abrir_compra: analysis_id, lead_id e email são obrigatórios'
      using errcode = '22023';
  end if;

  -- 1. Idempotência: a compra VIVA deste lead — ou, na mesma análise, a de um
  --    cliente com o mesmo e-mail (a mesma pessoa que passou pelo portão duas
  --    vezes). Mesmo filtro do índice parcial raiox_compras_lead_ativa_key.
  select c.id, c.receivable_id, c.plano_code, r.payment_token
    into v_existente
    from public.raiox_compras c
    left join public.clients cl on cl.id = c.client_id
    left join public.receivables r on r.id = c.receivable_id
   where c.analysis_id = p_analysis_id
     and c.status in ('aguardando_pagamento', 'pago')
     and (c.lead_id = p_lead_id or lower(trim(coalesce(cl.email, ''))) = v_email)
   order by (c.lead_id = p_lead_id) desc, c.created_at desc
   limit 1;
  if found then
    return jsonb_build_object(
      'compra_id', v_existente.id,
      'receivable_id', v_existente.receivable_id,
      'plano_code', v_existente.plano_code,
      'payment_token', v_existente.payment_token,
      'existente', true
    );
  end if;

  -- 2. Cliente — reaproveita por e-mail exato em minúsculas, senão cria.
  select id into v_client_id from public.clients where email = v_email limit 1;
  if v_client_id is null then
    insert into public.clients (nome, email, telefone, origem)
      values (coalesce(nullif(trim(p_nome), ''), v_email), v_email, nullif(trim(p_whatsapp), ''), 'scan')
      returning id into v_client_id;
  end if;

  -- 3. Projeto.
  insert into public.projects (client_id, nome, tipo_servico, origem)
    values (v_client_id, 'Plano de Correção — ' || coalesce(p_dominio, ''), 'ecommerce', 'scan')
    returning id into v_project_id;

  -- 4. Recebível — vence hoje, pendente até o webhook confirmar; nasce com o
  --    link do checkout já preenchido.
  insert into public.receivables
      (project_id, client_id, descricao, valor, vencimento, status, origem, payment_token, payment_link)
    values
      (v_project_id, v_client_id, 'Plano de Correção — ' || coalesce(p_dominio, ''),
       (p_valor_centavos::numeric / 100), current_date, 'pendente', 'scan',
       v_token, p_link_prefixo || v_token::text)
    returning id into v_receivable_id;

  -- 5. A compra, amarrando tudo. plano_code: 12 chars de base64url (os
  --    primeiros 12 dos 16 bytes aleatórios de um uuid = 9 bytes de entropia),
  --    o mesmo formato do gerarPlanoCode() da edge function — sem depender
  --    do pgcrypto.
  v_plano_code := substring(
    translate(encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/', '-_'),
    1, 12
  );
  begin
    insert into public.raiox_compras
        (analysis_id, lead_id, client_id, project_id, receivable_id, valor_centavos, status, plano_code)
      values
        (p_analysis_id, p_lead_id, v_client_id, v_project_id, v_receivable_id,
         p_valor_centavos, 'aguardando_pagamento', v_plano_code)
      returning id into v_compra_id;
  exception
    when unique_violation then
      -- Outra requisição do MESMO lead ganhou a corrida (índice parcial por
      -- lead). O bloco desfaz o que este ramo inseriu; devolve a vencedora.
      select c.id, c.receivable_id, c.plano_code, r.payment_token
        into v_existente
        from public.raiox_compras c
        left join public.receivables r on r.id = c.receivable_id
       where c.lead_id = p_lead_id
         and c.status in ('aguardando_pagamento', 'pago')
       order by c.created_at desc
       limit 1;
      if not found then
        raise;
      end if;
      return jsonb_build_object(
        'compra_id', v_existente.id,
        'receivable_id', v_existente.receivable_id,
        'plano_code', v_existente.plano_code,
        'payment_token', v_existente.payment_token,
        'existente', true
      );
  end;

  return jsonb_build_object(
    'compra_id', v_compra_id,
    'receivable_id', v_receivable_id,
    'plano_code', v_plano_code,
    'payment_token', v_token,
    'existente', false
  );
end;
$$;

comment on function public.scan_abrir_compra(uuid, uuid, text, text, text, text, integer, text) is
  'Abre a compra do Plano de Correção (cliente, projeto, recebível e compra) numa transação só. Idempotente por lead / e-mail na análise. Só service role.';

revoke all on function public.scan_abrir_compra(uuid, uuid, text, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.scan_abrir_compra(uuid, uuid, text, text, text, text, integer, text)
  to service_role;
