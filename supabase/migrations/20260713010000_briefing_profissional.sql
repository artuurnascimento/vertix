-- =============================================================================
-- Vertix Admin — Briefing em nível profissional de agência (Fase 5)
--
-- Reescreve as perguntas dos 3 briefing_templates (ecommerce, sistema, site)
-- para capturar tudo que um dev/designer precisa para orçar e executar o
-- projeto, mantendo linguagem 100% leiga (cliente não-técnico responde
-- sozinho, sem ajuda). Motivo: feedback do usuário de que as perguntas atuais
-- não continham o necessário para um profissional.
--
-- Compatibilidade: os ids usados em respostas antigas são preservados quando
-- a pergunta sobrevive semanticamente (catalogo_produtos, meio_pagamento,
-- prazo, orcamento, processo_automatizar, objetivo_site) — respostas
-- anteriores continuam associadas corretamente pelo id.
--
-- Âncoras E2E mantidas (wizard público depende):
--   - ecommerce.catalogo_produtos: tipo numero, label contém "Quantos produtos"
--   - ecommerce.meio_pagamento: select com opção exata "Mercado Pago"
--   - ecommerce.prazo: tipo texto, label contém "prazo"
--   - ecommerce.orcamento: select com opção exata "R$ 5 mil a R$ 15 mil"
--   - ecommerce: 1 escolha_visual de estilo com opção "Minimalista e clean"
--   - Nenhuma outra pergunta do ecommerce contém "Quantos produtos" no label
-- =============================================================================

begin;

