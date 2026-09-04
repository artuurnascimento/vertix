# Plano de implementação — link de bio `vertix.bio`

Data: 2026-09-04
Especificação: `docs/superpowers/specs/2026-09-04-bio-vertix-design.md`
Projeto: `/Users/arturnascimento/claude/vertix-admin`

Cada fase é autocontida: pode ser executada numa sessão nova, tem suas próprias
referências de código para copiar, sua verificação e suas armadilhas.

---

## Fase 0 — Padrões descobertos (leia antes de qualquer fase)

Descoberta feita em 2026-09-04 sobre o código real. Tudo aqui foi verificado, nada é
suposição. **Copie destes lugares em vez de inventar.**

### 0.1 APIs e padrões permitidos

| O que | Onde copiar | Observação |
|---|---|---|
| Estrutura de migração | `supabase/migrations/20260830120000_lojas_apps.sql` | Cabeçalho `=`, seções numeradas, separadores `-` |
| Gatilho de data | `public.set_updated_at()`, criado em `20260712181535_nucleo_operacional.sql:90` | Só reusar, nunca redefinir |
| Regra de equipe | `public.is_team_member()`, `20260712181535_nucleo_operacional.sql:109` | `to authenticated` sempre |
| Função pública | `public.track_utm_visit`, `20260714100001_utm_tracking.sql:91-138` | Modelo exato de `security definer` |
| Limite por sessão | `20260728120002_rate_limits.sql:197-222` | `pg_advisory_xact_lock` + retorno silencioso |
| Chamada de função no front | `src/pages/public/NpsSurvey.tsx:82` | `supabase.rpc(...)` com `retry: false` |
| Modal e formulário | `src/components/clients/ClientFormModal.tsx` (arquivo inteiro) | Portal, Escape, reset, foco no erro |
| Esquema de validação | `src/lib/schemas.ts` | zod v4: `z.email()`, `z.uuid()`, `{ error: ... }` |
| Página de listagem | `src/pages/Lojas.tsx:52`, `:88`, `:132` | Consulta, cabeçalho, esqueleto, vazio |
| Casca de página pública | `src/pages/public/NpsSurvey.tsx:20-35` | `Shell` com fundo e marca |
| Link de conversa | `src/components/ui/whatsapp.ts` | `normalizePhoneBR` e `buildWhatsAppLink` já existem |
| Teste de lógica pura | `src/components/trafego/adMetrics.test.ts` | Fábrica de dado, nomes em português |
| Teste ponta a ponta | `e2e/clients.spec.ts` | Seletores por papel e rótulo, nunca por classe |

### 0.2 Anti-padrões (não faça)

- **Não crie política para visitante anônimo.** Zero existem no schema principal. O
  padrão está escrito em `20260713050001_fase8_leads.sql:22`: banco bloqueado, acesso
  público só por função com privilégio elevado.
- **Não escreva os esquemas com a API antiga do zod.** O projeto usa zod 4:
  `z.email()` e `z.uuid()` são funções de topo, e a opção de mensagem é `error`, não
  `message`.
- **Não crie utilitário novo de telefone.** `src/components/ui/whatsapp.ts` já
  normaliza número brasileiro e monta o link.
- **Não misture `it()` e `test()` no mesmo arquivo.** Os dois existem no projeto,
  mas cada arquivo escolhe um.
- **Não toque em `vercel.json`.** O bio herda a política estrita. Mexer ali é risco sem
  ganho.
- **Não confie em geração automática de tipos.** `src/lib/database.types.ts` é mantido à
  mão neste projeto, sem script registrado. Ver fase 1.
- **Não use identificador de teste no elemento.** Nenhum existe; os testes selecionam por
  papel acessível.

### 0.3 Ambiente

CLI do Supabase 2.75.0 e Docker disponíveis, então a migração pode ser validada
localmente antes de ir para produção. Servidor de desenvolvimento na porta 5175
(`.claude/launch.json`). Sem verificação automática antes de commit: rodar as
verificações à mão.

---

## Fase 1 — Banco

### O que implementar

Criar `supabase/migrations/20260904120000_bio_links.sql`, copiando a estrutura de
`20260830120000_lojas_apps.sql`:

1. Cabeçalho comentado explicando o porquê do módulo e a decisão de acesso público.
2. Tabelas `bio_links` e `bio_events`, campos conforme a seção 4 da especificação.
3. Índices: `bio_links(posicao)`, `bio_events(link_id)`, `bio_events(tipo, created_at desc)`.
4. Gatilho de data em `bio_links`, reusando a função existente.
5. RLS ligada nas duas, com as quatro políticas de equipe em `bio_links` e apenas a de
   leitura em `bio_events` (o time audita, ninguém edita evento à mão).
6. `public.get_bio_links()`, com privilégio elevado, devolvendo os botões ativos e
   vigentes ordenados por posição.
7. `public.registrar_evento_bio(...)`, com privilégio elevado, validando tipo e sessão,
   travando por sessão e devolvendo silêncio quando passar de 30 eventos por hora.
8. Revogar execução de `public` e conceder a `anon` e `authenticated`, nas duas funções.
9. Registros iniciais conforme a seção 6 da especificação, com o card de destaque
   desligado.

Depois, acrescentar as duas tabelas e as duas funções em `src/lib/database.types.ts`,
copiando o formato dos blocos `lojas` e `loja_apps` que já estão no arquivo. Se preferir
gerar, rode por fora e confira o resultado antes de salvar, porque não há script
versionado e o arquivo está mantido à mão.

