-- =============================================================================
-- Vertix Admin — Link de bio: rótulo do botão do destaque
-- O botão do card virou o botão de líquido violeta, com rótulo grande em
-- caixa alta. Texto mais curto para caber em uma linha ao lado da ilustração.
-- =============================================================================

update public.bio_links
set texto_botao = 'Escanear agora'
where formato = 'destaque'
  and texto_botao = 'Escanear minha loja';
