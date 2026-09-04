# Link de bio da Vertix — `bio.vertix.studio`

Data: 2026-09-04
Status: aprovado no brainstorm, pronto para virar plano de implementação

## 1. Objetivo

Publicar um link de bio da Vertix em `bio.vertix.studio`: uma página única, leve, com
atalhos rápidos para o que a Vertix vende, editável pelo painel administrativo e com
medição de cliques por botão.

O que essa página tem que responder, na ordem: quem é a Vertix, o que ela faz por quem
chegou ali, e como falar com ela em um toque.

### Sucesso

- Um visitante que abre o link no celular consegue chamar no WhatsApp em um toque.
- Trocar a campanha do topo não exige deploy.
- No fim do mês dá para responder qual atalho trouxe cliente.

### Fora de escopo

Deliberadamente não entram nesta versão, por não servirem ao objetivo:

- Tema claro.
- Múltiplos perfis de bio (um por pessoa da equipe).
- Agendamento de publicação por data e hora além da janela simples de vigência.
- Página pública de estatísticas.
- Envio automático de mensagem pelo WhatsApp (exige API oficial e verificação da Meta).

## 2. Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Estrutura da página | Isca em destaque | O Vertix Scan já é a máquina de lead e captura nome e WhatsApp |
| Domínio | `bio.vertix.studio` | Curto, e o padrão de host público já existe no deploy |
| Hospedagem | Quarto host do deploy do vertix-admin | Acesso direto ao banco onde os botões vivem, sem proxy nem CORS, sem duplicar design |
| Destino dos atalhos | Misto | Loja e Sistemas viram conversa; Landing page e Projetos precisam de contexto antes |
| Edição do conteúdo | No painel, via banco | Campanha muda com frequência e não deve depender de deploy |
| Medição | Rastreio completo no banco | É o que justifica ter link próprio em vez de ferramenta pronta |

## 3. Arquitetura

### 3.1 Resolução por domínio

O painel já publica três domínios do mesmo deploy (`sistema`, `go`, `pay`) e decide o
que renderizar pelo nome do host. Existe uma lista de hosts públicos em
`src/lib/publicUrls.ts:14` e um resolvedor de host em `src/pages/public/HostToken.tsx:16`
que atende a rota `/:token`.

O bio difere dos outros dois hosts públicos em um ponto: ele não recebe token na URL.
A raiz `/` hoje renderiza o login (`src/App.tsx:110`). Por isso entra um resolvedor
irmão do que já existe, aplicado à raiz.

**Novo:** `src/pages/public/HostRoot.tsx`

- Se o host for `bio.vertix.studio`, renderiza a página do bio.
- Em qualquer outro host, renderiza o login exatamente como hoje.

**Alterações:**

- `src/App.tsx:110` — a rota `/` passa a apontar para `HostRoot` em vez de `Login`.
- `src/lib/publicUrls.ts` — adicionar `BIO_PUBLIC_BASE = 'https://bio.vertix.studio'` e
  incluir `bio.vertix.studio` em `PUBLIC_LINK_HOSTS`, para que o painel não tente rodar
  nesse host e para que a política de segurança seja aplicada separadamente.
- `vercel.json` — novo bloco de cabeçalhos com condição `has: [{type: host, value:
  bio.vertix.studio}]`, no mesmo formato do bloco que já existe para o host de pagamento,
  e exclusão desse host do bloco de política estrita do painel.

### 3.2 Peso da página

O ponto fraco desta hospedagem é o visitante baixar código do painel que não vai usar.
Mitigações obrigatórias:

- A página do bio entra por importação sob demanda (`lazy` + `Suspense`), para não vir
  no pacote inicial junto com o login.
- Nenhuma dependência nova. O que a página usa (React, roteador, cliente do banco,
  animação, ícones) já está no pacote.
- A primeira tela não espera o banco: enquanto os botões carregam, a marca e o esqueleto
  dos botões já aparecem.

Alvo: primeira pintura com conteúdo abaixo de 2 segundos em 4G.

### 3.3 Compartilhamento (limitação conhecida)

O deploy é uma aplicação de página única, sem renderização no servidor. As tags de
compartilhamento (título, descrição e imagem que aparecem ao colar o link no WhatsApp)
precisam estar no HTML servido, então não podem ser definidas em tempo de execução.

**Decisão:** colocar tags genéricas da Vertix em `index.html`, válidas para qualquer
host do deploy, com imagem própria. O conteúdo compartilhado do bio é sempre o mesmo,
então a limitação não custa nada na prática. Título e descrição da aba continuam sendo
ajustados em tempo de execução pela própria página.

