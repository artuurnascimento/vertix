-- =============================================================================
-- Seed: templates de briefing (ecommerce, sistema, site)
-- =============================================================================

insert into public.briefing_templates (tipo_servico, perguntas) values
(
  'ecommerce',
  '[
    {
      "id": "catalogo_produtos",
      "label": "Quantos produtos terá o catálogo da loja?",
      "tipo": "numero",
      "obrigatoria": true
    },
    {
      "id": "meio_pagamento",
      "label": "Qual meio de pagamento você deseja utilizar?",
      "tipo": "select",
      "obrigatoria": true,
      "opcoes": ["Mercado Pago", "Stripe", "Pagar.me", "Outro"]
    },
    {
      "id": "plataforma_atual",
      "label": "Você já vende em alguma plataforma hoje? Se sim, qual?",
      "tipo": "texto",
      "obrigatoria": false
    },
    {
      "id": "integracoes",
      "label": "Precisa de integrações com ERP ou cálculo de frete? Descreva.",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "referencias_visuais",
      "label": "Compartilhe lojas ou sites que você admira (referências visuais).",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "prazo",
      "label": "Qual o prazo desejado para o lançamento?",
      "tipo": "texto",
      "obrigatoria": true
    },
    {
      "id": "orcamento",
      "label": "Qual o orçamento previsto para o projeto?",
      "tipo": "select",
      "obrigatoria": true,
      "opcoes": ["Até R$ 5 mil", "R$ 5 mil a R$ 15 mil", "R$ 15 mil a R$ 30 mil", "Acima de R$ 30 mil"]
    }
  ]'::jsonb
),
(
  'sistema',
  '[
    {
      "id": "processo_automatizar",
      "label": "Qual processo do seu negócio você deseja automatizar?",
      "tipo": "textarea",
      "obrigatoria": true
    },
    {
      "id": "usuarios_perfis",
      "label": "Quem vai usar o sistema? Quais perfis de acesso são necessários?",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "integracoes",
      "label": "Quais integrações são necessárias (APIs, planilhas, outros sistemas)?",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "dados_migrar",
      "label": "Há dados a migrar de outro sistema ou de planilhas? Descreva.",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "prazo",
      "label": "Qual o prazo desejado para a entrega?",
      "tipo": "texto",
      "obrigatoria": true
    },
    {
      "id": "orcamento",
      "label": "Qual o orçamento previsto para o projeto?",
      "tipo": "select",
      "obrigatoria": true,
      "opcoes": ["Até R$ 5 mil", "R$ 5 mil a R$ 15 mil", "R$ 15 mil a R$ 30 mil", "Acima de R$ 30 mil"]
    }
  ]'::jsonb
),
(
  'site',
  '[
    {
      "id": "objetivo_site",
      "label": "Qual o objetivo principal do site?",
      "tipo": "textarea",
      "obrigatoria": true
    },
    {
      "id": "paginas",
      "label": "Quais páginas o site precisa ter?",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "conteudo",
      "label": "O conteúdo (textos e imagens) está pronto ou precisa ser produzido?",
      "tipo": "select",
      "obrigatoria": false,
      "opcoes": ["Pronto", "A produzir", "Parcial"]
    },
    {
      "id": "referencias_visuais",
      "label": "Compartilhe sites que você admira (referências visuais).",
      "tipo": "textarea",
      "obrigatoria": false
    },
    {
      "id": "prazo",
      "label": "Qual o prazo desejado para o lançamento?",
      "tipo": "texto",
      "obrigatoria": true
    },
    {
      "id": "orcamento",
      "label": "Qual o orçamento previsto para o projeto?",
      "tipo": "select",
      "obrigatoria": true,
      "opcoes": ["Até R$ 5 mil", "R$ 5 mil a R$ 15 mil", "R$ 15 mil a R$ 30 mil", "Acima de R$ 30 mil"]
    }
  ]'::jsonb
);