update public.briefing_templates
set
  perguntas = $json$[
  {
    "id": "sobre_negocio",
    "label": "Conte um pouco sobre sua empresa e o que você vende.",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Quanto mais detalhes, melhor conseguimos entender o seu negócio antes de montar a loja."
  },
  {
    "id": "publico_alvo",
    "label": "Quem é o cliente que mais compra (ou vai comprar) de você?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Escolha o perfil que mais se aproxima do seu público principal — isso guia o visual e o tom de voz da loja.",
    "opcoes_visuais": [
      {
        "valor": "Pessoas físicas (consumidor final)",
        "descricao": "Quem compra para uso próprio, no varejo",
        "ilustracao": "publico_alvo"
      },
      {
        "valor": "Outras empresas (B2B/atacado)",
        "descricao": "Vendas em maior volume para outros negócios",
        "ilustracao": "usuarios"
      },
      {
        "valor": "Os dois públicos",
        "descricao": "Vendo tanto no varejo quanto por atacado",
        "ilustracao": "loja"
      }
    ]
  },
  {
    "id": "plataforma_atual",
    "label": "Você já vende em algum lugar hoje? Se sim, onde?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Pode ser loja física, Instagram, WhatsApp, marketplace (Shopee, Mercado Livre) ou outro site."
  },
  {
    "id": "categorias_produto",
    "label": "Quais categorias ou tipos de produto você vende?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Ex.: roupas femininas, suplementos, artigos para pets — isso ajuda a organizar os menus e filtros da loja."
  },
  {
    "id": "catalogo_produtos",
    "label": "Quantos produtos você pretende ter na loja?",
    "tipo": "numero",
    "obrigatoria": true,
    "ajuda": "Uma estimativa já ajuda — a quantidade muda o tamanho, os filtros e a organização da loja."
  },
  {
    "id": "controle_estoque",
    "label": "Como você controla o estoque hoje?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso mostra se a loja precisa avisar quando um produto acabar ou se conectar com algum sistema que você já usa.",
    "opcoes_visuais": [
      {
        "valor": "Não tenho controle formal",
        "descricao": "Sei de cabeça ou olho a prateleira",
        "ilustracao": "estoque"
      },
      {
        "valor": "Uso planilha ou caderno",
        "descricao": "Anoto entradas e saídas manualmente",
        "ilustracao": "conteudo"
      },
      {
        "valor": "Já uso um sistema de estoque",
        "descricao": "ERP, PDV ou outro programa de controle",
        "ilustracao": "integracoes"
      }
    ]
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
    "opcoes": [
      "Mercado Pago",
      "Stripe",
      "Pagar.me",
      "Ainda não sei"
    ]
  },
  {
    "id": "formas_entrega",
    "label": "Como os produtos vão chegar até o cliente?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Isso define como a loja vai calcular o frete na hora da compra.",
    "opcoes": [
      "Correios",
      "Transportadora",
      "Entrega local / motoboy",
      "Retirada no local",
      "Ainda não sei"
    ]
  },
  {
    "id": "recorrencia",
    "label": "Você quer vender por assinatura ou clube (cobrança recorrente)?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Assinatura é quando o cliente paga todo mês para receber produtos automaticamente — só se aplica se fizer sentido pro seu negócio.",
    "opcoes_visuais": [
      {
        "valor": "Sim, quero um clube de assinatura",
        "descricao": "Cobrança automática recorrente do cliente",
        "ilustracao": "recorrencia"
      },
      {
        "valor": "Não, só venda avulsa",
        "descricao": "O cliente compra quando quiser, sem mensalidade",
        "ilustracao": "loja"
      }
    ]
  },
  {
    "id": "integracoes",
    "label": "A loja precisa se conectar com algum programa que você já usa?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Por exemplo: WhatsApp, Instagram, controle de estoque, emissão de nota fiscal, ERP ou marketplaces."
  },
  {
    "id": "promocoes_cupons",
    "label": "Você pretende usar cupons de desconto ou promoções?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Ex.: cupom de primeira compra, frete grátis, desconto por quantidade.",
    "opcoes": [
      "Sim, com frequência",
      "Só em datas especiais",
      "Não pretendo",
      "Ainda não sei"
    ]
  },
  {
    "id": "concorrentes",
    "label": "Existem lojas ou marcas que você admira ou considera concorrentes? Cole os links.",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Ver o que outras lojas fazem bem (ou mal) ajuda a posicionar a sua."
  },
  {
    "id": "referencias_visuais",
    "label": "Tem alguma loja ou site que você NÃO gosta ou quer evitar copiar? Cole os links.",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Saber o que evitar é tão importante quanto saber o que você gosta."
  },
  {
    "id": "identidade_visual",
    "label": "Sua empresa já tem logotipo e cores definidas?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Se ainda não tiver, sem problema — podemos criar junto com a loja.",
    "opcoes_visuais": [
      {
        "valor": "Sim, tenho logo e cores prontos",
        "descricao": "Já tenho um manual de marca ou arquivos definidos",
        "ilustracao": "identidade_visual"
      },
      {
        "valor": "Tenho só o logotipo",
        "descricao": "Falta ainda definir a paleta de cores",
        "ilustracao": "conteudo"
      },
      {
        "valor": "Ainda não tenho nada",
        "descricao": "Preciso criar a identidade visual do zero",
        "ilustracao": "estilo_premium"
      }
    ]
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
    "id": "conteudo_produtos",
    "label": "Você já tem fotos e descrições dos produtos?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Fotos e textos prontos aceleram bastante o lançamento da loja.",
    "opcoes": [
      "Sim, tudo pronto",
      "Tenho uma parte",
      "Ainda vou produzir",
      "Preciso de ajuda com isso"
    ]
  },
  {
    "id": "redes_sociais",
    "label": "Quais redes sociais da sua marca já estão ativas?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Cole os links ou @ do Instagram, TikTok, Facebook etc. — podemos integrar com a loja."
  },
  {
    "id": "quem_decide",
    "label": "Quem vai aprovar as decisões e o resultado final do projeto?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Saber quem dá o aval final evita retrabalho e agiliza as aprovações."
  },
  {
    "id": "suporte_pos_entrega",
    "label": "Depois que a loja entrar no ar, o que você espera de suporte?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso ajuda a combinar o pacote de manutenção certo para o seu momento.",
    "opcoes_visuais": [
      {
        "valor": "Só preciso que funcione, sem manutenção fixa",
        "descricao": "Chamo quando precisar de algo pontual",
        "ilustracao": "suporte"
      },
      {
        "valor": "Quero suporte contínuo mensal",
        "descricao": "Alguém disponível para ajustes e dúvidas sempre",
        "ilustracao": "automacao"
      },
      {
        "valor": "Ainda não sei",
        "descricao": "Quero entender as opções antes de decidir",
        "ilustracao": "metas"
      }
    ]
  },
  {
    "id": "prazo",
    "label": "Existe um prazo ou uma data especial para a loja entrar no ar?",
    "tipo": "texto",
    "obrigatoria": true,
    "ajuda": "Se houver uma data importante (lançamento, Black Friday), conte também o motivo — planejamos por ela."
  },
  {
    "id": "orcamento",
    "label": "Quanto você pretende investir no projeto (orçamento)?",
    "tipo": "select",
    "obrigatoria": true,
    "ajuda": "Com uma faixa de valor, propomos a solução que cabe no seu bolso.",
    "opcoes": [
      "Até R$ 5 mil",
      "R$ 5 mil a R$ 15 mil",
      "R$ 15 mil a R$ 30 mil",
      "Acima de R$ 30 mil",
      "Ainda não sei"
    ]
  }
]$json$::jsonb
where tipo_servico = 'ecommerce';