### Verificação

```bash
cd /Users/arturnascimento/claude/vertix-admin && supabase start && supabase db reset
```

Depois, contra o banco local:

- A função de leitura devolve cinco botões, sem o destaque desligado.
- Chamada com identificador de sessão curto é recusada.
- Trigésimo primeiro evento na mesma hora volta sem gravar.
- Consulta direta à tabela com a chave pública é negada.

### Armadilhas

- Assinatura completa nos comandos de revogar e conceder, com todos os tipos, como em
  `20260714100001_utm_tracking.sql:136`.
- `set search_path = public` nas duas funções.
- Migração nunca é editada depois de aplicada em produção; erro vira migração nova.

---

## Fase 2 — Lógica pura e testes

### O que implementar

`src/components/bio/bioLinks.ts` com `linksVisiveis`, `destinoFinal` e
`agrupaPorFormato`, e em `src/lib/publicUrls.ts` a função `ehHostBio(hostname)` recebendo
o host por argumento.

`destinoFinal` chama `buildWhatsAppLink` de `src/components/ui/whatsapp.ts` quando o tipo
for conversa. Não reimplemente.

Testes espelhando `src/components/trafego/adMetrics.test.ts`: fábrica de botão com
`Partial`, nomes em português, um `describe` por função.

### Verificação

```bash
cd /Users/arturnascimento/claude/vertix-admin && npm test
```

Casos que precisam existir: vigência aberta, futura e vencida; ordenação por posição;
número sujo virando link; mensagem com acento codificada; endereço comum intacto;
`ehHostBio` verdadeiro só para o host exato.

### Armadilhas

- Nada de acesso ao navegador nestes arquivos. Se precisar do host, receba por argumento.
- Botão inativo nunca aparece, mesmo dentro da vigência.

---

## Fase 3 — Página pública

### O que implementar

- `src/pages/public/BioPage.tsx`, casca copiada de `NpsSurvey.tsx:20-35`.
- `src/components/bio/BioHeader.tsx`, `BioButton.tsx`, `BioSocial.tsx`.
- `src/components/bio/bioData.ts`, com a consulta via `supabase.rpc('get_bio_links')` no
  padrão de `NpsSurvey.tsx:82`, e o envio de evento com sessão guardada no navegador,
  sempre protegido, sem esperar resposta, no espírito de `vertix-site/src/lib/vtx.ts`.
- `src/pages/public/HostRoot.tsx`, decidindo por `ehHostBio`.
- `src/App.tsx`: rota `/` apontando para o resolvedor, rota `/bio` explícita, e a página
  do bio entrando por importação sob demanda.
- `src/lib/publicUrls.ts`: novo endereço público e o host na lista.
- `index.html`: descrição e tags de compartilhamento genéricas da Vertix.
- Um utilitário simples para título da aba, já que nenhuma página define isso hoje.

Visual conforme o desenho aprovado: card de destaque, botão de conversa em linha inteira,
grade de dois por dois, contatos e rodapé. Cores e fonte vêm de `tailwind.config.js`.

### Verificação

Servidor na 5175, abrir a rota do bio, e conferir: botões na ordem, conversa abrindo com
o número certo, evento de visita gravado uma vez só, recarregar não duplica. Medir o peso
do pacote inicial e confirmar que a página do bio veio em pedaço separado.

### Armadilhas

- Medição nunca derruba a página: erro na gravação é engolido.
- Um evento de visita por sessão, controlado por chave própria como em `vtx.ts:68`.
- Links externos abertos com proteção de janela.

---

## Fase 4 — Módulo no painel

### O que implementar

`src/pages/Bio.tsx` e `src/components/bio-admin/` com lista, modal, ordenação por setas,
liga e desliga. Registro em `src/App.tsx` dentro do bloco protegido, e **duas** entradas
no menu: `NAV_ITEMS` e `SECTION_TITLES` em `src/components/layout/AdminLayout.tsx:28` e
`:46`. Esquecer a segunda deixa a página sem título no cabeçalho.

Esquema de validação em `src/lib/schemas.ts`, no estilo do que já está lá.

### Verificação

Criar, editar, reordenar, desligar e excluir pelo painel, conferindo que a página pública
reflete cada mudança. Testes verdes, tipos limpos, lint limpo.

### Armadilhas

- Invalide a consulta certa depois de cada alteração, senão a lista não atualiza.
- Reordenar troca a posição de dois registros, sem renumerar a lista toda.

---

## Fase 5 — Prévia e resumo

Prévia do celular ao lado da lista, reusando os mesmos componentes da página pública, e
resumo de trinta dias com `bioStats.ts` mais testes. Divisão por zero devolve nulo e a
tela mostra travessão, como em `src/components/trafego/adMetrics.ts:68`.

---

## Fase 6 — Verificação final

1. Testes, tipos, lint, e a suíte ponta a ponta com o servidor no ar.
2. Roteiro novo entrando pela rota do bio, no padrão de `e2e/clients.spec.ts`.
3. Conferir que nenhuma política para visitante anônimo foi criada:
   `grep -rn "to anon" supabase/migrations/` deve continuar mostrando só o caso de
   arquivos em `20260713050007_fase14_arquivos.sql`.
4. Conferir que `vercel.json` não foi alterado.
5. Medir o pacote e confirmar o pedaço separado da página pública.

## Fora do código

1. Apontar o domínio para o projeto na Vercel e emitir certificado.
2. Aplicar a migração em produção.
3. Conferir a página no ar pelo celular, em rede móvel.
