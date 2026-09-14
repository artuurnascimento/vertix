-- ============================================================================
-- logs_sistema — a trilha única de erros e eventos do sistema inteiro
-- ============================================================================
-- Até aqui cada pedaço falava sozinho: o navegador só tinha o console de
-- quem estava na frente da tela, as edge functions gravavam console.error no
-- painel da Supabase (retenção curta, ninguém abre), o worker do Scan
-- escrevia no log do Fly, o banco engolia exceções com `raise warning`. Na
-- hora de entender "por que o pagamento do fulano falhou às 14h", cada fonte
-- exigia outro lugar, outro login, outra retenção.
--
-- Aqui tudo cai numa tabela só, com o mesmo formato e o mesmo contexto:
--
--   nivel     debug | info | aviso | erro | fatal
--   origem    navegador | vercel | edge | worker | banco
--   fonte     quem gravou (página, function, rotina, RPC)
--   evento    código curto e estável — é por ele que se agrupa e se filtra
--   mensagem  o texto humano
--   detalhes  stack, status HTTP, resposta, o que for preciso para reproduzir
--   contexto  rota, host, versão do build, aparelho, usuário, checkout...
--   requisicao_id  a MESMA requisição vista pelo navegador, pela edge e pelo
--                  worker (o navegador gera, os outros repetem)
--   sessao_id      a visita do "Ao vivo" quando o erro é no checkout
--
-- Repetição: a mesma falha (impressão = fonte + evento + mensagem
-- normalizada) dentro de 10 minutos NÃO vira linha nova — soma em
-- `ocorrencias` e atualiza `ultima_em`. Um laço que falha 400 vezes é uma
-- linha com "400×", não 400 linhas.
--
-- Quem escreve:
--   · navegador e funções da Vercel → RPC registrar_log (anon; valida e
--     poda tudo; nunca lança);
--   · edge functions e worker → insert direto com service role;
--   · o banco → log_interno(), de dentro de outras funções e do cron.
--
-- Quem lê: a equipe, pela página Logs do painel (RLS + Realtime).
-- ============================================================================

create table public.logs_sistema (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  ocorrencias integer not null default 1,
  nivel text not null
    check (nivel in ('debug', 'info', 'aviso', 'erro', 'fatal')),
  origem text not null
    check (origem in ('navegador', 'vercel', 'edge', 'worker', 'banco')),
  fonte text not null,
  evento text not null,
  mensagem text not null,
  detalhes jsonb not null default '{}'::jsonb,
  contexto jsonb not null default '{}'::jsonb,
  requisicao_id text,
  sessao_id uuid,
  usuario_id uuid,
  versao text,
  -- Hash de fonte + evento + mensagem normalizada: a chave da repetição.
  impressao text not null
);

comment on table public.logs_sistema is
  'Trilha única de erros e eventos: navegador, funções da Vercel, edge functions, worker do Scan e o próprio banco. Repetições somam em ocorrencias. Lida pela página Logs do painel.';

create index logs_sistema_ultima_em_idx on public.logs_sistema (ultima_em desc);
create index logs_sistema_nivel_idx on public.logs_sistema (nivel, ultima_em desc);
create index logs_sistema_fonte_idx on public.logs_sistema (fonte, ultima_em desc);
create index logs_sistema_impressao_idx on public.logs_sistema (impressao, ultima_em desc);
create index logs_sistema_requisicao_idx on public.logs_sistema (requisicao_id)
  where requisicao_id is not null;
create index logs_sistema_sessao_idx on public.logs_sistema (sessao_id)
  where sessao_id is not null;

alter table public.logs_sistema enable row level security;

create policy "equipe le logs_sistema"
  on public.logs_sistema for select
  to authenticated
  using (public.is_team_member());

-- Sem policy de insert/update/delete: quem escreve é a RPC (security
-- definer), a service role (edge/worker) e o cron. O navegador nunca toca a
-- tabela direto.

-- ----------------------------------------------------------------------------
-- Realtime: a página Logs vê a linha nascer.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'logs_sistema'
    ) then
      alter publication supabase_realtime add table public.logs_sistema;
    end if;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Impressão digital: números, uuids, hashes e datas viram '#' antes do hash,
-- para "Falha ao buscar pedido 123" e "... 456" contarem como a mesma falha.
-- ----------------------------------------------------------------------------
create or replace function public._logs_impressao(
  p_fonte text,
  p_evento text,
  p_mensagem text
)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(
    convert_to(
      coalesce(p_fonte, '') || '|' || coalesce(p_evento, '') || '|' ||
      regexp_replace(
        regexp_replace(lower(coalesce(p_mensagem, '')), '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '#', 'g'),
        '[0-9]+', '#', 'g'
      ),
      'UTF8'
    ),
    'sha256'
  ), 'hex');
