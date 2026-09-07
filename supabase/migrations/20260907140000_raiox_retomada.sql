-- Vertix Scan: retomada de análises presas e reprocessamento manual.
--
-- Chamada por: worker/src/server.ts (varredura de pendentes, lê status,
-- updated_at e deep_attempts) e por src/pages/VertixScan.tsx no painel
-- (botão "Reprocessar", via supabase.rpc('raiox_reprocessar_analise')).
--
-- Não existe função equivalente: as migrations anteriores do Raio-X só criam
-- as tabelas, o token do relatório, a exclusão e o reset.
--
-- Colunas tocadas em public.analyses:
--   updated_at    timestamptz, atualizado por trigger a cada UPDATE
--   deep_attempts integer, quantas vezes a profunda já foi tentada
--
-- A fila do worker vive em memória: se a máquina reinicia, as análises
-- profundas que estavam esperando ficam paradas em 'queued_deep' e o lead
-- nunca recebe o relatório. Com esses dois campos o worker varre o banco no
-- boot (e a cada minuto) e retoma o que ficou para trás, sem repetir para
-- sempre o que falha de novo.

alter table public.analyses
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deep_attempts integer not null default 0;

create or replace function public.raiox_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists analyses_touch_updated_at on public.analyses;
create trigger analyses_touch_updated_at
  before update on public.analyses
  for each row execute function public.raiox_touch_updated_at();

-- Busca do worker: pendentes de análise profunda, mais antigas primeiro.
create index if not exists analyses_pendentes_idx
  on public.analyses (status, updated_at)
  where status in ('queued_deep', 'deep_running');

/**
 * Reprocessa a análise profunda de um lead: devolve a análise para a fila.
 * O worker retoma na próxima varredura. Só a equipe chama.
 */
create or replace function public.raiox_reprocessar_analise(p_analysis_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_team_member() then
    raise exception 'apenas a equipe pode reprocessar análises'
      using errcode = '42501';
  end if;

  select status into v_status from public.analyses where id = p_analysis_id;
  if v_status is null then
    return false;
  end if;
  -- Já concluída ou já esperando: nada a fazer.
  if v_status in ('deep_done', 'queued_deep', 'deep_running') then
    return false;
  end if;

  update public.analyses
     set status = 'queued_deep',
         error = null,
         deep_attempts = 0
   where id = p_analysis_id;
  return true;
end;
$$;

revoke all on function public.raiox_reprocessar_analise(uuid) from public, anon;
grant execute on function public.raiox_reprocessar_analise(uuid) to authenticated;