## 4. Modelo de dados

Duas tabelas novas no banco do painel, seguindo a convenção das migrações existentes
(ver `supabase/migrations/20260830120000_lojas_apps.sql` como template): identificador
aleatório, `created_at` e `updated_at`, gatilho `public.set_updated_at()`, enumerações
por `check`, e políticas em português no formato `team <verbo> <tabela>`.

### 4.1 `bio_links`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid | chave primária |
| `rotulo` | text | texto do botão |
| `descricao` | text | linha secundária, opcional |
| `icone` | text | nome do ícone da biblioteca já usada no painel |
| `formato` | text | `destaque`, `largo` ou `grade` |
| `tipo_destino` | text | `url` ou `whatsapp` |
| `destino` | text | endereço, ou número quando o tipo for whatsapp |
| `mensagem` | text | texto pré-preenchido da conversa, opcional |
| `posicao` | int | ordem de exibição |
| `ativo` | boolean | liga e desliga |
| `inicia_em` | timestamptz | início da vigência, opcional |
| `termina_em` | timestamptz | fim da vigência, opcional |

O formato é o que dispensa uma tabela separada para a campanha do topo: `destaque` é o
card grande, `largo` ocupa a linha inteira, `grade` ocupa meia largura.

### 4.2 `bio_events`

Uma tabela só para visita e clique, porque as duas coisas têm as mesmas colunas e são
sempre lidas juntas no cálculo de taxa.

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid | chave primária |
| `tipo` | text | `visita` ou `clique` |
| `link_id` | uuid | referência ao botão, nulo quando for visita |
| `sessao` | text | identificador anônimo gerado no navegador |
| `utm_source`, `utm_medium`, `utm_campaign` | text | origem da campanha, opcionais |
| `created_at` | timestamptz | momento do evento |

Índices: `link_id`, `created_at`, e `(tipo, created_at)` para o resumo mensal.

### 4.3 Regras de acesso

Todas as tabelas do banco hoje exigem membro da equipe, via `public.is_team_member()`
(`supabase/migrations/20260712181535_nucleo_operacional.sql:109`). Quem abre o bio não
está logado, então:

**Leitura dos botões.** Política adicional para visitante anônimo em `bio_links`,
limitada aos registros ativos e dentro da vigência. Nenhuma coluna interna existe na
tabela, então não há vazamento.

**Escrita de evento.** Não há política de inserção para anônimo. O registro passa por
uma função no banco com privilégio elevado, `public.registrar_evento_bio(...)`, com
execução concedida a anônimo e autenticado. A função:

- Aceita apenas `visita` ou `clique`.
- Para clique, confere que o botão existe e está ativo.
- Recusa a inserção quando aquela sessão já gravou mais de 30 eventos na última hora.
- Não devolve nada além de sucesso.

O motivo de não abrir inserção direta: qualquer pessoa com a chave pública do navegador
poderia inflar os números e envenenar a decisão de qual atalho funciona. Existe
precedente do mesmo mecanismo no site institucional, que grava visita de campanha por
função em vez de escrita direta.

**Leitura de evento.** Só equipe. O visitante escreve e nunca lê.

## 5. Componentes

### 5.1 Página pública

```
src/pages/public/BioPage.tsx        # composição da página
src/components/bio/BioHeader.tsx    # logo, nome, frase
src/components/bio/BioButton.tsx    # um botão, nos três formatos
src/components/bio/BioSocial.tsx    # Instagram e e-mail
src/components/bio/bioData.ts       # leitura dos botões e envio de evento
src/components/bio/bioLinks.ts      # lógica pura: visibilidade, link final
```

Hooks e camada de dados ficam ao lado do módulo, que é a convenção do projeto (não há
pasta central de hooks em uso).

`bioLinks.ts` concentra o que é testável sem navegador:

- `linksVisiveis(links, agora)` — filtra por ativo e vigência, ordena por posição.
- `destinoFinal(link)` — devolve o endereço final, montando o link de conversa com
  número só de dígitos e mensagem codificada quando o tipo for whatsapp.
- `agrupaPorFormato(links)` — separa destaque, largos e grade para a renderização.

### 5.2 Módulo do painel

```
src/pages/Bio.tsx                       # página do módulo
src/components/bio-admin/BioLinksList.tsx    # lista com ordem e liga/desliga
src/components/bio-admin/BioLinkModal.tsx    # criar e editar
src/components/bio-admin/BioPreview.tsx      # prévia do celular
src/components/bio-admin/BioStats.tsx        # resumo de 30 dias
src/components/bio-admin/bioStats.ts         # lógica pura do resumo
```

