-- =============================================================================
-- Vertix Admin — Link de bio: destino do card de destaque
-- O Vertix Scan vai morar em scan.vertix.studio. O destino fica gravado desde
-- já; o card segue DESLIGADO até o backend do Scan estar publicado — basta
-- ligar pelo console quando estiver, sem deploy.
-- =============================================================================

update public.bio_links
set destino = 'https://scan.vertix.studio'
where formato = 'destaque'
  and destino = '';
