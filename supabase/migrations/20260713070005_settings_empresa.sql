-- =============================================================================
-- Vertix Admin — Seed de dados da empresa em settings
-- RLS de public.settings já existe (fase17_horas): team select, admin
-- insert/update. Nenhuma policy nova necessária — apenas o seed abaixo.
-- =============================================================================

insert into public.settings (chave, valor) values
  ('empresa_nome', 'Vertix'),
  ('empresa_cnpj', ''),
  ('empresa_endereco', ''),
  ('empresa_email', ''),
  ('empresa_telefone', ''),
  ('empresa_site', 'https://vertix.com.br')
on conflict (chave) do update
  set valor = excluded.valor;
