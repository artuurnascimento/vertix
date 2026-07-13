-- =============================================================================
-- Seed: templates de briefing (ecommerce, sistema, site)
--
-- Perguntas 100% em linguagem leiga (cliente final). Cada pergunta tem `ajuda`
-- explicando em 1 frase por que perguntamos. Fluxo: negócio → público →
-- funcionalidades → visual → conteúdo → logística → prazo/orçamento.
--
-- CONTRATO (wizard público depende): o template ecommerce tem EXATAMENTE 5
-- perguntas obrigatórias — catalogo_produtos, meio_pagamento, estilo_visual,
-- prazo e orcamento — com os tipos/opções fixados abaixo.
-- =============================================================================

insert into public.briefing_templates (tipo_servico, perguntas) values
(
  'ecommerce',
  '[
    {
      "id": "sobre_negocio",
      "label": "Conte um pouco sobre sua empresa e o que você vende.",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Queremos conhecer seu negócio para criar uma loja com a sua cara."
    },
    {
      "id": "publico_alvo",
      "label": "Quem são as pessoas que compram (ou vão comprar) de você?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Saber para quem vendemos ajuda a escolher o visual e o jeito de falar da loja."
    },
    {
      "id": "plataforma_atual",
      "label": "Você já vende em algum lugar hoje? Se sim, onde?",
      "tipo": "texto",
      "obrigatoria": false,
      "ajuda": "Pode ser loja física, Instagram, WhatsApp, marketplace ou outro site."
    },
    {
      "id": "catalogo_produtos",
      "label": "Quantos produtos você pretende ter na loja?",
      "tipo": "numero",
      "obrigatoria": true,
      "ajuda": "Uma estimativa já ajuda — a quantidade muda o tamanho e a organização da loja."
    },
    {
      "id": "prioridade_loja",
      "label": "O que é mais importante para a sua loja?",
      "tipo": "escolha_visual",
      "obrigatoria": false,
      "ajuda": "Escolha o que mais importa agora — isso nos ajuda a priorizar o projeto.",
      "opcoes_visuais": [
        {
          "valor": "Mostrar bem meus produtos",
          "descricao": "Fotos grandes e um catálogo fácil de navegar",
          "ilustracao": "catalogo"
        },
        {
          "valor": "Facilitar o pagamento",
          "descricao": "Compra rápida, sem burocracia na hora de pagar",
          "ilustracao": "pagamento"
        },
        {
          "valor": "Entrega sem dor de cabeça",
          "descricao": "Frete calculado certinho e rastreio do pedido",
          "ilustracao": "entrega"
        }
      ]
    },
    {
      "id": "meio_pagamento",
      "label": "Como você prefere receber os pagamentos dos clientes?",
      "tipo": "select",
      "obrigatoria": true,
      "ajuda": "São as empresas que processam cartão e Pix na loja — se não conhecer, escolha a última opção.",
      "opcoes": ["Mercado Pago", "Stripe", "Pagar.me", "Ainda não sei"]
    },
    {
      "id": "formas_entrega",
      "label": "Como os produtos vão chegar até o cliente?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Isso define como a loja vai calcular o frete na hora da compra.",
      "opcoes": ["Correios", "Transportadora", "Entrega local / motoboy", "Retirada no local", "Ainda não sei"]
    },
    {
      "id": "estilo_visual",
      "label": "Qual estilo combina mais com a sua marca?",
      "tipo": "escolha_visual",
      "obrigatoria": true,
      "ajuda": "Não precisa entender de design — escolha o visual que mais parece com você.",
      "opcoes_visuais": [
        {
          "valor": "Minimalista e clean",
          "descricao": "Visual leve, com bastante espaço em branco",
          "ilustracao": "estilo_minimalista"
        },
        {
          "valor": "Colorido e vibrante",
          "descricao": "Cores fortes e cheias de energia",
          "ilustracao": "estilo_vibrante"
        },
        {
          "valor": "Sofisticado e escuro",
          "descricao": "Tons escuros, com ar premium e elegante",
          "ilustracao": "estilo_premium"
        }
      ]
    },
    {
      "id": "identidade_visual",
      "label": "Sua empresa já tem logotipo e cores definidas?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Se ainda não tiver, sem problema — podemos criar junto com a loja.",
      "opcoes": ["Sim, tenho logotipo e cores", "Tenho só o logotipo", "Ainda não tenho nada"]
    },
    {
      "id": "referencias_visuais",
      "label": "Existem lojas ou sites que você acha bonitos? Cole os links aqui.",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Exemplos do que você gosta valem mais que mil palavras."
    },
    {
      "id": "conteudo_produtos",
      "label": "Você já tem fotos e descrições dos produtos?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Fotos e textos prontos aceleram bastante o lançamento da loja.",
      "opcoes": ["Sim, tudo pronto", "Tenho uma parte", "Ainda vou produzir", "Preciso de ajuda com isso"]
    },
    {
      "id": "integracoes",
      "label": "A loja precisa se conectar com algum programa que você já usa?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Por exemplo: controle de estoque, emissão de nota fiscal ou planilhas."
    },
    {
      "id": "prazo",
      "label": "Existe um prazo ou uma data especial para a loja entrar no ar?",
      "tipo": "texto",
      "obrigatoria": true,
      "ajuda": "Se houver uma data importante (lançamento, Black Friday), planejamos por ela."
    },
    {
      "id": "orcamento",
      "label": "Quanto você pretende investir no projeto (orçamento)?",
      "tipo": "select",
      "obrigatoria": true,
      "ajuda": "Com uma faixa de valor, propomos a solução que cabe no seu bolso.",
      "opcoes": ["Até R$ 5 mil", "R$ 5 mil a R$ 15 mil", "R$ 15 mil a R$ 30 mil", "Acima de R$ 30 mil"]
    }
  ]'::jsonb
),
(
  'sistema',
  '[
    {
      "id": "sobre_negocio",
      "label": "Conte um pouco sobre sua empresa e o que vocês fazem.",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Entender o dia a dia do seu negócio nos ajuda a criar um sistema que faz sentido."
    },
    {
      "id": "processo_automatizar",
      "label": "Que parte do trabalho você quer parar de fazer manualmente?",
      "tipo": "textarea",
      "obrigatoria": true,
      "ajuda": "Descreva com suas palavras — ex.: controlar pedidos no caderno, cobrar clientes um a um."
    },
    {
      "id": "rotina_hoje",
      "label": "Como esse trabalho acontece hoje?",
      "tipo": "escolha_visual",
      "obrigatoria": false,
      "ajuda": "Saber o ponto de partida nos ajuda a planejar a mudança sem bagunçar sua rotina.",
      "opcoes_visuais": [
        {
          "valor": "No papel ou em planilhas",
          "descricao": "Anotações, cadernos e planilhas soltas",
          "ilustracao": "conteudo"
        },
        {
          "valor": "Em várias ferramentas separadas",
          "descricao": "Cada tarefa em um aplicativo diferente",
          "ilustracao": "integracoes"
        },
        {
          "valor": "Já uso um sistema, mas não dá conta",
          "descricao": "Existe algo hoje, mas falta muita coisa",
          "ilustracao": "automacao"
        }
      ]
    },
    {
      "id": "prioridade_sistema",
      "label": "O que é mais importante para você nesse sistema?",
      "tipo": "escolha_visual",
      "obrigatoria": false,
      "ajuda": "Escolha o que traria mais alívio primeiro — o resto pode vir em etapas.",
      "opcoes_visuais": [
        {
          "valor": "Automatizar tarefas repetitivas",
          "descricao": "O sistema faz sozinho o que hoje toma seu tempo",
          "ilustracao": "automacao"
        },
        {
          "valor": "Organizar o trabalho da equipe",
          "descricao": "Cada pessoa sabe o que fazer e nada se perde",
          "ilustracao": "usuarios"
        },
        {
          "valor": "Acompanhar números e resultados",
          "descricao": "Ver vendas, custos e metas em um só lugar",
          "ilustracao": "metas"
        }
      ]
    },
    {
      "id": "usuarios_perfis",
      "label": "Quem vai usar o sistema no dia a dia?",
      "tipo": "textarea",
      "obrigatoria": true,
      "ajuda": "Diga quantas pessoas e o que cada uma faz — ex.: dono, vendedor, financeiro."
    },
    {
      "id": "ferramentas_atuais",
      "label": "Quais programas, aplicativos ou planilhas vocês usam hoje?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Ex.: WhatsApp, Excel, sistema de nota fiscal — mesmo os mais simples contam."
    },
    {
      "id": "integracoes",
      "label": "O novo sistema precisa se conectar com algum desses programas?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Conectar sistemas evita digitar a mesma informação duas vezes."
    },
    {
      "id": "dados_migrar",
      "label": "Existem informações antigas que precisam ir para o novo sistema?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Ex.: cadastros de clientes em planilhas ou dados de outro programa."
    },
    {
      "id": "acesso_dispositivos",
      "label": "Onde o sistema será mais usado?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Isso muda o jeito que desenhamos as telas.",
      "opcoes": ["No computador", "No celular", "Nos dois", "Ainda não sei"]
    },
    {
      "id": "relatorios",
      "label": "Que números ou resultados você gostaria de acompanhar?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Ex.: quanto vendi no mês, quais clientes estão devendo, estoque baixo."
    },
    {
      "id": "referencias_visuais",
      "label": "Existe algum sistema ou aplicativo que você acha fácil de usar?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Pode ser qualquer app do seu celular — nos diz o que é simples para você."
    },
    {
      "id": "prazo",
      "label": "Existe um prazo desejado para o sistema começar a funcionar?",
      "tipo": "texto",
      "obrigatoria": true,
      "ajuda": "Se houver uma data limite, organizamos as entregas por ela."
    },
    {
      "id": "orcamento",
      "label": "Quanto você pretende investir no projeto (orçamento)?",
      "tipo": "select",
      "obrigatoria": true,
      "ajuda": "Com uma faixa de valor, propomos a solução que cabe no seu bolso.",
      "opcoes": ["Até R$ 5 mil", "R$ 5 mil a R$ 15 mil", "R$ 15 mil a R$ 30 mil", "Acima de R$ 30 mil"]
    }
  ]'::jsonb
),
(
  'site',
  '[
    {
      "id": "sobre_negocio",
      "label": "Conte um pouco sobre sua empresa e o que vocês oferecem.",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Queremos conhecer seu negócio para o site contar bem a sua história."
    },
    {
      "id": "publico_alvo",
      "label": "Quem você quer alcançar com o site?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Saber quem visita o site ajuda a escolher o tom e o visual certos."
    },
    {
      "id": "objetivo_site",
      "label": "O que você espera que o site faça pelo seu negócio?",
      "tipo": "textarea",
      "obrigatoria": true,
      "ajuda": "Ex.: aparecer no Google, receber pedidos de orçamento, mostrar seu trabalho."
    },
    {
      "id": "funcao_site",
      "label": "O que o site precisa fazer no dia a dia?",
      "tipo": "escolha_visual",
      "obrigatoria": false,
      "ajuda": "Escolha o uso principal — dá para combinar mais de um depois.",
      "opcoes_visuais": [
        {
          "valor": "Apresentar minha empresa e serviços",
          "descricao": "Um cartão de visitas completo na internet",
          "ilustracao": "site_paginas"
        },
        {
          "valor": "Publicar novidades e conteúdo",
          "descricao": "Textos, fotos e notícias atualizados por você",
          "ilustracao": "conteudo"
        },
        {
          "valor": "Deixar clientes marcarem horários",
          "descricao": "Agendamento direto pelo site, sem telefone",
          "ilustracao": "agendamento"
        }
      ]
    },
    {
      "id": "paginas",
      "label": "Quais páginas você imagina no site?",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Ex.: início, sobre, serviços, contato. Se não souber, a gente ajuda a definir."
    },
    {
      "id": "plataforma_atual",
      "label": "Você já tem um site hoje? Se sim, qual o endereço?",
      "tipo": "texto",
      "obrigatoria": false,
      "ajuda": "Se existir um site antigo, aproveitamos o que funciona e melhoramos o resto."
    },
    {
      "id": "estilo_visual",
      "label": "Qual estilo combina mais com a sua marca?",
      "tipo": "escolha_visual",
      "obrigatoria": false,
      "ajuda": "Não precisa entender de design — escolha o visual que mais parece com você.",
      "opcoes_visuais": [
        {
          "valor": "Minimalista e clean",
          "descricao": "Visual leve, com bastante espaço em branco",
          "ilustracao": "estilo_minimalista"
        },
        {
          "valor": "Colorido e vibrante",
          "descricao": "Cores fortes e cheias de energia",
          "ilustracao": "estilo_vibrante"
        },
        {
          "valor": "Sofisticado e escuro",
          "descricao": "Tons escuros, com ar premium e elegante",
          "ilustracao": "estilo_premium"
        }
      ]
    },
    {
      "id": "identidade_visual",
      "label": "Sua empresa já tem logotipo e cores definidas?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Se ainda não tiver, sem problema — podemos criar junto com o site.",
      "opcoes": ["Sim, tenho logotipo e cores", "Tenho só o logotipo", "Ainda não tenho nada"]
    },
    {
      "id": "referencias_visuais",
      "label": "Existem sites que você acha bonitos? Cole os links aqui.",
      "tipo": "textarea",
      "obrigatoria": false,
      "ajuda": "Exemplos do que você gosta valem mais que mil palavras."
    },
    {
      "id": "conteudo",
      "label": "Os textos e as fotos do site já existem?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Conteúdo pronto acelera o projeto — e podemos produzir o que faltar.",
      "opcoes": ["Sim, está tudo pronto", "Tenho uma parte", "Preciso que vocês produzam", "Ainda não sei"]
    },
    {
      "id": "dominio",
      "label": "Você já tem o endereço do site (domínio)?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Domínio é o endereço que as pessoas digitam, como suaempresa.com.br.",
      "opcoes": ["Sim, já tenho", "Não, preciso registrar", "Não sei o que é isso"]
    },
    {
      "id": "formas_contato",
      "label": "Como você quer que os visitantes falem com você?",
      "tipo": "select",
      "obrigatoria": false,
      "ajuda": "Colocamos o canal preferido em destaque em todas as páginas.",
      "opcoes": ["WhatsApp", "Formulário no site", "Telefone ou e-mail", "Ainda não sei"]
    },
    {
      "id": "prazo",
      "label": "Existe um prazo ou uma data especial para o site entrar no ar?",
      "tipo": "texto",
      "obrigatoria": true,
      "ajuda": "Se houver uma data importante, planejamos as entregas por ela."
    },
    {
      "id": "orcamento",
      "label": "Quanto você pretende investir no projeto (orçamento)?",
      "tipo": "select",
      "obrigatoria": true,
      "ajuda": "Com uma faixa de valor, propomos a solução que cabe no seu bolso.",
      "opcoes": ["Até R$ 5 mil", "R$ 5 mil a R$ 15 mil", "R$ 15 mil a R$ 30 mil", "Acima de R$ 30 mil"]
    }
  ]'::jsonb
);
