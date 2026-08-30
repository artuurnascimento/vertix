# Vertix Apps — Distribuição privada multi-loja com Vertix como console

**Data:** 2026-08-30
**Status:** aprovado (design)
**Escopo:** vybe-recover (Fly), reviews-app (Railway), vertix-admin (Supabase + React)

## Objetivo

Transformar os apps Shopify da casa (recuperação de carrinho e avaliações) em
produtos instaláveis em lojas de clientes, com distribuição privada (sem App
Store), operados pelo cliente no admin da Shopify e supervisionados/cobrados
pela agência através do Vertix Admin.

## Decisões de negócio (fixadas com o usuário)

| Decisão | Valor |
|---|---|
| Escala 6–12 meses | 10 a 30 lojas |
| Distribuição | Custom app por loja (Partner Dashboard, sem review) |
| Operação diária | Cliente opera no admin Shopify; Vertix supervisiona |
| Custos de envio | Cliente usa as próprias chaves Twilio/Resend |
| Cobrança | Mensalidade por loja/produto, faturada pelo Vertix |
| Marca | Vertix Recover e Vertix Reviews |
| Escopo v1 | Os dois apps desde o início (Recover primeiro na ordem de execução) |
| Arquitetura | A — backends independentes + contrato padronizado + Vertix como console |

## Arquitetura

```
                    VERTIX ADMIN (Supabase + React)
        ┌───────────────┬──────────────────┬─────────────────┐
        │ módulo Lojas  │ Financeiro       │ Portal cliente  │
        └───────┬───────┴──────────────────┴─────────────────┘
                │ Edge Function (proxy autenticado; guarda tokens de serviço)
       ┌────────┴─────────┐
       ▼                  ▼
 VERTIX RECOVER      VERTIX REVIEWS        ← mesma API /api/vertix/*
 (Fly, Remix)        (Railway)               mesmo kit multi-tenant
       ▼                  ▼
   Shopify das lojas dos clientes (custom app por loja)
```

Cada app permanece na sua stack. Os dois implementam o mesmo contrato (kit
multi-tenant + API de serviço), de modo que o Vertix os enxerga como produtos
idênticos e uma futura unificação de backends permanece possível.

### Alternativas descartadas

- **B — Plataforma unificada** (fundir os dois backends antes do primeiro
  cliente): migração grande, semanas sem validação, armadilhas de build do
  Reviews contaminariam o Recover.
- **C — Supabase como cérebro central** (apps leem config do Supabase): acopla
  o caminho de envio ao deploy do Supabase (inexistente hoje), ponto único de
  falha, refatoração dupla simultânea.

## Distribuição e provisionamento

Fluxo por cliente novo:

1. Criar custom app na organização Shopify Partners **da Vertix** (manual, ~5
   min) apontando para a URL do backend do produto.
2. Solicitar acesso a **Protected Customer Data** (telefone/e-mail) no Partner
   Dashboard — self-service, 1–2 dias; pedir no dia da venda.
3. Registrar credenciais pela tela de provisionamento no Vertix
   (`POST /api/vertix/provision` no app correspondente): domínio da loja,
   client_id, client_secret.
4. Enviar link de instalação ao cliente.
5. Cliente instala e completa o wizard de onboarding.

### Credenciais dinâmicas (engenharia central)

O template Remix da Shopify assume um único client_id. Com um custom app por
loja, cada app ganha:

- Tabela `AppCredential`: `shopDomain` (único), `clientId`, `clientSecret`
  (criptografado), timestamps.
- Instanciação da config Shopify **por credencial**, com cache por client_id;
  roteamento pelo `shop` presente em OAuth, requisições embutidas e webhooks.
- Validação de HMAC de webhook contra o secret registrado para aquela loja.

Feito uma vez no Recover; copiado no Reviews.

## Kit multi-tenant (idêntico nos dois apps)

1. **Chaves por loja:** Twilio e Resend saem do env global e viram campos do
   `ShopSettings`, criptografados com AES e chave-mestra em variável de
   ambiente. Migração move as chaves atuais para as linhas das lojas Vybe
   (comportamento atual preservado).
2. **Onboarding embutido:** wizard na primeira abertura — idioma → desconto →
   remetente/logo → chaves Twilio/Resend com teste de envio real → ativação.
   Sem chave validada, automações permanecem desligadas e o app exibe a
   pendência exata. Os checks existentes (`checkSmsSender`,
   `checkVerifiedSender`) tornam-se gates do wizard.
3. **Marca:** rename para Vertix Recover / Vertix Reviews em UI, e-mails
   padrão e landing.