update public.briefing_templates
set
  perguntas = $json$[
  {
    "id": "sobre_negocio",
    "label": "Conte um pouco sobre sua empresa e o que vocês fazem.",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Entender o dia a dia do seu negócio nos ajuda a criar um sistema que faz sentido para a sua rotina."
  },
  {
    "id": "publico_alvo",
    "label": "Quem vai usar esse sistema no dia a dia?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Escolha quem mais vai mexer no sistema — isso muda a linguagem e a complexidade das telas.",
    "opcoes_visuais": [
      {
        "valor": "Só eu ou um time pequeno interno",
        "descricao": "Uso interno da própria empresa",
        "ilustracao": "usuarios"
      },
      {
        "valor": "Meus clientes também vão acessar",
        "descricao": "Um portal ou área para quem compra de você",
        "ilustracao": "publico_alvo"
      },
      {
        "valor": "Equipe interna e clientes externos",
        "descricao": "Dois tipos de acesso, com permissões diferentes",
        "ilustracao": "seguranca"
      }
    ]
  },
  {
    "id": "processo_automatizar",
    "label": "Que parte do trabalho você quer parar de fazer manualmente?",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Descreva com suas palavras — ex.: controlar pedidos no caderno, cobrar clientes um a um, calcular comissão na mão."
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
    "id": "volume_uso",
    "label": "Qual o volume aproximado do seu negócio por mês?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Ex.: quantos clientes, pedidos, atendimentos ou vendas por mês — ajuda a dimensionar o sistema."
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
    "label": "Quantas pessoas vão usar o sistema e o que cada uma faz?",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Diga quantas pessoas e o papel de cada uma — ex.: 1 dono com acesso total, 3 vendedores só veem seus próprios clientes."
  },
  {
    "id": "essencial_dia_1",
    "label": "O que o sistema PRECISA fazer já no primeiro dia de uso?",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Liste só o essencial para começar a usar — o que puder esperar, perguntamos na próxima."
  },
  {
    "id": "desejavel_futuro",
    "label": "O que seria bom ter, mas pode vir depois, em uma segunda etapa?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Separar o essencial do 'seria bom ter' ajuda a lançar o sistema mais rápido."
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
    "id": "relatorios",
    "label": "Que números ou relatórios você gostaria de acompanhar?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Ex.: quanto vendi no mês, quais clientes estão devendo, estoque baixo, comissão por vendedor."
  },
  {
    "id": "acesso_dispositivos",
    "label": "Onde o sistema será mais usado?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso muda o jeito que desenhamos as telas — um celular precisa de botões maiores e menos informação por tela.",
    "opcoes_visuais": [
      {
        "valor": "Principalmente no computador",
        "descricao": "Uso fixo, em escritório ou balcão",
        "ilustracao": "usuarios"
      },
      {
        "valor": "Principalmente no celular",
        "descricao": "Equipe em campo ou em movimento",
        "ilustracao": "mobile"
      },
      {
        "valor": "Nos dois, igualmente",
        "descricao": "Depende de quem e de onde está usando",
        "ilustracao": "integracoes"
      }
    ]
  },
  {
    "id": "dados_sensiveis",
    "label": "O sistema vai lidar com dados sensíveis (senhas, pagamentos, documentos)?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso define o nível de segurança e de login que o sistema vai precisar.",
    "opcoes_visuais": [
      {
        "valor": "Sim, dados sensíveis ou financeiros",
        "descricao": "Login de clientes, cartões, documentos pessoais",
        "ilustracao": "seguranca"
      },
      {
        "valor": "Só informações internas do dia a dia",
        "descricao": "Sem dado financeiro ou pessoal sensível",
        "ilustracao": "conteudo"
      },
      {
        "valor": "Não sei dizer agora",
        "descricao": "Preciso de ajuda para avaliar isso",
        "ilustracao": "metas"
      }
    ]
  },
  {
    "id": "referencias_visuais",
    "label": "Existe algum sistema ou aplicativo que você acha fácil de usar? Cole os links.",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Pode ser qualquer app do seu celular — nos diz o que é simples para você."
  },
  {
    "id": "concorrentes",
    "label": "Tem algum sistema parecido no mercado que você já usou ou testou?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Contar o que funcionou (ou não) em outro sistema evita repetir os mesmos problemas."
  },
  {
    "id": "identidade_visual",
    "label": "A empresa já tem logotipo e cores definidas para usar no sistema?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Se ainda não tiver, sem problema — podemos usar um visual neutro e profissional.",
    "opcoes": [
      "Sim, tenho logotipo e cores",
      "Tenho só o logotipo",
      "Ainda não tenho nada"
    ]
  },
  {
    "id": "quem_decide",
    "label": "Quem vai aprovar as decisões e o resultado final do projeto?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Saber quem dá o aval final evita retrabalho e agiliza as aprovações."
  },
  {
    "id": "suporte_pos_entrega",
    "label": "Depois que o sistema estiver no ar, o que você espera de suporte?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso ajuda a combinar o pacote de manutenção certo para o seu momento.",
    "opcoes_visuais": [
      {
        "valor": "Só preciso que funcione, sem manutenção fixa",
        "descricao": "Chamo quando precisar de algo pontual",
        "ilustracao": "suporte"
      },
      {
        "valor": "Quero suporte contínuo mensal",
        "descricao": "Alguém disponível para ajustes e dúvidas sempre",
        "ilustracao": "automacao"
      },
      {
        "valor": "Ainda não sei",
        "descricao": "Quero entender as opções antes de decidir",
        "ilustracao": "metas"
      }
    ]
  },
  {
    "id": "prazo",
    "label": "Existe um prazo desejado para o sistema começar a funcionar?",
    "tipo": "texto",
    "obrigatoria": true,
    "ajuda": "Se houver uma data limite e o motivo dela, organizamos as entregas por essa data."
  },
  {
    "id": "orcamento",
    "label": "Quanto você pretende investir no projeto (orçamento)?",
    "tipo": "select",
    "obrigatoria": true,
    "ajuda": "Com uma faixa de valor, propomos a solução que cabe no seu bolso.",
    "opcoes": [
      "Até R$ 5 mil",
      "R$ 5 mil a R$ 15 mil",
      "R$ 15 mil a R$ 30 mil",
      "Acima de R$ 30 mil",
      "Ainda não sei"
    ]
  }
]$json$::jsonb
where tipo_servico = 'sistema';

