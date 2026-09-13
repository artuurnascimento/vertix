-- ---------------------------------------------------------------------------
-- Jornada única — fase 6: estimado × realizado, antes/depois e capacidade
-- ---------------------------------------------------------------------------
-- 1. `projects.horas_estimadas`: sem esforço estimado não há "estimado ×
--    realizado", e a margem da Correção Aplicada era chute. Uma coluna; o
--    card de horas do projeto compara com a soma de time_entries.
--
-- 2. `capacidade_semanal_horas` em settings: quantas horas por semana cada
--    pessoa da equipe tem para executar. Com uma pessoa é 40; o card "Carga
--    por pessoa" divide o que falta pelo que cabe na semana.
--
-- 3. `get_portal_antes_depois(token)`: para o portal do cliente. Compara a
--    análise original do Scan (a do lead ligado ao cliente) com a medição
--    mais recente — reanálise de 30 dias (raiox_compras) ou medição do
--    Acompanhamento (pedido_medicoes) — por regra: o que foi resolvido, o que
--    segue aberto, o que apareceu. Mede a loja; não atribui vendas — o texto
--    do portal diz isso. null quando ainda não há um "depois".
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists horas_estimadas numeric(7,1) check (horas_estimadas is null or horas_estimadas >= 0);
comment on column public.projects.horas_estimadas is
  'Esforço combinado para o projeto, em horas. Comparado com a soma de time_entries no card de horas.';

insert into public.settings (chave, valor)
values ('capacidade_semanal_horas', '40')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------

create or replace function public.get_portal_antes_depois(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_antes record;
  v_depois record;
  v_resolvidos json;
  v_novos json;
  v_abertos integer;
begin
  select p.client_id into v_client_id
    from public.projects p
   where p.portal_token = p_token;
  if not found then
    raise exception 'Portal não encontrado.';
  end if;

  -- A análise original: a do lead mais recente do cliente que tem análise profunda.
  select a.id, a.domain, a.score, a.created_at,
         (a.light_result->'pagespeed'->>'lcp_s')::numeric as lcp_s,
         coalesce(a.deep_result->'problems', '[]'::jsonb) as problems
    into v_antes
    from public.leads l
    join public.analyses a on a.id = l.analysis_id
   where l.client_id = v_client_id
     and a.deep_result is not null
   order by l.created_at desc
   limit 1;
  if not found then
    return null;
  end if;

  -- O "depois": a medição ou reanálise mais recente que já tem nota.
  select a.id, a.score, a.created_at,
         (a.light_result->'pagespeed'->>'lcp_s')::numeric as lcp_s,
         coalesce(a.deep_result->'problems', a.light_result->'free_problems', '[]'::jsonb) as problems
    into v_depois
    from (
      select m.analysis_id
        from public.pedido_medicoes m
        join public.pedidos p on p.id = m.pedido_id
       where p.client_id = v_client_id and m.analysis_id is not null and m.email_enviado_em is not null
      union all
      select c.reanalise_analysis_id
        from public.raiox_compras c
       where c.client_id = v_client_id and c.reanalise_analysis_id is not null
    ) fontes
    join public.analyses a on a.id = fontes.analysis_id
   where a.score is not null and a.id <> v_antes.id
   order by a.created_at desc
   limit 1;
  if not found then
    return null;
  end if;

  -- Regra resolvida: estava na original e não está na medição. Problemas sem
  -- regra (visuais) comparam pelo título.
  select coalesce(json_agg(p->>'title' order by p->>'title'), '[]'::json)
    into v_resolvidos
    from jsonb_array_elements(v_antes.problems) p
   where not exists (
     select 1 from jsonb_array_elements(v_depois.problems) q
      where coalesce(q->>'regra', q->>'title') = coalesce(p->>'regra', p->>'title')
   );

  select coalesce(json_agg(q->>'title' order by q->>'title'), '[]'::json)
    into v_novos
    from jsonb_array_elements(v_depois.problems) q
   where not exists (
     select 1 from jsonb_array_elements(v_antes.problems) p
      where coalesce(q->>'regra', q->>'title') = coalesce(p->>'regra', p->>'title')
   );

  select count(*) into v_abertos
    from jsonb_array_elements(v_antes.problems) p
   where exists (
     select 1 from jsonb_array_elements(v_depois.problems) q
      where coalesce(q->>'regra', q->>'title') = coalesce(p->>'regra', p->>'title')
   );

  return json_build_object(
    'dominio', v_antes.domain,
    'antes', json_build_object('nota', v_antes.score, 'lcp_s', v_antes.lcp_s, 'medido_em', v_antes.created_at),
    'depois', json_build_object('nota', v_depois.score, 'lcp_s', v_depois.lcp_s, 'medido_em', v_depois.created_at),
    'resolvidos', v_resolvidos,
    'novos', v_novos,
    'abertos', v_abertos
  );
end;
$$;

comment on function public.get_portal_antes_depois(uuid) is
  'Portal do cliente: nota, LCP e problemas por regra da análise original do Scan contra a medição/reanálise mais recente. null sem "depois".';

grant execute on function public.get_portal_antes_depois(uuid) to anon, authenticated;
