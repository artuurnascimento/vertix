-- ---------------------------------------------------------------------------
-- Montar proposta a partir do diagnóstico — esforço padrão por regra
-- ---------------------------------------------------------------------------
-- O Scan aponta os problemas da loja (analyses.deep_result.problems) e cada
-- problema medido carrega o id da regra que o achou (worker, lib/rules.ts).
-- Para virar proposta, cada regra precisa de um preço de partida: horas
-- padrão × valor_hora (settings). Esta tabela guarda as horas; a equipe
-- ajusta em Configurações e o formulário de proposta monta os itens já
-- preenchidos — a pessoa só revisa.
--
-- Problemas sem regra (visuais, apontados pelo modelo, e análises anteriores
-- ao id de regra) caem nos três fallbacks por impacto (`impacto_*`).
-- ---------------------------------------------------------------------------

create table public.esforco_por_regra (
  regra text primary key,
  titulo text not null,
  horas numeric(5,1) not null check (horas >= 0),
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.esforco_por_regra is
  'Horas padrão que a Vertix leva para corrigir cada regra do Scan. Base dos itens da proposta montada a partir do diagnóstico (quantidade = horas, valor unitário = valor_hora).';
comment on column public.esforco_por_regra.ativo is
  'false = a regra não entra na proposta automática (ex.: o que o lojista resolve sozinho).';

alter table public.esforco_por_regra enable row level security;

create policy "team seleciona esforco_por_regra"
  on public.esforco_por_regra for select
  to authenticated
  using (public.is_team_member());

create policy "admin insere esforco_por_regra"
  on public.esforco_por_regra for insert
  to authenticated
  with check (public.is_admin());

create policy "admin atualiza esforco_por_regra"
  on public.esforco_por_regra for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.esforco_por_regra (regra, titulo, horas) values
  ('sem_viewport',                  'Loja sem viewport (não se adapta ao celular)',      1.0),
  ('lcp_lento',                     'Carregamento lento (LCP acima de 4 s)',              4.0),
  ('lcp_melhorar',                  'Carregamento a melhorar (LCP entre 2,5 e 4 s)',      2.0),
  ('cls_alto',                      'Layout pulando ao carregar (CLS alto)',              2.0),
  ('inp_lento',                     'Loja demora a responder ao toque (INP lento)',       3.0),
  ('pagina_pesada',                 'Página pesada demais',                               3.0),
  ('imagens_pesadas',               'Imagens pesadas',                                    3.0),
  ('imagens_grandes_demais',        'Imagens enviadas muito maiores que o exibido',       2.0),
  ('imagens_sem_lazy',              'Imagens sem carregamento preguiçoso',                1.0),
  ('imagens_sem_tamanho',           'Imagens sem largura e altura definidas',             1.5),
  ('noindex',                       'Loja bloqueada para o Google (noindex)',             0.5),
  ('sem_titulo',                    'Página sem título',                                  0.5),
  ('titulo_fora_do_padrao',         'Título fora do padrão (curto ou longo demais)',      1.0),
  ('sem_descricao',                 'Página sem meta descrição',                          1.0),
  ('sem_h1',                        'Página sem H1',                                      0.5),
  ('varios_h1',                     'Mais de um H1 na página',                            1.0),
  ('imagens_sem_alt',               'Imagens sem texto alternativo',                      2.0),
  ('produto_sem_dados_estruturados','Produto sem dados estruturados (rich results)',      2.0),
  ('links_quebrados',               'Links quebrados',                                    1.5),
  ('contraste_baixo',               'Contraste baixo de texto',                           2.0),
  ('fontes_demais',                 'Fontes demais carregadas',                           1.0),
  ('sem_link_de_produto',           'Home sem link para produto',                         1.0),
  -- Fallbacks: problema sem regra (visual, apontado pelo modelo) cai pelo impacto.
  ('impacto_alto',                  'Outro problema de impacto alto',                     3.0),
  ('impacto_medio',                 'Outro problema de impacto médio',                    2.0),
  ('impacto_baixo',                 'Outro problema de impacto baixo',                    1.0);