4. **Medição por loja:** tabela `UsageEvent` (`shop`, `tipo`, `quantidade`,
   `valor`, `ocorridoEm`) com tipos `sms_enviado`, `email_enviado`,
   `receita_recuperada`, `review_coletada`. Finalidade: relatório de ROI e
   portal do cliente (não repasse de custo — a chave é do cliente).

## API de serviço `/api/vertix/*`

Mesmo contrato nos dois apps. Autenticação: `Authorization: Bearer <token>`
com token de serviço em env de cada app; somente a Edge Function do Supabase
conhece os tokens (nunca o front do Vertix).

| Rota | Método | Função |
|---|---|---|
| `/api/vertix/health` | GET | app no ar, versão, contagem de lojas ativas |
| `/api/vertix/shops` | GET | lojas instaladas + status (chaves ok, automação, última atividade) |
| `/api/vertix/shops/:shop/stats` | GET | métricas do período (envios, cliques, recuperados, receita) |
| `/api/vertix/shops/:shop/settings` | GET/PATCH | ver e ajustar configuração remotamente |
| `/api/vertix/provision` | POST | registrar credencial de custom app |

## Lado Vertix

- **Pré-requisito:** deploy do Supabase em projeto real (auth + Edge
  Functions). Hoje o vertix-admin roda com Supabase local.
- **Tabelas novas:** `lojas` (domínio, FK cliente do CRM, plano, status),
  `loja_apps` (loja × produto, status do provisionamento), espelho leve de
  métricas para dashboards.
- **Edge Function `apps-proxy`:** valida sessão Supabase do usuário, roteia
  para o backend certo (Recover/Reviews) com o token de serviço, aplica os
  limites de acesso. Resolve também CORS.
- **Módulo "Lojas":** lista com semáforo (verde ok · amarelo chave/domínio
  pendente · vermelho app fora), detalhe por loja com métricas dos dois
  produtos, edição de configurações e tela de provisionamento.
- **Financeiro:** mensalidade por loja/produto como lançamento recorrente no
  módulo existente; relatório mensal de ROI (receita recuperada × mensalidade).
- **Portal do cliente (última fase):** cliente autenticado vê métricas da
  própria loja.

## Segurança

- Segredos de cliente (client_secret, chaves Twilio/Resend) criptografados em
  repouso; chave-mestra por app em env, fora do banco.
- Tokens de serviço da API `/api/vertix/*` conhecidos apenas pelos apps e pela
  Edge Function; front do Vertix nunca os vê.
- Provisionamento e supervisão exigem sessão Supabase de usuário da agência;
  portal do cliente enxerga somente a(s) loja(s) vinculada(s) a ele.

## Fases e critérios de pronto

| Fase | Entrega | Critério de pronto |
|---|---|---|
| 1 | Kit multi-tenant no Recover (credenciais dinâmicas, chaves por loja, onboarding, rename, metering, API) | Loja de teste instala via custom app novo e dispara SMS/e-mail com chaves próprias |
| 2 | Mesmo kit no Reviews (portar padrão; resolver builds do Railway) | Idem, com coleta de review funcionando |
| 3 | Supabase em produção + módulo Lojas + provisionamento | Provisionar e supervisionar uma loja sem tocar em terminal |
| 4 | Piloto com 1–2 clientes reais | Cliente instalou e configurou chaves sozinho; primeira fatura emitida |
| 5 | Portal do cliente + lançamentos recorrentes | Cliente vê ROI; cobrança mensal sem ação manual |

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Protected Customer Data demora | Pedir no provisionamento (dia da venda), não no go-live |
| Chaves do cliente geram suporte | Wizard com teste real + semáforo no Vertix apontando a causa exata |
| Armadilhas de build do Reviews | Confinadas à Fase 2; nenhuma outra fase depende dela |
| Conta Partners errada | Todos os custom apps nascem na organização Vertix; conferir login antes do 1º provisionamento |
| Billing API indisponível (custom app) | Cobrança 100% via Vertix Financeiro — já decidido |

## Testes

- **Fase 1–2:** loja de desenvolvimento instala pelo fluxo real (custom app +
  wizard); envio de SMS/e-mail de ponta a ponta com chaves de teste; webhooks
  validados com secret por loja; testes unitários das partes puras
  (criptografia, lookup de credencial, medição).
- **Fase 3:** provisionar loja fictícia pelo Vertix; semáforo reflete estados
  forçados (chave inválida, domínio não verificado, app derrubado).
- **Fase 4 (piloto):** métrica de sucesso = cliente completa o wizard sem
  suporte por chamada de vídeo.
