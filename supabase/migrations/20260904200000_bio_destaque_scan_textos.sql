-- =============================================================================
-- Vertix Admin — Link de bio: textos do card de destaque no formato novo
-- O card ganhou o desenho do banner do Vertix Scan (chamada, título grande,
-- subtítulo, botão e ilustração). Só os textos mudam aqui; o registro segue
-- DESLIGADO e sem destino até o backend do Scan existir.
-- =============================================================================

update public.bio_links
set
  chamada = 'Vertix Scan · Grátis',
  rotulo = 'Veja o que está travando sua loja.',
  descricao = 'Um diagnóstico rápido com nota para velocidade, confiança e página de produto.',
  texto_botao = 'Escanear minha loja'
where formato = 'destaque'
  and rotulo = 'Sua loja aguenta um scan?';
