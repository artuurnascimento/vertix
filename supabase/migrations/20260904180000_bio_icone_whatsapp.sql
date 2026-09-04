-- =============================================================================
-- Vertix Admin — Link de bio: ícone oficial do WhatsApp no botão de conversa
-- O botão usava 'message-circle' (balão genérico da biblioteca de ícones, que
-- não distribui marcas). A página passou a desenhar o glifo do WhatsApp, e
-- este é o valor que o seleciona.
-- =============================================================================

update public.bio_links
set icone = 'whatsapp'
where tipo_destino = 'whatsapp'
  and formato = 'largo'
  and icone = 'message-circle';
