-- =============================================================================
-- Vertix Admin — Link de bio: textos próprios do card de destaque
-- O card grande do topo tem quatro textos (chamada curta, título, corpo e
-- rótulo do botão), enquanto os formatos largo e grade usam só dois. Sem
-- estas colunas o destaque perdia o corpo e o botão ficava com texto fixo no
-- código — o oposto do objetivo do módulo, que é montar a página pelo console.
-- Ambas opcionais: os outros formatos simplesmente não as usam.
-- =============================================================================

alter table public.bio_links
  add column chamada text,
  add column texto_botao text;

comment on column public.bio_links.chamada is
  'Linha curta acima do título, só no formato destaque (ex.: "Grátis · 60 segundos").';
comment on column public.bio_links.texto_botao is
  'Rótulo do botão dentro do card de destaque (ex.: "Analisar minha loja").';

-- -----------------------------------------------------------------------------
-- A RPC pública precisa devolver os campos novos.
-- -----------------------------------------------------------------------------

create or replace function public.get_bio_links()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', l.id,
        'rotulo', l.rotulo,
        'descricao', l.descricao,
        'chamada', l.chamada,
        'texto_botao', l.texto_botao,
        'icone', l.icone,
        'formato', l.formato,
        'tipo_destino', l.tipo_destino,
        'destino', l.destino,
        'mensagem', l.mensagem,
        'posicao', l.posicao
      )
      order by l.posicao, l.created_at
    ),
    '[]'::json
  )
  from public.bio_links l
  where l.ativo
    and (l.inicia_em is null or l.inicia_em <= now())
    and (l.termina_em is null or l.termina_em > now())
    and l.destino <> '';
$$;

-- Grants sobrevivem ao create or replace (padrão do projeto: não reemitir).

-- -----------------------------------------------------------------------------
-- Conteúdo do destaque do Vertix Scan. Continua DESLIGADO e sem destino até o
-- backend do Scan existir; isto só deixa os textos prontos para o dia em que
-- for ligado pelo console.
-- -----------------------------------------------------------------------------

update public.bio_links
set
  descricao = 'Nota de 0 a 100 com velocidade, confiança e página de produto.',
  chamada = 'Grátis · 60 segundos',
  texto_botao = 'Analisar minha loja'
where formato = 'destaque'
  and rotulo = 'Sua loja aguenta um scan?';
