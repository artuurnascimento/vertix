-- =============================================================================
-- Vertix Admin — Link de bio: rótulo do botão do destaque com iniciais
-- maiúsculas ("Escanear Agora"). O botão deixou de forçar caixa alta.
-- =============================================================================

update public.bio_links
set texto_botao = 'Escanear Agora'
where formato = 'destaque'
  and texto_botao = 'Escanear agora';
