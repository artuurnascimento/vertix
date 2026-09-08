-- Categoria do produto: que TIPO DE SERVIÇO da Vertix aquilo é.
--
-- `produtos.tipo` já existe, mas responde outra pergunta: o papel do produto
-- dentro de uma oferta ('principal', 'bump', 'upsell', 'downsell'). O mesmo
-- Plano de Correção é 'principal' num checkout e pode ser 'bump' em outro —
-- então `tipo` não responde "quanto a Vertix faturou com tema sob medida".
--
-- Texto livre, sem check constraint, de propósito: a linha de serviços da
-- Vertix muda (tema, app, sistema, consultoria, plano...), e uma lista fechada
-- no banco envelheceria e pediria migration a cada serviço novo. O filtro do
-- painel monta as opções a partir do que de fato existe no catálogo.
--
-- Nulo é permitido: produto sem categoria aparece como "sem categoria" no
-- painel, em vez de travar o cadastro de quem ainda não decidiu a taxonomia.

alter table public.produtos
  add column if not exists categoria text;

comment on column public.produtos.categoria is
  'Tipo de serviço da Vertix (tema, app, sistema, plano...). Texto livre: a lista muda com o negócio. Diferente de `tipo`, que é o papel na oferta.';

-- O painel agrupa e filtra por aqui. O catálogo é pequeno, mas o índice sai
-- barato e evita varredura quando a tela de produtos crescer.
create index if not exists produtos_categoria_idx
  on public.produtos (categoria)
  where categoria is not null;
