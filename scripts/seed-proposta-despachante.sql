-- =============================================================================
-- Seed — Proposta "Sistema Despachante Veicular" (Vinicius Leal e Caio José)
-- Cria cliente + projeto + proposta com apresentação slide-deck (VTX-2026-015).
-- Idempotente: re-executar atualiza o conteúdo sem duplicar nem mexer no status.
-- Uso: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -f scripts/seed-proposta-despachante.sql
-- =============================================================================

insert into public.clients (id, nome, empresa, origem)
values (
  'c0ffee00-0001-4a00-8a00-000000000001',
  'Vinicius Leal e Caio José',
  'Despachante Veicular',
  'indicacao'
)
on conflict (id) do update set nome = excluded.nome, empresa = excluded.empresa;

insert into public.projects (id, client_id, nome, tipo_servico, status)
values (
  'c0ffee00-0002-4a00-8a00-000000000002',
  'c0ffee00-0001-4a00-8a00-000000000001',
  'Sistema Despachante Veicular',
  'sistema',
  'lead'
)
on conflict (id) do update set nome = excluded.nome;

insert into public.proposals (
  id, project_id, titulo, itens, desconto, valor_total, condicoes,
  parcelas, validade, status, token, sent_at, apresentacao
)
values (
  'c0ffee00-0003-4a00-8a00-000000000003',
  'c0ffee00-0002-4a00-8a00-000000000002',
  'Sistema de Gestão para Despachante Veicular',
  '[{"descricao": "Sistema de gestão completo — escopo essencial (10 módulos)", "quantidade": 1, "valor_unitario": 11900}]'::jsonb,
  6900,
  5000,
  'Garantia de 3 meses para manutenção e reparo após a entrega. Pagamento via Pix ou cartão de crédito: entrada de 30% (R$ 1.500) na aprovação e saldo de 70% (R$ 3.500) na entrega. Prazo estimado de 30 dias úteis após a confirmação da entrada. Custos de terceiros (hospedagem e API oficial do WhatsApp) são contratados diretamente pelo cliente. Alterações fora do escopo são orçadas à parte.',
  '[{"descricao": "Entrada — 30% na aprovação", "valor": 1500, "vencimento": "2026-08-06"}, {"descricao": "Saldo — 70% na entrega", "valor": 3500, "vencimento": "2026-09-04"}]'::jsonb,
  '2026-08-10',
  'enviada',
  'c0ffee00-0004-4a00-8a00-000000000004',
  now(),
  $deck$
{
  "versao": 1,
  "codigo": "VTX-2026-015",
  "clienteLabel": "Vinicius Leal e Caio José",
  "slides": [
    {
      "tipo": "capa",
      "titulo": "Sistema ✱ de Gestão () Despachante Veicular",
      "subtitulo": "Processos, documentos, atendimento, financeiro e cobrança automatizada via WhatsApp — a operação inteira fora da planilha, em uma única plataforma."
    },
    {
      "tipo": "texto",
      "tag": "01 — Introdução",
      "titulo": "A operação hoje ✱",
      "paragrafos": [
        "Hoje toda a operação vive em uma planilha mensal e em conversas soltas de WhatsApp. O novo sistema atende três usuários — um administrador e dois atendentes — e transforma esse fluxo em uma central operacional: cadastro, etapas, documentos, pendências, tarefas, mensagens e cobranças conectados."
      ],
      "stat": {
        "valor": "86,1%",
        "legenda": "dos registros aparecem como \"concluídos\" na planilha — mas sem etapas que expliquem onde os processos travam nem quem precisa agir."
      },
      "cards": [
        { "titulo": "3 usuários", "texto": "1 administrador e 2 atendentes, com permissões distintas e log de atividades." },
        { "titulo": "WhatsApp", "texto": "Cobrança e comunicação automatizadas, com controle humano e auditoria." },
        { "titulo": "1 plataforma", "texto": "Operação, financeiro e atendimento no mesmo lugar, no computador e no celular." }
      ]
    },
    {
      "tipo": "grafico",
      "tag": "02 — Diagnóstico",
      "titulo": "O que a planilha revela ()",
      "intro": "Analisamos as abas de janeiro a julho do arquivo PROCESSOS 2026.xlsx — cada linha é um registro operacional por placa.",
      "barras": [
        { "rotulo": "Processos com placa", "valor": "3.588", "pct": 100, "cor": "dark" },
        { "rotulo": "Sem atendente", "valor": "774", "pct": 22, "cor": "accent" },
        { "rotulo": "Parados em \"50%\"", "valor": "497", "pct": 14, "cor": "accent" },
        { "rotulo": "Com pendência", "valor": "417", "pct": 12, "cor": "dark" }
      ],
      "fonte": "Fonte: planilha PROCESSOS 2026.xlsx, abas jan–jul.",
      "fluxo": [
        { "valor": "965", "legenda": "placas aparecem mais de uma vez" },
        { "valor": "285", "legenda": "descrições diferentes de serviço em texto livre" },
        { "valor": "133", "legenda": "variações de nome de cliente e loja" }
      ],
      "destaque": "Status \"50% / 100%\" não explicam o que está acontecendo, cadastros e serviços não são padronizados e o financeiro vive fora da planilha — sem telefone, vencimento, cobrança ou pagamento."
    },
    {
      "tipo": "cards",
      "tag": "03 — Objetivo",
      "titulo": "O que o sistema resolve ✱",
      "cards": [
        { "titulo": "Organização", "texto": "Cada processo com dono, etapa, prazo, documentos e histórico completo — nada some, nada é esquecido.", "destaque": "8 etapas" },
        { "titulo": "Automação", "texto": "Cobrança e comunicação pelo WhatsApp com régua configurável, pausa automática e aprovação humana.", "destaque": "4 modelos" },
        { "titulo": "Visibilidade", "texto": "Dashboard e relatórios de produtividade, prazos, recebimentos e inadimplência.", "destaque": "10 módulos" }
      ],
      "rodape": "Proposta de valor: reduzir tarefas manuais, evitar processos esquecidos, padronizar o trabalho dos atendentes, melhorar a comunicação com lojas e clientes finais e acelerar o recebimento das cobranças."
    },
    {
      "tipo": "modulos",
      "tag": "04 — Escopo",
      "titulo": "O que o sistema entrega ✱",
      "intro": "Exatamente o que vocês pediram: substitui a planilha e automatiza o controle principal da operação.",
      "modulos": [
        { "titulo": "Acessos e perfis", "texto": "3 usuários — 1 administrador e 2 atendentes, cada um com as permissões certas." },
        { "titulo": "Clientes e lojas", "texto": "Cadastro centralizado, sem variações de nome espalhadas pela planilha." },
        { "titulo": "Veículos e serviços", "texto": "Cadastro de veículos e catálogo de serviços padronizado." },
        { "titulo": "Processos", "texto": "Abertura e acompanhamento com status claros e pendências registradas." },
        { "titulo": "Busca rápida", "texto": "Por placa, cliente, atendente e período — sem caçar linha em aba." },
        { "titulo": "Financeiro básico", "texto": "Controle de valores com cobranças pendentes, pagas e vencidas." },
        { "titulo": "Cobrança via WhatsApp", "texto": "Automática, com histórico das mensagens dentro do sistema." },
        { "titulo": "Dashboard básico", "texto": "Visão geral da operação assim que você entra." },
        { "titulo": "Migração e exportação", "texto": "Importação da planilha atual e exportação para Excel quando precisar." },
        { "titulo": "Computador e celular", "texto": "Sistema adaptado para uso no escritório e na rua." }
      ]
    },
    {
      "tipo": "listas",
      "tag": "05 — Diferencial",
      "titulo": "WhatsApp integrado ao processo ✱",
      "intro": "O coração do que vocês pediram: cada mensagem nasce vinculada a um cliente, processo ou cobrança — com histórico guardado dentro do sistema.",
      "colunas": [
        {
          "titulo": "Cobrança automática",
          "itens": [
            "Ao gerar → resumo, valor, vencimento e forma de pagamento.",
            "Antes do vencimento → lembrete configurável.",
            "No vencimento → aviso objetivo no dia.",
            "Após o vencimento → sequência gradual com limite.",
            "Pagamento identificado → interrompe tudo e confirma."
          ]
        },
        {
          "titulo": "Comunicação no contexto",
          "itens": [
            "Processo criado → confirma e envia código de acompanhamento.",
            "Documento faltante → solicita com instrução de envio.",
            "Pendência criada → informa motivo, responsável e prazo.",
            "Processo pronto → avisa disponibilidade e próximos passos.",
            "Histórico das mensagens → tudo registrado no processo."
          ]
        }
      ],
      "destaque": "Automação com controle humano: dá para pausar a régua por cliente, processo ou cobrança a qualquer momento — e nada é enviado em excesso."
    },
    {
      "tipo": "investimento",
      "tag": "06 — Investimento",
      "titulo": "Quanto custa →",
      "intro": "Sistema completo, com todo o escopo apresentado, em condição especial de parceria:",
      "precoDe": "R$ 11.900",
      "notaPreco": "Valor único do projeto, do briefing à entrega. Proposta válida até 10 ago 2026.",
      "condicoes": [
        { "titulo": "Garantia de 3 meses", "texto": "Manutenção e reparo do sistema inclusos após a entrega, sem custo extra." },
        { "titulo": "Pagamento facilitado", "texto": "Cartão de crédito ou Pix — como for melhor para vocês." },
        { "titulo": "Para começar", "texto": "Entrada de 30% (R$ 1.500) na aprovação. O saldo de R$ 3.500 fica para a entrega." }
      ],
      "rodape": "Prazo estimado: 30 dias úteis após a confirmação da entrada. Custos de terceiros — hospedagem e API oficial do WhatsApp — são contratados direto por vocês. Alterações fora do escopo são orçadas à parte."
    },
    {
      "tipo": "listas",
      "tag": "07 — Upgrades futuros",
      "titulo": "Como o sistema pode crescer ()",
      "intro": "O sistema entregue já resolve a operação de vocês. Quando quiserem ir além, ele evolui por módulo — sem refazer nada do que já foi construído.",
      "colunas": [
        {
          "titulo": "Gestão profissional",
          "itens": [
            "Checklist de documentos e etapas diferentes por tipo de serviço.",
            "Tarefas, lembretes, prazos e alertas de processo atrasado.",
            "Distribuição de processos entre atendentes e histórico de quem fez o quê.",
            "Fechamento semanal, quinzenal ou mensal agrupado por loja, com demonstrativo em PDF.",
            "Despesas e lucro por processo + relatórios por cliente, loja, serviço e atendente.",
            "Página de acompanhamento para o cliente e bloqueio de inadimplentes."
          ]
        },
        {
          "titulo": "Automação avançada",
          "itens": [
            "Portal completo para lojas parceiras e para o cliente final.",
            "Caixa de atendimento do WhatsApp dentro do sistema, com múltiplos atendentes.",
            "Abertura de processo pelo WhatsApp ou por formulário externo.",
            "Leitura automática de documentos por OCR — placa, CPF, Renavam e chassi.",
            "Inteligência artificial para resumir conversas, sugerir respostas e prever atrasos.",
            "Aplicativo PWA instalável, pesquisa de satisfação e integrações externas."
          ]
        }
      ],
      "destaque": "Nenhum upgrade é obrigatório e nenhum tem preço nesta proposta — cada módulo é orçado individualmente, quando fizer sentido para a operação."
    }
  ],
  "aprovacao": {
    "tag": "08 — Aprovação",
    "titulo": "Vamos tirar sua operação da planilha? ✱",
    "texto": "Ao aprovar, vocês garantem o valor de R$ 5.000 e todas as condições desta proposta. Em seguida liberamos o pagamento da entrada de 30% — R$ 1.500, via Pix ou cartão de crédito — para colocar o projeto em produção. Os upgrades podem ser contratados depois, módulo a módulo."
  },
  "posAceite": {
    "titulo": "Vamos ✱ começar",
    "banner": "A entrada de 30% — R$ 1.500, via Pix ou cartão — confirma o início do projeto.",
    "precoDe": "R$ 11.900",
    "notaPreco": "Valor fechado do projeto, com garantia de 3 meses de manutenção e reparo inclusa após a entrega.",
    "passos": [
      { "titulo": "Pagamento da entrada", "texto": "Confirma o início e reserva a agenda do projeto." },
      { "titulo": "Descoberta", "texto": "Entrevistas com o administrador e os dois atendentes, catálogo de serviços e validação do protótipo." },
      { "titulo": "Desenvolvimento", "texto": "Acompanhamento semanal com acesso de teste." },
      { "titulo": "Migração da planilha", "texto": "Importação de teste, conciliação dos totais e data de corte." },
      { "titulo": "Operação assistida", "texto": "Treinamento da equipe e período em paralelo com a planilha." },
      { "titulo": "Garantia de 3 meses", "texto": "Manutenção e reparo inclusos após a entrega; upgrades orçados à parte." }
    ],
    "rodape": "Garantia de 3 meses após a entrega"
  }
}
$deck$::jsonb
)
on conflict (id) do update set
  titulo = excluded.titulo,
  itens = excluded.itens,
  desconto = excluded.desconto,
  valor_total = excluded.valor_total,
  condicoes = excluded.condicoes,
  parcelas = excluded.parcelas,
  validade = excluded.validade,
  apresentacao = excluded.apresentacao;

select 'Proposta pronta: /proposta/c0ffee00-0004-4a00-8a00-000000000004' as link;