$$;

-- ----------------------------------------------------------------------------
-- Poda: nada sensível entra no log, venha de onde vier. Chaves com esses
-- nomes são trocadas por '[oculto]' em qualquer profundidade do JSON.
-- ----------------------------------------------------------------------------
create or replace function public._logs_podar(p_valor jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_chave text;
  v_resultado jsonb;
  v_item jsonb;
begin
  if p_valor is null then return '{}'::jsonb; end if;
  case jsonb_typeof(p_valor)
    when 'object' then
      v_resultado := '{}'::jsonb;
      for v_chave in select jsonb_object_keys(p_valor) loop
        if v_chave ~* '(senha|password|secret|token|authorization|apikey|api_key|cvv|cvc|card_number|numero_cartao|documento|cpf|cnpj|cookie|service_role)' then
          v_resultado := v_resultado || jsonb_build_object(v_chave, '[oculto]');
        else
          v_resultado := v_resultado || jsonb_build_object(v_chave, public._logs_podar(p_valor -> v_chave));
        end if;
      end loop;
      return v_resultado;
    when 'array' then
      v_resultado := '[]'::jsonb;
      for v_item in select * from jsonb_array_elements(p_valor) limit 50 loop
        v_resultado := v_resultado || jsonb_build_array(public._logs_podar(v_item));
      end loop;
      return v_resultado;
    when 'string' then
      -- Strings enormes (respostas HTML inteiras) ficam no começo.
      return to_jsonb(left(p_valor #>> '{}', 4000));
    else
      return p_valor;
  end case;
end;
$$;

-- ----------------------------------------------------------------------------
-- O gravador de verdade: ou cria a linha, ou soma na repetição recente.
-- Interno — todo caminho de escrita passa por aqui.
-- ----------------------------------------------------------------------------
create or replace function public._logs_gravar(
  p_nivel text,
  p_origem text,
  p_fonte text,
  p_evento text,
  p_mensagem text,
  p_detalhes jsonb,
  p_contexto jsonb,
  p_requisicao_id text,
  p_sessao_id uuid,
  p_usuario_id uuid,
  p_versao text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_impressao text;
  v_id bigint;
  v_mensagem text := left(coalesce(nullif(trim(p_mensagem), ''), '(sem mensagem)'), 2000);
  v_fonte text := left(coalesce(nullif(trim(p_fonte), ''), 'desconhecida'), 120);
  v_evento text := left(coalesce(nullif(trim(p_evento), ''), 'evento'), 120);
begin
  v_impressao := public._logs_impressao(v_fonte, v_evento, v_mensagem);

  -- Repetição recente do mesmo nível: soma e traz o contexto mais novo —
  -- desde que ele exista; uma repetição sem detalhes não apaga os da primeira.
  update public.logs_sistema
     set ocorrencias = ocorrencias + 1,
         ultima_em = now(),
         detalhes = case when coalesce(p_detalhes, '{}'::jsonb) = '{}'::jsonb
                         then detalhes else public._logs_podar(p_detalhes) end,
         contexto = case when coalesce(p_contexto, '{}'::jsonb) = '{}'::jsonb
                         then contexto else public._logs_podar(p_contexto) end,
         requisicao_id = coalesce(left(p_requisicao_id, 80), requisicao_id),
         sessao_id = coalesce(p_sessao_id, sessao_id),
         usuario_id = coalesce(p_usuario_id, usuario_id),
         versao = coalesce(left(p_versao, 40), versao)
   where id = (
     select id from public.logs_sistema
      where impressao = v_impressao
        and nivel = p_nivel
        and ultima_em > now() - interval '10 minutes'
      order by ultima_em desc
      limit 1
   )
  returning id into v_id;
  if v_id is not null then return v_id; end if;

  insert into public.logs_sistema
      (nivel, origem, fonte, evento, mensagem, detalhes, contexto,
       requisicao_id, sessao_id, usuario_id, versao, impressao)
    values
      (p_nivel, p_origem, v_fonte, v_evento, v_mensagem,
       public._logs_podar(coalesce(p_detalhes, '{}'::jsonb)),
       public._logs_podar(coalesce(p_contexto, '{}'::jsonb)),
       left(p_requisicao_id, 80), p_sessao_id, p_usuario_id, left(p_versao, 40),
       v_impressao)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public._logs_gravar(text, text, text, text, text, jsonb, jsonb, text, uuid, uuid, text)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- log_interno — para o próprio banco: outras funções SQL, triggers e cron.
-- Nunca lança: um log que falha não pode derrubar quem chamou.
-- ----------------------------------------------------------------------------
create or replace function public.log_interno(
  p_nivel text,
  p_fonte text,
  p_evento text,
  p_mensagem text,
  p_detalhes jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._logs_gravar(
    case when p_nivel in ('debug', 'info', 'aviso', 'erro', 'fatal') then p_nivel else 'erro' end,
    'banco', p_fonte, p_evento, p_mensagem, p_detalhes, '{}'::jsonb,
    null, null, null, null
  );
exception
  when others then
    raise warning 'log_interno(%, %): %', p_fonte, p_evento, sqlerrm;
end;
$$;

revoke all on function public.log_interno(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_interno(text, text, text, text, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- registrar_log — a porta do navegador e das funções da Vercel.
--
-- Recebe um LOTE (o navegador junta o que aconteceu e manda de uma vez, com
-- keepalive na saída da página). Valida cada entrada, poda, limita, e o que
-- não passa é descartado em silêncio: quem chama não tem o que fazer com um
-- erro do log. `usuario_id` vem de auth.uid(), nunca do corpo.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_log(p_entradas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrada jsonb;
  v_nivel text;
  v_origem text;
  v_sessao uuid;
  v_n integer := 0;
  v_usuario uuid := auth.uid();
begin
  if p_entradas is null or jsonb_typeof(p_entradas) <> 'array' then
    return;
  end if;

  for v_entrada in select * from jsonb_array_elements(p_entradas) loop
    v_n := v_n + 1;
    -- Teto por lote: uma página que gera 500 erros por segundo não vira 500
    -- linhas por chamada; as repetições já somam na impressão.
    exit when v_n > 25;
    continue when jsonb_typeof(v_entrada) <> 'object';

    v_nivel := v_entrada ->> 'nivel';
    -- De fora não entra debug: é ruído que só o painel da equipe geraria.
    continue when v_nivel is null or v_nivel not in ('info', 'aviso', 'erro', 'fatal');

    v_origem := case when v_entrada ->> 'origem' = 'vercel' then 'vercel' else 'navegador' end;
    v_sessao := case
      when (v_entrada ->> 'sessao_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_entrada ->> 'sessao_id')::uuid
    end;

    begin
      perform public._logs_gravar(
        v_nivel, v_origem,
        v_entrada ->> 'fonte',
        v_entrada ->> 'evento',
        v_entrada ->> 'mensagem',
        case when jsonb_typeof(v_entrada -> 'detalhes') = 'object' then v_entrada -> 'detalhes' else '{}'::jsonb end,
        case when jsonb_typeof(v_entrada -> 'contexto') = 'object' then v_entrada -> 'contexto' else '{}'::jsonb end,
        v_entrada ->> 'requisicao_id',
        v_sessao,
        v_usuario,
        v_entrada ->> 'versao'
      );
    exception
      when others then
        raise warning 'registrar_log: %', sqlerrm;
    end;
  end loop;
exception
  when others then
    raise warning 'registrar_log (lote): %', sqlerrm;
    return;
end;
$$;

comment on function public.registrar_log(jsonb) is
  'Grava um lote de entradas de log vindas do navegador ou das funções da Vercel. Valida, poda dados sensíveis, limita a 25 por lote e nunca lança.';

revoke all on function public.registrar_log(jsonb) from public;
grant execute on function public.registrar_log(jsonb) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- registrar_log_servico — a porta das edge functions e do worker (service
-- role). Mesmo formato de lote; aqui entram todos os níveis e a origem vem
-- de quem grava (edge/worker). Nunca lança.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_log_servico(p_entradas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrada jsonb;
  v_nivel text;
  v_origem text;
  v_sessao uuid;
  v_usuario uuid;
  v_n integer := 0;
begin
  if p_entradas is null or jsonb_typeof(p_entradas) <> 'array' then
    return;
  end if;

  for v_entrada in select * from jsonb_array_elements(p_entradas) loop
    v_n := v_n + 1;
    exit when v_n > 50;
    continue when jsonb_typeof(v_entrada) <> 'object';

    v_nivel := v_entrada ->> 'nivel';
    continue when v_nivel is null or v_nivel not in ('debug', 'info', 'aviso', 'erro', 'fatal');

    v_origem := case when v_entrada ->> 'origem' in ('edge', 'worker', 'banco', 'vercel')
                     then v_entrada ->> 'origem' else 'edge' end;
    v_sessao := case
      when (v_entrada ->> 'sessao_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_entrada ->> 'sessao_id')::uuid
    end;
    v_usuario := case
      when (v_entrada ->> 'usuario_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_entrada ->> 'usuario_id')::uuid
    end;

    begin
      perform public._logs_gravar(
        v_nivel, v_origem,
        v_entrada ->> 'fonte',
        v_entrada ->> 'evento',
        v_entrada ->> 'mensagem',
        case when jsonb_typeof(v_entrada -> 'detalhes') = 'object' then v_entrada -> 'detalhes' else '{}'::jsonb end,
        case when jsonb_typeof(v_entrada -> 'contexto') = 'object' then v_entrada -> 'contexto' else '{}'::jsonb end,
        v_entrada ->> 'requisicao_id',
        v_sessao,
        v_usuario,
        v_entrada ->> 'versao'
      );
    exception
      when others then
        raise warning 'registrar_log_servico: %', sqlerrm;
    end;
  end loop;
exception
  when others then
    raise warning 'registrar_log_servico (lote): %', sqlerrm;
    return;
end;
$$;

revoke all on function public.registrar_log_servico(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_log_servico(jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- Erro fatal vira notificação no sino do painel — uma por fonte por hora.
-- ----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_tipo_check;
alter table public.notifications add constraint notifications_tipo_check
  check (tipo in ('lead', 'briefing', 'proposta', 'pagamento', 'ticket', 'nps', 'sistema'));

create or replace function public._logs_notificar_fatal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nivel <> 'fatal' then return new; end if;
  if exists (
    select 1 from public.notifications
     where tipo = 'sistema'
       and link = '/admin/logs?fonte=' || new.fonte
       and created_at > now() - interval '1 hour'
  ) then
    return new;
  end if;
  insert into public.notifications (tipo, titulo, descricao, link)
    values ('sistema',
            'Erro fatal em ' || new.fonte,
            left(new.mensagem, 160),
            '/admin/logs?fonte=' || new.fonte);
  return new;
exception
  when others then
    return new;
end;
$$;

create trigger logs_sistema_notificar_fatal
  after insert on public.logs_sistema
  for each row execute function public._logs_notificar_fatal();

-- ----------------------------------------------------------------------------
-- O banco também se vigia: falhas do pg_cron entram na trilha.
-- ----------------------------------------------------------------------------
create or replace function public._cron_logs_coletar_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select d.runid, d.jobid, j.jobname, d.status, d.return_message, d.start_time, d.end_time
      from cron.job_run_details d
      join cron.job j on j.jobid = d.jobid
     where d.status = 'failed'
       and d.end_time > now() - interval '20 minutes'
  loop
    perform public._logs_gravar(
      'erro', 'banco', 'cron:' || r.jobname, 'cron_falhou',
      coalesce(r.return_message, 'falhou sem mensagem'),
      jsonb_build_object('runid', r.runid, 'inicio', r.start_time, 'fim', r.end_time),
      '{}'::jsonb, 'cron-' || r.runid::text, null, null, null
    );
  end loop;
exception
  when others then
    raise warning '_cron_logs_coletar_cron: %', sqlerrm;
end;
$$;

revoke execute on function public._cron_logs_coletar_cron() from public, anon, authenticated;

select cron.schedule(
  'vertix-logs-coletar-cron',
  '*/10 * * * *',
  $$select public._cron_logs_coletar_cron();$$
);

-- ----------------------------------------------------------------------------
-- Retenção: info/debug 30 dias, aviso 60, erro/fatal 180.
-- ----------------------------------------------------------------------------
create or replace function public._cron_logs_limpar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.logs_sistema
   where (nivel in ('debug', 'info') and ultima_em < now() - interval '30 days')
      or (nivel = 'aviso' and ultima_em < now() - interval '60 days')
      or (nivel in ('erro', 'fatal') and ultima_em < now() - interval '180 days');
$$;

revoke execute on function public._cron_logs_limpar() from public, anon, authenticated;

select cron.schedule(
  'vertix-logs-limpar',
  '45 6 * * *',                      -- diário 03:45 BRT
  $$select public._cron_logs_limpar();$$
);

-- ----------------------------------------------------------------------------
-- O primeiro cliente interno: checkout_rastrear parava de engolir o erro em
-- silêncio. Mesmo corpo, só o bloco `exception` muda — o `raise warning`
-- ficava no log do Postgres, onde ninguém olha; agora vai para a trilha.
-- ----------------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.checkout_rastrear(uuid, text, text, jsonb)'::regprocedure)
    into v_def;
  v_def := replace(
    v_def,
    $r$    raise warning 'checkout_rastrear(%, %): %', p_sessao, p_tipo, sqlerrm;$r$,
    $r$    perform public.log_interno('erro', 'rpc:checkout_rastrear', 'excecao', sqlerrm,
      jsonb_build_object('sessao', p_sessao, 'slug', p_slug, 'tipo', p_tipo, 'sqlstate', sqlstate));$r$
  );
  if position('log_interno' in v_def) = 0 then
    raise exception 'checkout_rastrear: bloco exception não encontrado para trocar';
  end if;
  execute v_def;
end $$;

-- Marco na própria trilha: dá para ver na página Logs que a migração rodou.
select public.log_interno('info', 'migracao', 'logs_sistema_criada',
  'Trilha única de logs criada (tabela, RPCs, cron e notificação de fatal).');
