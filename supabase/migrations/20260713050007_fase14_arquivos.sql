-- =============================================================================
-- Vertix Admin — Fase 14: Arquivos por projeto
-- project_files (metadados) + bucket 'project-files' + policies de storage
-- + RPC pública get_portal_files.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela de metadados
-- -----------------------------------------------------------------------------

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  nome text not null,
  tamanho bigint,
  tipo_mime text,
  storage_path text not null unique,
  uploaded_by uuid references public.profiles (id) on delete set null,
  visivel_cliente boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_project_files_project_id on public.project_files (project_id);

alter table public.project_files enable row level security;

create policy "team seleciona project_files"
  on public.project_files for select
  to authenticated
  using (public.is_team_member());

create policy "team insere project_files"
  on public.project_files for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza project_files"
  on public.project_files for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui project_files"
  on public.project_files for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. Bucket de Storage (privado)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 3. Helper SECURITY DEFINER para a policy de storage.objects.
--
--    IMPORTANTE: uma subquery direta em `public.project_files` dentro da
--    policy de storage.objects seria avaliada sob o RLS da própria
--    project_files para o role atual (anon) — que bloqueia tudo, pois anon
--    não tem policy de SELECT ali. Isso faz a policy de storage nunca
--    liberar nada mesmo com o arquivo marcado visivel_cliente = true.
--    A função abaixo roda com privilégios do definer (bypassa RLS de
--    project_files) e só devolve um boolean, então não vaza nenhuma coluna.
-- -----------------------------------------------------------------------------

create or replace function public.is_visible_client_file(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_files pf
    where pf.storage_path = p_storage_path
      and pf.visivel_cliente = true
  );
$$;

revoke execute on function public.is_visible_client_file(text) from public;
grant execute on function public.is_visible_client_file(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Policies em storage.objects para o bucket 'project-files'
-- -----------------------------------------------------------------------------

-- Time (autenticado, is_team_member): acesso total ao bucket.
create policy "team all project-files objects"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'project-files'
    and public.is_team_member()
  )
  with check (
    bucket_id = 'project-files'
    and public.is_team_member()
  );

-- Anon: SELECT (necessário para createSignedUrl/download público) somente
-- quando existir um project_files.storage_path correspondente marcado
-- visivel_cliente = true. Isso permite ao portal público baixar só os
-- arquivos liberados, sem expor o resto do bucket.
create policy "anon select visivel_cliente project-files objects"
  on storage.objects for select
  to anon
  using (
    bucket_id = 'project-files'
    and public.is_visible_client_file(storage.objects.name)
  );

-- -----------------------------------------------------------------------------
-- 5. RPC pública get_portal_files — metadados dos arquivos visíveis ao
--    cliente do projeto associado ao portal_token. O front público usa
--    storage_path retornado para chamar createSignedUrl (permitido pela
--    policy de anon acima).
-- -----------------------------------------------------------------------------

create or replace function public.get_portal_files(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(
    json_build_object(
      'id', pf.id,
      'nome', pf.nome,
      'tamanho', pf.tamanho,
      'tipo_mime', pf.tipo_mime,
      'storage_path', pf.storage_path
    )
    order by pf.created_at desc
  ), '[]'::json)
  from public.project_files pf
  join public.projects p on p.id = pf.project_id
  where p.portal_token = p_token
    and pf.visivel_cliente = true;
$$;

revoke execute on function public.get_portal_files(uuid) from public;
grant execute on function public.get_portal_files(uuid) to anon, authenticated;
