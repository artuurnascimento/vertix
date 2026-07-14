-- =============================================================================
-- Vertix Admin — Checklist automático pós-aceite de proposta
-- task_templates (RLS team CRUD) + trigger que popula project_tasks quando
-- uma proposta é aceita, a partir do tipo_servico do projeto. Idempotente:
-- pula tarefas cujo título já existe no projeto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  tipo_servico text not null
    check (tipo_servico in ('ecommerce', 'sistema', 'site')),
  titulo text not null,
  ordem int not null
);

create index idx_task_templates_tipo_servico on public.task_templates (tipo_servico);

alter table public.task_templates enable row level security;

create policy "team seleciona task_templates"
  on public.task_templates for select
  to authenticated
  using (public.is_team_member());

create policy "team insere task_templates"
  on public.task_templates for insert
  to authenticated
  with check (public.is_team_member());

create policy "team atualiza task_templates"
  on public.task_templates for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team exclui task_templates"
  on public.task_templates for delete
  to authenticated
  using (public.is_team_member());

-- -----------------------------------------------------------------------------
-- 2. Seed — tarefas padrão por tipo de serviço.
-- -----------------------------------------------------------------------------

insert into public.task_templates (tipo_servico, titulo, ordem)
values
  ('ecommerce', 'Configurar loja', 1),
  ('ecommerce', 'Cadastrar produtos', 2),
  ('ecommerce', 'Integrar pagamento', 3),
  ('ecommerce', 'Configurar frete', 4),
  ('ecommerce', 'Configurar domínio', 5),
  ('ecommerce', 'Revisão geral', 6),
  ('ecommerce', 'Go-live', 7),

  ('sistema', 'Setup do projeto', 1),
  ('sistema', 'Modelagem de dados', 2),
  ('sistema', 'Telas principais', 3),
  ('sistema', 'Permissões de acesso', 4),
  ('sistema', 'Homologação', 5),
  ('sistema', 'Deploy', 6),

  ('site', 'Estrutura de páginas', 1),
  ('site', 'Conteúdo', 2),
  ('site', 'SEO básico', 3),
  ('site', 'Formulários', 4),
  ('site', 'Revisão geral', 5),
  ('site', 'Publicação', 6);

-- -----------------------------------------------------------------------------
-- 3. Trigger — proposals AFTER UPDATE status → 'aceita': popula project_tasks
--    a partir de task_templates do tipo_servico do projeto. Idempotente: pula
--    tarefas cujo título já existe no projeto.
-- -----------------------------------------------------------------------------

create or replace function public.gerar_checklist_pos_aceite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_template record;
begin
  if new.status = 'aceita' and old.status is distinct from new.status then
    select * into v_project
    from public.projects
    where id = new.project_id;

    if found then
      for v_template in
        select titulo, ordem
        from public.task_templates
        where tipo_servico = v_project.tipo_servico
        order by ordem
      loop
        if not exists (
          select 1
          from public.project_tasks
          where project_id = v_project.id
            and titulo = v_template.titulo
        ) then
          insert into public.project_tasks (project_id, titulo, ordem, concluida)
          values (v_project.id, v_template.titulo, v_template.ordem, false);
        end if;
      end loop;
    end if;
  end if;

  return new;
end;
$$;

create trigger gerar_checklist_pos_aceite
  after update on public.proposals
  for each row
  execute function public.gerar_checklist_pos_aceite();
