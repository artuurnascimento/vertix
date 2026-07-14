-- =============================================================================
-- Vertix Admin — Gestão de Tráfego (Meta Ads), parte 2: RPC pública do portal
-- get_portal_ads(p_token uuid) — localiza o cliente via projects.portal_token
-- (um cliente pode ter múltiplos projetos/tokens; qualquer token válido do
-- cliente dá acesso agregado às contas de anúncio dele — mesma semântica de
-- get_portal_files/create_ticket, que resolvem o projeto e não o cliente
-- diretamente). Agrega TODAS as contas ATIVAS do cliente.
-- =============================================================================

create or replace function public.get_portal_ads(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_mes_atual json;
  v_serie_30d json;
begin
  select p.client_id into v_client_id
  from public.projects p
  where p.portal_token = p_token;

  if not found then
    raise exception 'Portal não encontrado.';
  end if;

  -- Agregado do mês corrente (gasto, impressões, cliques, conversões,
  -- receita) somando todas as contas ATIVAS do cliente. Cliente sem conta
  -- ativa ou sem métricas ainda: coalesce garante zeros em vez de null.
  select json_build_object(
    'gasto', coalesce(sum(m.gasto), 0),
    'impressoes', coalesce(sum(m.impressoes), 0),
    'cliques', coalesce(sum(m.cliques), 0),
    'conversoes', coalesce(sum(m.conversoes), 0),
    'receita', coalesce(sum(m.receita), 0)
  )
  into v_mes_atual
  from public.ad_accounts a
  left join public.ad_metrics_daily m
    on m.ad_account_id = a.id
    and m.data >= date_trunc('month', current_date)::date
    and m.data <= current_date
  where a.client_id = v_client_id
    and a.status = 'ativo';

  -- Série diária dos últimos 30 dias (gasto, conversoes), agregando todas
  -- as contas ativas por dia. Sem métricas: array vazio (portal decide
  -- ocultar a seção).
  select coalesce(json_agg(
    json_build_object(
      'data', serie.data,
      'gasto', serie.gasto,
      'conversoes', serie.conversoes
    )
    order by serie.data
  ), '[]'::json)
  into v_serie_30d
  from (
    select
      m.data,
      sum(m.gasto) as gasto,
      sum(m.conversoes) as conversoes
    from public.ad_accounts a
    join public.ad_metrics_daily m on m.ad_account_id = a.id
    where a.client_id = v_client_id
      and a.status = 'ativo'
      and m.data >= current_date - interval '30 days'
      and m.data <= current_date
    group by m.data
  ) serie;

  return json_build_object(
    'mes_atual', v_mes_atual,
    'serie_30d', v_serie_30d
  );
end;
$$;

revoke execute on function public.get_portal_ads(uuid) from public;
grant execute on function public.get_portal_ads(uuid) to anon, authenticated;