Registro: importação e `<Route path="bio" element={<Bio />} />` dentro do bloco
protegido em `src/App.tsx`, mais uma entrada em `NAV_ITEMS`
(`src/components/layout/AdminLayout.tsx:28`).

O modal segue o padrão dos formulários existentes: estado controlado, validação por
esquema em `src/lib/schemas.ts`, portal, fecha no Escape, reseta ao abrir.

Ordenação por setas de subir e descer, que trocam a posição de dois registros. A
biblioteca de arrastar existe no projeto mas nunca foi usada para ordenar lista, e o
ganho não paga o risco aqui.

### 5.3 Resumo de 30 dias

`bioStats.ts` recebe os eventos e devolve, por botão: cliques, participação no total e
taxa sobre as visitas do período. Divisão por zero devolve nulo em vez de infinito, que
é o tratamento que o projeto já usa em métricas.

## 6. Conteúdo inicial

Frase de apresentação:

> Lojas Shopify que vendem e sistemas que resolvem. Somos Shopify Partners.

| Formato | Rótulo | Descrição | Destino | Ativo no dia um |
|---|---|---|---|---|
| destaque | Sua loja aguenta um scan? | Nota de 0 a 100 em 60 segundos, grátis | Vertix Scan | não, ver abaixo |
| largo | Falar no WhatsApp | Resposta no mesmo dia | Conversa, sem mensagem pronta | sim |
| grade | Loja Shopify | Do zero ou migração | Conversa, mensagem pronta | sim |
| grade | Sistemas | Sob medida | Conversa, mensagem pronta | sim |
| grade | Landing page | Pronta pra tráfego | `https://www.vertix.studio/#servicos` | sim |
| grade | Projetos | Cases recentes | `https://www.vertix.studio/#projetos` | sim |

**O destaque nasce desligado.** O Vertix Scan ainda não tem servidor publicado, então
apontar o card principal para ele hoje entregaria uma página que não analisa nada. O
registro entra na migração com `ativo` falso e endereço vazio. Quando o Scan subir,
basta preencher o endereço e ligar pelo painel, sem deploy. Até lá a página abre com o
botão de conversa no topo, que é o formato `largo` promovido a primeiro item.

Contatos confirmados: WhatsApp 62 99607-6194, Instagram @byvertix, e-mail
contato@vertix.studio. Não há LinkedIn, então o atalho não existe.

Os registros iniciais entram por migração de dados, não digitados à mão, para o
ambiente novo já subir com a página montada.

## 7. Testes

O projeto testa lógica pura isolada e não renderiza componente em teste unitário. A
estratégia acompanha isso.

**Unitários (Vitest):**

- `bioLinks.test.ts` — visibilidade com vigência aberta, fechada e futura; ordenação;
  montagem do link de conversa com número sujo e mensagem com acento; endereço comum
  passando intacto.
- `bioStats.test.ts` — taxa com zero visitas devolvendo nulo; participação somando cem
  por cento; período sem evento.
- `schemas.test.ts` — validação do formulário de botão: destino obrigatório, número
  válido quando o tipo for whatsapp, formato dentro dos três valores.

**Ponta a ponta (Playwright):** um roteiro que abre a raiz simulando o host do bio,
confere que os botões aparecem na ordem, clica no de conversa e verifica o endereço
gerado. A suíte já roda com autenticação preparada e um trabalhador só.

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Visitante baixa código do painel | Importação sob demanda e nenhuma dependência nova |
| Inflar cliques | Escrita só por função protegida, com limite por sessão |
| Abrir leitura anônima cedo demais | Política restrita a botões ativos, tabela sem coluna interna |
| Botão apontando para lugar errado depois de editar | Prévia no painel antes de publicar |
| Tipos do banco desatualizados | Regenerar os tipos após a migração; o comando não está versionado no projeto |

## 9. Dependências externas

Fora do código, precisam acontecer para o link ficar no ar:

1. Apontar `bio.vertix.studio` para o projeto na Vercel e emitir o certificado.
2. Aplicar a migração no banco de produção.
3. Regenerar os tipos do banco.

## 10. Ordem de construção sugerida

1. Migração das tabelas, políticas e função de evento, com os registros iniciais.
2. Lógica pura e seus testes.
3. Página pública e resolução por host, incluindo cabeçalhos na Vercel.
4. Módulo do painel: lista, modal, ordenação, liga e desliga.
5. Prévia e resumo de 30 dias.
6. Roteiro de ponta a ponta.