update public.briefing_templates
set
  perguntas = $json$[
  {
    "id": "sobre_negocio",
    "label": "Conte um pouco sobre sua empresa e o que vocês oferecem.",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Queremos conhecer seu negócio para o site contar bem a sua história."
  },
  {
    "id": "publico_alvo",
    "label": "Quem você quer alcançar com o site?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Escolha o perfil que mais se aproxima de quem vai visitar o site — isso ajuda a escolher o tom e o visual certos.",
    "opcoes_visuais": [
      {
        "valor": "Pessoas buscando meu serviço no Google",
        "descricao": "Quem pesquisa e ainda não conhece a marca",
        "ilustracao": "publico_alvo"
      },
      {
        "valor": "Clientes que já me conhecem",
        "descricao": "Pessoas que chegam por indicação ou redes sociais",
        "ilustracao": "redes_sociais"
      },
      {
        "valor": "Outras empresas ou parceiros",
        "descricao": "Site institucional voltado para B2B",
        "ilustracao": "usuarios"
      }
    ]
  },
  {
    "id": "objetivo_site",
    "label": "O que você espera que o site faça pelo seu negócio?",
    "tipo": "textarea",
    "obrigatoria": true,
    "ajuda": "Ex.: aparecer no Google, receber pedidos de orçamento, mostrar seu trabalho, vender diretamente."
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
    "id": "metas_resultado",
    "label": "Aparecer bem posicionado no Google é uma prioridade para você?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso define se vamos investir mais tempo em SEO (aparecer nas buscas) desde o início.",
    "opcoes_visuais": [
      {
        "valor": "Sim, é uma das principais metas",
        "descricao": "Quero ser encontrado por quem busca meu serviço",
        "ilustracao": "metas"
      },
      {
        "valor": "É importante, mas não a prioridade agora",
        "descricao": "O site tem outros objetivos mais urgentes",
        "ilustracao": "relatorios"
      },
      {
        "valor": "Não sei o que é isso",
        "descricao": "Quero entender melhor essa parte",
        "ilustracao": "conteudo"
      }
    ]
  },
  {
    "id": "paginas",
    "label": "Quais páginas você imagina no site?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Ex.: início, sobre, serviços, portfólio, contato. Se não souber, a gente ajuda a definir."
  },
  {
    "id": "plataforma_atual",
    "label": "Você já tem um site hoje? Se sim, qual o endereço?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Se existir um site antigo, aproveitamos o que funciona e melhoramos o resto."
  },
  {
    "id": "site_atual_gosta",
    "label": "No seu site atual (se tiver), o que você quer manter e o que não aguenta mais ver?",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Ex.: 'gosto das fotos, mas o menu é confuso' — ajuda a não perder o que já funciona."
  },
  {
    "id": "concorrentes",
    "label": "Existem sites de concorrentes ou marcas que você admira? Cole os links.",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Exemplos do que você gosta valem mais que mil palavras."
  },
  {
    "id": "referencias_visuais",
    "label": "Tem algum site que você NÃO gosta ou quer evitar copiar? Cole os links.",
    "tipo": "textarea",
    "obrigatoria": false,
    "ajuda": "Saber o que evitar é tão importante quanto saber o que você gosta."
  },
  {
    "id": "identidade_visual",
    "label": "Sua empresa já tem logotipo e cores definidas?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Se ainda não tiver, sem problema — podemos criar junto com o site.",
    "opcoes_visuais": [
      {
        "valor": "Sim, tenho logo e cores prontos",
        "descricao": "Já tenho um manual de marca ou arquivos definidos",
        "ilustracao": "identidade_visual"
      },
      {
        "valor": "Tenho só o logotipo",
        "descricao": "Falta ainda definir a paleta de cores",
        "ilustracao": "conteudo"
      },
      {
        "valor": "Ainda não tenho nada",
        "descricao": "Preciso criar a identidade visual do zero",
        "ilustracao": "estilo_premium"
      }
    ]
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
    "id": "conteudo",
    "label": "Os textos e as fotos do site já existem?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Conteúdo pronto acelera o projeto — e podemos produzir o que faltar.",
    "opcoes": [
      "Sim, está tudo pronto",
      "Tenho uma parte",
      "Preciso que vocês produzam",
      "Ainda não sei"
    ]
  },
  {
    "id": "blog_novidades",
    "label": "Você quer publicar novidades, artigos ou blog no site?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Isso define se o site precisa de uma área que você mesmo consegue atualizar.",
    "opcoes": [
      "Sim, quero publicar com frequência",
      "Só ocasionalmente",
      "Não pretendo",
      "Ainda não sei"
    ]
  },
  {
    "id": "redes_sociais",
    "label": "Quais redes sociais da sua marca já estão ativas?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Cole os links ou @ do Instagram, TikTok, Facebook etc. — podemos integrar com o site."
  },
  {
    "id": "dominio",
    "label": "Você já tem o endereço do site (domínio)?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Domínio é o endereço que as pessoas digitam, como suaempresa.com.br.",
    "opcoes": [
      "Sim, já tenho",
      "Não, preciso registrar",
      "Não sei o que é isso"
    ]
  },
  {
    "id": "formas_contato",
    "label": "Como você quer que os visitantes falem com você?",
    "tipo": "select",
    "obrigatoria": false,
    "ajuda": "Colocamos o canal preferido em destaque em todas as páginas.",
    "opcoes": [
      "WhatsApp",
      "Formulário no site",
      "Telefone ou e-mail",
      "Ainda não sei"
    ]
  },
  {
    "id": "quem_decide",
    "label": "Quem vai aprovar as decisões e o resultado final do projeto?",
    "tipo": "texto",
    "obrigatoria": false,
    "ajuda": "Saber quem dá o aval final evita retrabalho e agiliza as aprovações."
  },
  {
    "id": "suporte_pos_entrega",
    "label": "Depois que o site entrar no ar, o que você espera de suporte?",
    "tipo": "escolha_visual",
    "obrigatoria": false,
    "ajuda": "Isso ajuda a combinar o pacote de manutenção certo para o seu momento.",
    "opcoes_visuais": [
      {
        "valor": "Só preciso que funcione, sem manutenção fixa",
        "descricao": "Chamo quando precisar de algo pontual",
        "ilustracao": "suporte"
      },
      {
        "valor": "Quero suporte contínuo mensal",
        "descricao": "Alguém disponível para ajustes e dúvidas sempre",
        "ilustracao": "automacao"
      },
      {
        "valor": "Ainda não sei",
        "descricao": "Quero entender as opções antes de decidir",
        "ilustracao": "metas"
      }
    ]
  },
  {
    "id": "prazo",
    "label": "Existe um prazo ou uma data especial para o site entrar no ar?",
    "tipo": "texto",
    "obrigatoria": true,
    "ajuda": "Se houver uma data importante, conte também o motivo — planejamos as entregas por ela."
  },
  {
    "id": "orcamento",
    "label": "Quanto você pretende investir no projeto (orçamento)?",
    "tipo": "select",
    "obrigatoria": true,
    "ajuda": "Com uma faixa de valor, propomos a solução que cabe no seu bolso.",
    "opcoes": [
      "Até R$ 5 mil",
      "R$ 5 mil a R$ 15 mil",
      "R$ 15 mil a R$ 30 mil",
      "Acima de R$ 30 mil",
      "Ainda não sei"
    ]
  }
]$json$::jsonb
where tipo_servico = 'site';

commit;
