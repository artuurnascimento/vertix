# PLANO DE IMPLEMENTAÇÃO — Secure Fields + cartão 3D no checkout Vertix

Base: `/Users/arturnascimento/claude/vertix-admin`. Tudo verificado no código em 2026-09-08.

---

## 0. VEREDITO HONESTO

**Fazer. Mas não pelo motivo que foi pedido, e não sem as três travas abaixo.**

### Nenhum risco do levantamento 4 é bloqueante — todos se dissolvem sob apuração

| Risco | Veredito | Fonte |
|---|---|---|
| PCI SAQ A → A-EP | **Falso.** Secure Fields = Checkout Transparente = SAQ A, igual ao Brick | Tabela oficial em [PCI Compliance, Checkout API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/additional-content/security/pci) — "Checkout Transparente → A" |
| Perda do device fingerprint | **Falso.** Vem do SDK v2, não do Brick. Os dois carregam `https://sdk.mercadopago.com/js/v2` (`src/components/checkout/mpSdk.ts:8`) | "If you are already using the Mercado Pago JS SDK, you do not need to add the security code because the Device ID is obtained by default" — [improve-payment-approval](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/how-tos/improve-payment-approval) |
| Brick trata o challenge de 3DS | **Falso duas vezes.** 3DS está desligado (`three_d_secure_mode` tem **zero** ocorrências no repositório) e, mesmo ligado, o Brick exige integrar o Status Screen Brick à mão | [integrate-3ds, Bricks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/how-tos/integrate-3ds) |
| MP recomenda preferir Bricks | **Não existe tal recomendação.** A [overview de Bricks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/overview) apresenta Bricks/API/Pro como alternativas equivalentes em segurança | — |
| Autofill | **Único risco não fechado.** Depende de o Brick usar 1 ou 3 iframes. Verificação de 10 minutos, obrigatória na Fase 0 | [Chromium, autofill-across-iframes](https://chromium.googlesource.com/chromium/src/+/refs/tags/124.0.6367.205/docs/security/autofill-across-iframes.md) |

### O risco real é financeiro e está no código, não na regulação

**Três bugs de dinheiro que a migração pode causar. Todos silenciosos — nada quebra, nada loga, a venda passa errada.**

1. **`supabase/functions/checkout-pagar/index.ts:494` — `pagamento.installments = formData.installments ?? 1`.** Se o formulário novo não colocar `installments` dentro de `formData`, o cliente escolhe 12x na tela e é cobrado à vista. Sem erro, sem log. Estorno provável.

2. **O upsell de 1 clique morre se o segundo token sumir.** `src/components/checkout/mpSdk.ts:44-66` (`gerarTokenParaSalvar`) usa `getFormData()` do Brick, que deixa de existir. Sem ele, `checkout-pagar` não grava `mp_customer_id`/`mp_card_id`, e `supabase/functions/checkout-upsell/index.ts:189` recusa toda venda de upsell. Receita direta perdida.

3. **O documento passa a ser obrigatório no cartão, e hoje não é.** `createCardToken` para cartão novo exige `cardholderName` + `identificationType` + `identificationNumber` (`nonPCIData`, doc `fields.md`), e os 4 métodos de crédito BR retornam `additional_info_needed: ["cardholder_identification_number","cardholder_identification_type","cardholder_name"]`. Hoje `src/components/checkout/DadosCliente.tsx:83` rotula o documento como **"(opcional)"** quando `exigeDocumento === false`. Quem deixar em branco vai bater em erro `214`/`324` na tokenização e não vai conseguir comprar. Isso é **mudança de produto**, não de implementação.

### As três travas inegociáveis

1. **Feature flag desde o primeiro commit.** O Brick fica vivo, servindo 100% do tráfego, até o rollout terminar. Nada é apagado nesta migração.
2. **`installments` sempre explícito**, com guarda que aborta o submit se não for inteiro ≥ 1. Nunca confiar no `?? 1` do servidor.
3. **Segundo token verificado antes de escrever o resto.** Se `createCardToken` não puder ser chamado duas vezes seguidas (pendência #4 do item 10), o plano do upsell muda e isso precisa ser sabido no dia 1, não no dia 10.

### Sobre o cartão 3D — ajuste de expectativa antes de prometer

O componente que o dono gostou provavelmente espelha **os dígitos digitados**. **Isso é impossível aqui.** Número, validade e CVV vivem dentro de iframes do Mercado Pago e nenhum evento devolve o valor — `focus`, `blur`, `change` e `paste` carregam só `{ field: string }` (registro de eventos extraído do bundle `mpv2.js`). O único dígito que vaza é o BIN, e só quando o número inteiro fica válido.

O cartão 3D é viável e bonito, mas alimentado por: **nome do titular** (input nosso, ao vivo), **bandeira** (do BIN), **BIN parcial**, **campo focado** e **válido/inválido por campo**. Detalhe no item 7. Se o dono espera ver o número aparecendo dígito a dígito, essa conversa tem que acontecer **antes** de a Fase 2 começar.

---

## 1. DECISÕES DE PRODUTO — resolver antes de codar

Bloqueiam a Fase 1. São perguntas para o dono, não para o agente.

| # | Pergunta | Recomendação |
|---|---|---|
| 1 | Documento vira obrigatório no cartão. OK? | Sim — sem ele não há tokenização. Rotular "CPF ou CNPJ" sem "(opcional)" quando o método é cartão |
| 2 | Parcela default no select | **1x.** Default alto infla o ticket percebido e esconde juros |
| 3 | Ligar "parcelado vendedor" até 3x no painel do MP? | Recomendo sim. Hoje a conta é "parcelado comprador": 12x de R$ 197 → cliente paga **R$ 240,56** (medido ao vivo, `installment_rate: 22.11`). Com Pix a 10%, a distância na tela vira R$ 177,30 × R$ 240,56 |
| 4 | O cartão 3D não mostra o número digitado. OK? | Ver item 7 |
| 5 | Máximo de parcelas | Sem teto: usar o que o MP oferecer por BIN. Dois Visa da mesma conta deram 18x e 1x — não dá para hardcodar |

---

## 2. ARQUITETURA — propriedade de arquivo por agente

Regra de ouro para trabalho paralelo: **nenhum agente edita arquivo de outro.** Um arquivo, um dono. Integração só na Fase 3.

### 2.1 Arquivos NOVOS

Todos em `/Users/arturnascimento/claude/vertix-admin/`.

**Agente A — camada SDK (sem React, sem JSX)**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/campos/mpTipos.ts` | Tipos: `CampoSeguro`, `EventoPadrao`, `EventoBin`, `EventoValidade`, `CardTokenResponse`, `PayerCost`, `OfertaParcelas`, `MetodoPagamentoMp`, `SettingsCartao` |
| `src/components/checkout/campos/mpInstancia.ts` | Instância única do `MercadoPago` por página (memoizada em módulo). **Reusa `carregarMpSdk()` de `../mpSdk`** — não criar um terceiro loader (já existem dois: `mpSdk.ts:95` e `upsell/cardToken.ts:74`). Lê a public key com override de env |
| `src/components/checkout/campos/mpCampos.ts` | `criarCampos()`, `montar()`, `desmontarTudo()`, `atualizarSettings()`, `criarToken()`. Estilos e `customFonts`. Todo `unmount()` em `try/catch` individual |

**Agente C — parcelamento (puro + hook)**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/campos/parcelamento.ts` | `mapearOpcoes(oferta)`, `escolherPadrao()`, `OPCAO_AVISTA` (fallback). Zero React, zero rede |
| `src/components/checkout/campos/parcelamento.test.ts` | Unit |
| `src/components/checkout/campos/useParcelamento.ts` | Hook: dispara em `(bin, totalCentavos)`, debounce, cancelamento, fallback |

**Agente D — erros**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/campos/errosCampos.ts` | `mensagemDeValidade(cause, campo)`, `extrairCodigos(erro)`, `campoDoCodigo(codigo)`, `mensagemDeToken(erro)`. Puro |
| `src/components/checkout/campos/errosCampos.test.ts` | Unit, um caso por código |

**Agente B — ciclo de vida React**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/campos/useCamposCartao.ts` | Monta/desmonta os 3 campos (StrictMode-safe), estado por campo (`pronto`/`focado`/`valido`/`erro`), `bin`, `bandeira`, `settings`, `gerarTokens()` |

**Agente F — cartão 3D (isolado, props puras, zero SDK)**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/CartaoTresD.tsx` | O cartão. Props puras, `aria-hidden` |
| `src/components/checkout/cartao3d.css` | Perspectiva, giro, brilho, `prefers-reduced-motion` |

**Agente G — botão e Pix**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/BotaoPagar.tsx` | Botão nosso, classe `.vtx-btn-pagar`, estado processando |
| `src/components/checkout/botaoPagar.css` | Skin **copiado** (não movido) do bloco `#payment-brick button[type='submit']` de `src/index.css:161-253` |
| `src/components/checkout/PagamentoPix.tsx` | Painel de Pix sem Brick |

**Agente E — montagem**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/FormularioCartao.tsx` | Containers dos 3 campos, input de titular, select de parcelas, mensagens |
| `src/components/checkout/PagamentoCartao.tsx` | Orquestrador: monta o `formData` e chama `onSubmit` |
| `src/components/checkout/formDataCartao.ts` | Função pura que monta o payload do contrato |
| `src/components/checkout/formDataCartao.test.ts` | Unit — **o teste que impede o bug do `?? 1`** |

**Agente H — flag e integração**
| Arquivo | Conteúdo |
|---|---|
| `src/components/checkout/flagFormularioNovo.ts` | Leitura da flag |

### 2.2 Arquivos que MUDAM (só na Fase 3, um dono)

| Arquivo | Mudança | Dono |
|---|---|---|
| `src/components/checkout/SecaoPagamento.tsx` | Escolhe entre `<PagamentoBrick>` e `<PagamentoCartao>`/`<PagamentoPix>` pela flag. O wrapper `.vtx-checkout` permanece | H |
| `src/pages/public/CheckoutPage.tsx` | Duas linhas: `validarCliente(cliente, checkout.exigeDocumento \|\| metodo === 'cartao')` (linha 219) e o mesmo booleano em `exigeDocumento={...}` (linha 402) | H |
| `src/components/checkout/campos/mpInstancia.ts` | A env de teste é `VITE_MP_PUBLIC_KEY_SF`, LOCAL a este caminho. **NÃO** dar override na chave do `checkoutApi`: ela é lida pelo Brick, que serve todo o tráfego — uma `TEST-...` ali recusa todo cartão real, e `?sf=0` não resgata porque env é do build | A |
| `src/index.css` | **Só acrescentar** `@import` do `botaoPagar.css` e do `cartao3d.css`, ou os blocos no fim do arquivo. **Ninguém toca as linhas 91-338** | G |

### 2.3 NÃO TOCAR

- `src/components/checkout/PagamentoBrick.tsx` — está vendendo
- `src/index.css` linhas 91-338 — o CSS do Brick e do bug `da0243c`
- `src/components/checkout/mpSdk.ts` — continua servindo o Brick
- `src/components/checkout/checkoutTotal.ts` — **juros nunca entram no total**
- `supabase/functions/**` — nada muda no backend
- `src/components/upsell/**` — caminho paralelo, sem acoplamento de código

### 2.4 APAGAR — só depois do rollout (PR separado)

`PagamentoBrick.tsx`, `gerarTokenParaSalvar`/`extrairToken`/`BrickController` de `mpSdk.ts`, `index.css:91-338`, e o `abrirMetodoUnico`/`data-metodo-embutido` junto.

---

## 3. A API EXATA

Fontes: `D` = [sdk-js/docs/fields.md](https://raw.githubusercontent.com/mercadopago/sdk-js/main/docs/fields.md), `B` = bundle `https://sdk.mercadopago.com/js/v2`, `C` = [docs pt-BR](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/card/integrate-via-core-methods).

### 3.1 Criar e montar (D, "FIELD HELPERS")

Três campos. `expirationDate` (um só), **nunca junto com `expirationMonth`/`expirationYear`** — o SDK lança `"field cardExpirationDate cannot coexist with cardExpirationMonth or cardExpirationYear"` (código `"XXX"`, extraído de B).

```ts
const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })

const ESTILO = {
  color: '#F4F4F0',
  fontSize: '18px',
  fontFamily: 'Kanit',
  placeholderColor: '#8A8A82',
  height: '100%',
  padding: '0px',
}
const FONTES = [{ src: 'https://fonts.googleapis.com/css2?family=Kanit:wght@400;600' }]

const numero = mp.fields.create('cardNumber', {
  placeholder: '0000 0000 0000 0000',
  style: ESTILO, customFonts: FONTES,
  srLabel: 'Número do cartão', ariaRequired: true,
}).mount('vtx-campo-numero')

const validade = mp.fields.create('expirationDate', {
  placeholder: 'MM/AA', style: ESTILO, customFonts: FONTES,
  srLabel: 'Validade do cartão', ariaRequired: true,
}).mount('vtx-campo-validade')

const cvv = mp.fields.create('securityCode', {
  placeholder: '•••', style: ESTILO, customFonts: FONTES,
  srLabel: 'Código de segurança', ariaRequired: true,
}).mount('vtx-campo-cvv')
```

**Regras que o SDK impõe (todas verificadas em B):**
- `mount()` recebe o **id como string**, não elemento nem seletor. Lança se `document.getElementById()` for `null`.
- `mount()` lança `already mounted`; `unmount()` lança `Field '<tipo>' already unmounted`. Em React 19 StrictMode isso acontece **sempre** — cada `unmount()` vai em `try/catch` individual, e a checagem do container acontece antes de montar. O padrão já está provado em `src/components/upsell/cardToken.ts:146-152`.
- `customFonts` **carrega** a fonte no iframe; `style.fontFamily` **aplica**. Um sem o outro não faz nada. `src/components/upsell/cardToken.ts:110` declara `'font-family': 'Kanit, sans-serif'` sem `customFonts` — cai no fallback.
- **Não usar `letter-spacing`.** Não está na lista de propriedades aceitas de D. `cardToken.ts:107-113` usa e provavelmente é descartado em silêncio.

### 3.2 Propriedades de estilo aceitas — lista fechada (D)

`color` · `fontFamily` · `fontSize` · `fontStyle` · `fontVariant` · `fontWeight` · `height` · `margin` (+4 lados) · `padding` (+4 lados) · `placeholderColor` · `textAlign` · `width`. Aceita camelCase e kebab-case.

**Não existe** `background`, `border`, `border-radius`, `box-shadow`, `outline`, `transition`, `caret-color`, nem **nenhuma pseudo-classe** (`:focus`, `::placeholder`). Fundo, borda, raio, sombra e **todo o estado visual de foco** ficam no **nosso container** `<div>`, reagindo aos eventos `focus`/`blur`. É por isso que esses eventos existem.

### 3.3 Eventos — os 8 que existem, e só esses

Registro literal do bundle B:
```js
ar = { default:["focus","blur","ready","validityChange","error","change","paste"],
       cardNumber:["binChange"],
       securityCode:[], expirationYear:[], expirationMonth:[], expirationDate:[] }
```
> A **prosa** de D diz que só existem 4 eventos default. A **tabela** da mesma doc lista os 8 e o bundle confirma os 8. Ignore a prosa.

Payloads:
- `focus`/`blur`/`ready`/`change`/`paste` → `{ field: string }` — **nada mais**
- `binChange` (só `cardNumber`) → `{ bin: string | null, field: string }`
- `validityChange` → `{ field: string, errorMessages: [{ message, cause }] }`
- `error` → `{ field: string, error: string }`

### 3.4 binChange → bandeira + settings + parcelas

`binChange` dispara **na transição** de estado (inválido↔válido), não a cada tecla. O guard `bin !== binAtual` é obrigatório — o evento repete (padrão do exemplo oficial de C).

```ts
let binAtual: string | null = null
numero.on('binChange', async ({ bin }) => {
  if (bin === binAtual) return
  binAtual = bin
  if (!bin) { limparBandeiraParcelasEIssuer(); return }

  const [metodos, parcelas] = await Promise.allSettled([
    mp.getPaymentMethods({ bin }),
    mp.getInstallments({ amount: (totalCentavos/100).toFixed(2), bin, locale: 'pt-BR', paymentTypeId: 'credit_card' }),
  ])
  // ...
})
```

**As duas chamadas são necessárias**, e por motivos diferentes:
- `getPaymentMethods({bin})` traz `results[0].settings[0]` — o **único** lugar com o comprimento do CVV. **`settings` é ARRAY**: é `results[0].settings[0].security_code.length`, não `settings.security_code.length`. Erro clássico.
- `getInstallments()` traz `payer_costs` e, de brinde, `issuer.id` e `payment_method_id` (a doc do SDK omite esses dois no nível de cima; foram medidos ao vivo).

**`updatePCIFieldsSettings` — obrigatório, sem ele Amex quebra** (padrão oficial de C):
```ts
const s = metodos.results[0].settings[0]
cvv.update({ settings: { mode: s.security_code.mode, length: s.security_code.length } })
numero.update({ settings: { length: s.card_number.length, validation: s.card_number.validation } })
```
Medido ao vivo: Visa/Elo = CVV 3 dígitos, `card_location: 'back'`, 16 dígitos. **Amex = CVV 4 dígitos, `card_location: 'front'`, 15 dígitos.** Sem esse `update`, o campo valida 3 sempre e o Amex nunca passa.

`card_location` **não é aceito** em `update()` (D só permite `{mode, length}`) — é informativo, e alimenta o cartão 3D (item 7).

`field.update({ invalid: true })` só aplica `aria-invalid`. **Não pinta nada.** A borda vermelha é nossa.

### 3.5 Tokenização

```ts
const token = await mp.fields.createCardToken({
  cardholderName,                                        // input NOSSO
  identificationType: documento.length > 11 ? 'CNPJ' : 'CPF',
  identificationNumber: documento,                       // só dígitos
})
if (!token?.id) throw new Error('token_vazio')
```

**Nunca passar `cardNumber`, `securityCode`, `expirationMonth/Year/Date`.** O parâmetro chama-se literalmente `nonPCIData` — o SDK lê os dados PCI dos iframes montados. Confirmado no bundle:
```js
createCardToken({identificationNumber:t,identificationType:e,cardholderName:r}, ...)
```

A assinatura é `Promise<CardTokenResponse | void>` — **pode resolver vazio**. Checar `!token?.id`, como `cardToken.ts:193` já faz.

Token vale 7 dias e é **de uso único** (C).

### 3.6 Códigos de erro do createCardToken (extraídos de B — a página de docs está 404)

| Parâmetro | Vazio | Inválido | Campo a destacar |
|---|---|---|---|
| `cardNumber` | `205` | `E301` | número |
| `cardExpirationMonth` | `208` | `325` | validade |
| `cardExpirationYear` | `209` | `326` | validade |
| `identificationType` | `212` | `322` | documento |
| `identificationNumber` | `214` | `324` | documento |
| `cardholderName` | `221` | `316` | titular |
| `securityCode` | `224` | `E302` | CVV |

**Mapear código → campo por igualdade exata.** `src/components/upsell/cardToken.ts:168-174` usa `JSON.stringify(causa).includes(codigo)` com `'221'` e `'E301'` na lista de "CVV inválido" — **os dois estão errados** (`221` é nome do titular vazio, `E301` é número inválido; os de CVV são `224` e `E302`). Não portar essa lógica. (Corrigir o upsell é tarefa separada — ver item 10.)

### 3.7 Mensagens de validityChange (tabela de D)

| Campo | Cause | Mensagem nossa (pt-BR) |
|---|---|---|
| `cardNumber` | `invalid_type` / `invalid_length` | "Confira o número do cartão." |
| | `invalid_value` | "Número de cartão inválido." (Luhn) |
| `securityCode` | `invalid_length` | "O código de segurança tem {3\|4} dígitos." |
| `expirationMonth` | `invalid_value` | "Mês inválido." / "Cartão vencido." |
| `expirationYear` | `invalid_value` | "Cartão vencido." |
| `expirationDate` | (herda os dois acima) | — |

Campo é **válido** quando `validityChange` chega com `errorMessages` vazio. **Não existe getter síncrono** (`field.isValid()` não existe) — o estado por campo é mantido a partir dos eventos.

### 3.8 O que NÃO usar

- **`mp.getIssuers()`** — não chamar. Medido ao vivo na nossa public key: os 4 métodos de crédito BR (`master`, `visa`, `elo`, `amex`) retornam `additional_info_needed` **sem `issuer_id`**. Select de banco é campo a mais e campo a mais custa conversão. Deixar só o guard `if (additional_info_needed.includes('issuer_id'))` implementado, custo zero.
- **`mp.getIdentificationTypes()`** — o documento já é coletado em `DadosCliente.tsx` e o tipo é derivado do tamanho (>11 = CNPJ), igual ao servidor faz em `checkout-pagar/index.ts:472-477`.
- **`mp.fields.focus()` / `blur()`** — existem no módulo, mas `focus()`/`blur()` **por campo** não estão em D. Não contar com eles.

---

## 4. CONTRATO COM O SERVIDOR — NÃO PODE MUDAR

`supabase/functions/checkout-pagar/index.ts` não é tocado. O corpo enviado por `pagarCheckout` (`src/components/checkout/checkoutApi.ts:202-213`) permanece idêntico:

```js
{ slug, cliente, formData, bump, cupom?, card_token_salvar? }
```

### O que o servidor lê de dentro do `formData` — whitelist, nada mais

| Campo | Onde é usado | Obrigatoriedade |
|---|---|---|
| `payment_method_id` | validação (`:312`), método/desconto (`:362`), corpo do MP (`:466`) | **Sempre.** Ausente → 400 `dados_pagamento_incompletos` |
| `token` | `:493` | Só cartão. Ausente → pedido marcado `recusado` + 400 |
| `installments` | `:494` — `?? 1` | Só cartão. **Sempre explícito** |
| `issuer_id` | `:495`, só se `!= null` | Opcional |
| `payer.last_name` | `:471`, só se truthy | Opcional |

`payer.email`, `payer.first_name` e `payer.identification` estão declarados em `BrickFormData` (`:65-76`) e **não são usados** — o servidor monta tudo isso a partir do `cliente` do nosso corpo (`:469-477`).

### O payload exato a produzir

```ts
// Cartão
{
  payment_method_id: 'visa' | 'master' | 'elo' | 'amex' | ...,
  token: string,
  installments: number,          // inteiro ≥ 1, NUNCA undefined
  issuer_id?: string | number,   // getInstallments()[0].issuer.id
  payer: { last_name: string },  // resto do nome após o primeiro espaço
}

// Pix
{ payment_method_id: 'pix' }
```

**`issuer_id` tem tipo inconsistente entre endpoints do MP**: `getPaymentMethods` devolve número (`26`), `getInstallments` devolve string (`"26"`). O servidor aceita os dois (`index.ts:96`: `issuer_id?: string | number`). Nunca comparar com `===`.

### Regras invioláveis

- **Não existe campo de valor no payload** (`index.ts:9-11`). O preço sai do catálogo, o cupom é revalidado, a ordem é `(produto+bump) → cupom → método`.
- `X-Idempotency-Key: pedido.id` (`:506`) — o retry não cobra duas vezes.
- Faixa aceita: `VALOR_MINIMO_CENTAVOS = 50`, `VALOR_MAXIMO_CENTAVOS = 5_000_000` (`_shared/checkout.ts:103,110`).

### Guarda obrigatória no front (a trava do bug do `?? 1`)

```ts
if (!Number.isInteger(installments) || installments < 1) {
  throw new Error('parcelamento_indefinido')  // aborta ANTES de chamar a edge function
}
```
Com teste unitário que falha se `formDataCartao()` produzir `installments` `undefined`, `0`, `NaN` ou string.

### Segundo token (`card_token_salvar`) — o que substitui o `getFormData()`

Com os campos ainda montados, chamar `createCardToken` **duas vezes em sequência**:

```ts
const principal = await criarToken()          // falha aqui aborta a venda
const salvar = await comTimeout(criarToken(), 5000).catch(() => null)  // acessório
```

Regra de ouro preservada de `mpSdk.ts:35-42`: **qualquer** falha do segundo → `null` e a venda segue. A venda principal vale mais que o upsell. Teto de 5s, igual ao `TIMEOUT_TOKEN_EXTRA_MS` atual.

**Verificar na Fase 0** se dois `createCardToken` seguidos funcionam (pendência #4).

---

## 5. PARCELAMENTO — em detalhe

### 5.1 Assinatura

```ts
mp.getInstallments({ amount: string, bin: string, locale?: string, processingMode?: 'aggregator'|'gateway' })
```
Fonte: [core-methods.md](https://github.com/mercadopago/sdk-js/blob/main/docs/core-methods.md). `amount` e `bin` são **REQUIRED**.

> **Divergência doc↔doc:** a doc BR (C) usa um quinto parâmetro `paymentTypeId: 'credit_card'` que **não existe** na tabela de `core-methods.md`. Testado ao vivo no endpoint REST: não altera a resposta. Mandar (a doc BR manda) mas não depender.

`amount` em **reais, string, duas casas**: `(totalCentavos / 100).toFixed(2)`.

### 5.2 Quando chamar — os dois gatilhos

1. **`binChange` com bin novo e não-nulo.** As opções variam **por BIN, não por bandeira**. Medido ao vivo em R$ 197: Visa `45516600` → 18 opções; Visa `45651000` → **1** opção; Master `52022000` → 1; Amex `37118030` → 18. Não dá para cachear por bandeira nem hardcodar 12x.
2. **`totalCentavos` mudou** (bump, cupom, troca de método). Aqui está o ganho real sobre o Brick: hoje mudar o valor **remonta o formulário inteiro** (`PagamentoBrick.tsx:196`, deps `[totalCentavos, metodo, gratuito]`). Com Secure Fields só o select é repopulado — os campos preenchidos ficam intactos.

Debounce de 250ms + token de cancelamento (o cupom dispara em cadeia). `bin === null` limpa o select em vez de chamar a API.

### 5.3 Mapeamento

```ts
const [oferta] = respostaGetInstallments
const opcoes = oferta.payer_costs.map(pc => ({
  valor: pc.installments,                  // → installments do payload
  rotulo: pc.recommended_message,          // texto pronto em pt-BR
  temJuros: pc.installment_rate > 0,       // teste canônico
  parcelaCentavos: Math.round(pc.installment_amount * 100),
  totalCentavos:   Math.round(pc.total_amount * 100),
}))
const issuerId        = oferta.issuer?.id
const paymentMethodId = oferta.payment_method_id
```

Chave label/value nomeada explicitamente pela doc BR: `{ label: 'recommended_message', value: 'installments' }`.

`recommended_message` real medido em R$ 197: `"12 parcelas de R$ 20,05 (R$ 240,56)"`.

### 5.4 Fallback e reset

- Erro de rede / array vazio → `[{ valor: 1, rotulo: '1x à vista de R$ X', temJuros: false }]`. **A venda nunca trava por causa do select.**
- Quando as opções mudam, se a seleção anterior não existe mais → volta para `1`. Nunca deixar uma seleção órfã sobreviver.

### 5.5 Juros — a parte que muda a tela

**`calcularTotal()` NÃO muda. Juros não entram na cadeia de desconto.**

O que vai para o MP é `transaction_amount: centavosParaReais(total)` (`checkout-pagar/index.ts:463`) — o total **já descontado**. Os juros são calculados pelo MP em cima disso e cobrados do comprador (`installment_rate_collector: ["MERCADOPAGO"]`, medido ao vivo).

> **Se alguém mandar `payer_costs.total_amount` como `transaction_amount`, cobra juros sobre juros.** R$ 240,56 viraria base e o cliente pagaria ~R$ 293 em 12x. Bug de dinheiro.

Mas a tela passa a ter **dois números diferentes**, e isso é novo — hoje o Brick esconde. Regra de exibição:

- O resumo continua dizendo **"Total R$ 197,00"** — é o que a Vertix cobra.
- A linha da parcela mostra o `recommended_message` **cru** (ele já traz os dois valores entre parênteses).
- Opções com `installment_rate === 0` recebem selo **"sem juros"**.
- Abaixo do select, uma linha curta e permanente quando a opção escolhida tem juros: *"Parcelas com juros do emissor. A Vertix cobra R$ 197,00."*

Sem essa linha, vira chamado de suporte — o mesmo risco que `checkoutTotal.ts:15-17` já nomeia para diferença de centavos.

---

## 6. PIX — não usa Secure Fields

O Pix hoje passa pelo Brick como `bankTransfer: 'all'` (`PagamentoBrick.tsx:128-131`). Com Secure Fields ele deixa de precisar do SDK por completo.

`PagamentoPix.tsx` é só um painel com botão. Ao clicar:

```ts
await onSubmit({ payment_method_id: 'pix' }, null)
```

**Isso é suficiente e é tudo.** Confirmado no servidor:
- `index.ts:362` — `isPix = normalizarMetodo(formData.payment_method_id) === METODO_PIX`, e `normalizarMetodo` é só `trim().toLowerCase()` (`_shared/checkout.ts:403-405`).
- É esse campo, e só ele, que dá o desconto de Pix (`:356-360`) **e** faz a cobrança ser Pix.
- No ramo Pix o servidor **não envia** `token`, `installments` nem `issuer_id` (`:481-484`), e acrescenta `date_of_expiration` = agora + 1h.
- `:577` — Pix não salva cartão. `:635` — Pix nasce `aguardando`; quem fecha é o webhook.

O que **não pode** acontecer: produzir um `payment_method_id` diferente de `'pix'` sem token de cartão. O servidor cai no ramo do cartão e recusa em `:486`.

O resto do fluxo Pix está intocado: `CheckoutPage.tsx:254-258` (`setEstado('pix')`) e `PixPanel.tsx:19-22` (normaliza o QR nos três formatos) continuam valendo.

### Achado lateral: o caminho gratuito já está quebrado hoje

`PagamentoBrick.tsx:198-219` renderiza um botão "Finalizar pedido" quando `totalCentavos <= 0` e chama `onSubmit(null, null)`. Mas `checkout-pagar/index.ts:311-314` devolve **400 `dados_pagamento_incompletos`** quando `formData` é nulo, e `VALOR_MINIMO_CENTAVOS = 50` devolveria **422 `valor_invalido`** de qualquer jeito. Esse botão não pode ter funcionado.

**Não reimplementar como se funcionasse.** Reproduzir o mesmo comportamento (para não mudar nada nesta migração) e abrir tarefa separada.

---

## 7. O CARTÃO 3D — o que o alimenta, e o que fica mascarado

### 7.1 Tabela de fontes — a verdade completa

| Zona | Fonte | Disponível? |
|---|---|---|
| **Nome do titular** | input **nosso** (`cardholderName`, `autoComplete="cc-name"`) | **SIM, ao vivo, a cada tecla** |
| **Bandeira / logo** | `binChange` → `getPaymentMethods({bin}).results[0].id` | **SIM**, quando o BIN vira válido |
| **Primeiros dígitos** | `binChange` → `{ bin }` (6 ou 8 dígitos — **verificar**) | **PARCIAL**, e só quando o número inteiro fica válido |
| Resto do número | dentro do iframe do MP | **NUNCA** |
| Validade (MM/AA) | dentro do iframe | **NUNCA** — só válido/inválido |
| CVV | dentro do iframe | **NUNCA** — nem o comprimento digitado |
| Últimos 4 dígitos | `CardTokenResponse.last_four_digits` | Só **depois** do token — tarde demais para animar |
| **Campo focado** | `focus`/`blur` → `{ field }` | **SIM** |
| **Válido/erro por campo** | `validityChange` | **SIM** |
| **CVV na frente?** | `getPaymentMethods().results[0].settings[0].security_code.card_location` | **SIM** (`'front'` no Amex, `'back'` no resto) |
| Comprimento do CVV | mesmo `settings` | **SIM** (3 ou 4) |

O evento `change` dispara a cada alteração mas carrega **só `{ field }`** — nem o valor, nem a contagem de caracteres. Contar `change`s para simular dígitos não funciona (apagar também dispara).

### 7.2 Como fazer bem, sem mentir visualmente

Tentar "preencher" bullets progressivamente produz um cartão que erra — o usuário digita 8 dígitos e vê 3. Pior que não animar. A direção honesta é tratar o cartão como **peça de confiança e de orientação**, não como espelho:

1. **Giro no CVV.** `focus` em `securityCode` → `rotateY(180deg)`. **Exceto quando `card_location === 'front'`** (Amex): aí não gira, e o brilho vai para o canto superior direito da frente. Esse detalhe é o que separa um componente copiado de um componente que entende cartão.
2. **Brilho seguindo o foco.** Quatro posições fixas (número, validade, CVV, nome) via `--vtx-glow-x` / `--vtx-glow-y` em `<style>` inline no elemento. Não temos coordenadas de cursor — nem precisamos.
3. **Número.** `•••• •••• •••• ••••` por padrão. Quando o BIN chega, os primeiros grupos revelam os dígitos reais com um fade curto. O resto permanece bullet. É verdadeiro: aqueles dígitos nós temos mesmo.
4. **Validade e CVV.** `MM/AA` e `•••` como marca d'água. Estado por cor + check discreto quando `validityChange` vier limpo, borda âmbar quando vier com `errorMessages`.
5. **Nome.** Uppercase, tracking largo, fallback `NOME COMO ESTÁ NO CARTÃO`. É o único campo que "escreve" ao vivo — e por isso deve receber o peso visual.
6. **Bandeira.** Reusar os SVG inline de `src/components/checkout/BandeirasCartao.tsx`. **Não usar `secure_thumbnail`** do MP: o comentário nas linhas 1-8 daquele arquivo é explícito — um checkout não pode depender de arquivo externo carregar para parecer confiável. (A CSP em `vercel.json:50` tem `img-src ... https:` e deixaria passar, mas a razão de produto continua valendo.)

### 7.3 Restrições técnicas obrigatórias

- **Só `transform`, `opacity` e `filter`.** Nada de `width`/`height`/`top`/`left` animados (regra de `~/.claude/rules/ecc/web/coding-style.md`).
- **`aria-hidden="true"` no cartão inteiro.** É decoração. O estado real (campo inválido, parcela escolhida, erro) vive no formulário, em `role="alert"` / `aria-live="polite"`. Um leitor de tela não pode depender de um cartão que gira.
- **`prefers-reduced-motion: reduce`** → sem giro (crossfade de 120ms), sem brilho pulsante, sem gradiente animado. Já é o padrão da casa (`src/index.css:230-241`, `:314-318`).
- O container de cada campo é **nosso**: borda, fundo, raio e anel de foco são CSS nosso reagindo a `focus`/`blur`. Altura fixa no container (`h-14`) + `height: '100%'` no style do campo.

---

## 8. PLANO DE TESTES

### 8.1 Unit (vitest) — obrigatório antes de qualquer integração

A suíte atual tem 20 arquivos / 317 testes, **e nenhum cobre o caminho de pagamento**. As duas regressões conhecidas do Brick (formulário sumindo, commit `da0243c`; selo vazando, `index.css:92-95`) foram achadas visualmente. Não repetir isso.

| Arquivo | Casos |
|---|---|
| `formDataCartao.test.ts` | payload exato do contrato; **falha se `installments` for `undefined`/`0`/`NaN`/string**; `issuer_id` omitido quando nulo; `payer.last_name` só quando truthy; payload de Pix é exatamente `{payment_method_id:'pix'}` |
| `parcelamento.test.ts` | mapeia `payer_costs` reais (fixture de R$ 197, 18 opções); `temJuros` por `installment_rate > 0`; fallback à vista com array vazio e com erro; seleção órfã volta para 1 |
| `errosCampos.test.ts` | um caso por código (`205`,`E301`,`208`,`325`,`209`,`326`,`212`,`322`,`214`,`324`,`221`,`316`,`224`,`E302`) → campo certo; código desconhecido → mensagem genérica; **teste que garante que `221` NÃO mapeia para CVV** |

### 8.2 Cartões de teste do Mercado Pago

⚠️ **Só funcionam com credencial de TESTE.** A chave em `src/components/checkout/checkoutApi.ts:29` é `APP_USR-...` = **produção**. Ligue `VITE_MP_PUBLIC_KEY_SF` (env EXCLUSIVA do formulário novo) com uma public key `TEST-...`. NUNCA `VITE_MP_PUBLIC_KEY`: aquela chave é do Brick, que está vendendo.

⚠️ **Os números abaixo vêm da documentação pública do MP mas NÃO foram verificados nesta sessão.** Confirmar na página de cartões de teste do painel da conta antes de rodar a bateria.

| Bandeira | Número | CVV | Validade |
|---|---|---|---|
| Mastercard | 5031 4332 1540 6351 | 123 | 11/30 |
| Visa | 4235 6477 2802 5682 | 123 | 11/30 |
| **Amex** | 3753 651535 56885 | **1234** | 11/30 |
| Elo débito | 5067 7667 8388 8311 | 123 | 11/30 |

Status forçado pelo **nome do titular**: `APRO` aprovado · `OTHE` recusado geral · `CONT` pendente · `CALL` call for authorize · `FUND` saldo insuficiente · `SECU` CVV inválido · `EXPI` vencido · `FORM` erro de formulário. CPF de teste: `12345678909`.

### 8.3 Bateria manual — checklist

- [ ] **Amex**: campo de número aceita 15 dígitos, CVV aceita 4, **o cartão 3D não gira** no foco do CVV
- [ ] **Visa `45651000`**: select mostra só "1x à vista" (BIN sem parcelamento — medido ao vivo)
- [ ] **Visa `45516600`**: select mostra 18 opções
- [ ] Marcar o order bump com o cartão já preenchido → **o select repopula e os campos NÃO são apagados** (é o ganho sobre o Brick)
- [ ] Aplicar cupom com cartão preenchido → idem
- [ ] Trocar cartão → Visa vira Amex → `settings` atualizam, CVV vira 4
- [ ] Pix → gera QR, mesmo comportamento de hoje
- [ ] Cartão sem documento preenchido (`exigeDocumento === false`) → **mensagem clara**, não erro cru do SDK
- [ ] `SECU` como nome → mensagem "Confira o código de segurança" **no campo certo**
- [ ] Duplo clique no botão de pagar → uma cobrança só (idempotency key)
- [ ] Falha de rede no `getInstallments` → select cai para "1x" e **a venda passa**
- [ ] Autofill do navegador (Chrome + Safari) — comparar com o Brick lado a lado
- [ ] `card_token_salvar` chegou não-nulo → conferir `mp_card_id` gravado no pedido → **fazer um upsell de 1 clique de verdade**
- [ ] Navegação por teclado: Tab percorre nome → número → validade → CVV → parcelas → botão, sem pular nem prender no iframe
- [ ] `prefers-reduced-motion` ligado no SO → sem giro, sem brilho
- [ ] Screenshots 320 / 375 / 768 / 1440

### 8.4 O teste em sandbox que fecha a única incerteza de dinheiro

Uma cobrança em **12x** com credencial de teste, conferindo na resposta do MP:
```
transaction_amount  vs  transaction_details.total_paid_amount  vs  net_received_amount
```
Espera-se `transaction_amount = 197,00` e `total_paid_amount ≈ 240,56`. **Se `transaction_amount` vier 240,56, todo o item 5.5 está errado e o plano para.** 10 minutos.

### 8.5 E2E (Playwright)

Novo `e2e/checkout-cartao.spec.ts`. Os campos são iframes cross-origin do MP — usar `frameLocator`. Não existe nenhum spec cobrindo `/c/:slug` hoje. Mínimo viável: os 3 iframes montam, o select popula após digitar o número, e o cartão gira ao focar o CVV.

---

## 9. ORDEM DE EXECUÇÃO E ROLLOUT SEM DERRUBAR VENDAS

**Sim, dá para manter o Brick e trocar por configuração. É obrigatório fazer assim.**

### Fase 0 — bloqueante, ~60 min, um agente só

1. Abrir `/c/<slug>` em produção com DevTools e **contar os iframes do Brick** (`document.querySelectorAll('#payment-brick iframe').length`). 1 iframe = autofill fácil hoje, 3 = já é o caso difícil e a migração é neutra. **Fecha a única incógnita séria.**
2. Obter public key `TEST-...` no painel do MP e aplicar a mudança de `checkoutApi.ts:29`.
3. **Verificar `createCardToken` duas vezes seguidas** num sandbox mínimo. Se falhar, o plano do `card_token_salvar` muda e isso precisa ser sabido agora.
4. Fechar as 5 decisões do item 1 com o dono.

### Fase 1 — fundação, 3 agentes em paralelo, zero conflito

- **A** → `mpTipos.ts`, `mpInstancia.ts`, `mpCampos.ts`, linha 29 de `checkoutApi.ts`
- **C** → `parcelamento.ts` + teste
- **D** → `errosCampos.ts` + teste

Critério de saída: `npx vitest run` verde, `npx tsc --noEmit` limpo.

### Fase 2 — 3 agentes em paralelo

- **B** → `useCamposCartao.ts`, `useParcelamento.ts` (depende de A e C)
- **F** → `CartaoTresD.tsx` + `cartao3d.css` — **props puras, zero SDK**, desenvolvido isolado numa rota de sandbox descartável. Não depende de ninguém
- **G** → `BotaoPagar.tsx`, `botaoPagar.css`, `PagamentoPix.tsx`. Não depende de ninguém

### Fase 3 — montagem, 1 agente (E), depois integração (H)

- **E** → `formDataCartao.ts` + teste, `FormularioCartao.tsx`, `PagamentoCartao.tsx`
- **H** → `flagFormularioNovo.ts`, `SecaoPagamento.tsx`, as duas linhas de `CheckoutPage.tsx`

### A flag

`src/components/checkout/flagFormularioNovo.ts`:
```ts
export function usarFormularioNovo(): boolean {
  const q = new URLSearchParams(window.location.search)
  if (q.get('sf') === '1') return true    // liga para QA, sem deploy
  if (q.get('sf') === '0') return false   // kill-switch por cliente, no suporte
  return import.meta.env.VITE_CHECKOUT_SECURE_FIELDS === '1'
}
```

Query param manda sobre env, deliberadamente: permite QA em produção sem afetar ninguém, e permite o suporte destravar um cliente específico com um link. **Sem `localStorage`** — estado pegajoso invisível transforma cada chamado de suporte em investigação.

`SecaoPagamento.tsx` fica:
```tsx
{usarFormularioNovo()
  ? (metodo === 'pix' ? <PagamentoPix .../> : <PagamentoCartao .../>)
  : <div className="vtx-checkout"><PagamentoBrick .../></div>}
```

### Rollout

| Passo | Ação | Reversão |
|---|---|---|
| 1 | Deploy com `VITE_CHECKOUT_SECURE_FIELDS` **ausente**. Brick serve 100% | — |
| 2 | Bateria 8.3 em produção via `?sf=1`. Nenhum cliente afetado | fechar a aba |
| 3 | Ligar a env em preview/staging. Bateria completa + sandbox 12x | env |
| 4 | Ligar em produção. Acompanhar **48h** | mudar a env no Vercel + redeploy, ~2 min |
| 5 | PR separado apaga Brick, `mpSdk.ts:44-66`, `index.css:91-338` | — |

**Critérios para abortar (voltar a flag, sem discussão):**
- Taxa de aprovação de cartão cai mais de 3 pontos percentuais em 100 tentativas
- `card_token_salvar` vem nulo em mais de 10% das vendas de cartão
- Qualquer venda cobrada à vista quando o cliente escolheu parcelado

**Nota de monitoramento:** a tabela `pedidos` **não grava `installments`**. A distribuição de parcelas só é observável no painel do Mercado Pago. Se isso for atrapalhar o acompanhamento, gravar `installments` no pedido é uma migration de uma coluna — mas é **fora do escopo desta migração**, e mexer no `checkout-pagar` durante o rollout contraria a trava #1.

---

## 10. O QUE FICOU SEM CONFIRMAÇÃO

Ordenado por impacto. Os quatro primeiros são de Fase 0.

| # | Pendência | Como fechar | Se der errado |
|---|---|---|---|
| 1 | **Brick usa 1 ou 3 iframes?** | `document.querySelectorAll('#payment-brick iframe').length` no checkout ao vivo | 1 iframe → há perda real de autofill; reavaliar com o dono antes da Fase 1 |
| 2 | **`createCardToken` duas vezes seguidas funciona?** | Sandbox mínimo, credencial de teste | Upsell de 1 clique quebra; precisa de outra estratégia antes de codar a Fase 3 |
| 3 | **`transaction_amount` continua sendo a base com juros do comprador?** | Cobrança sandbox em 12x, comparar `transaction_amount` × `transaction_details.total_paid_amount` × `net_received_amount` | Item 5.5 inteiro está errado. **Suposição declarada:** a evidência é forte e convergente (`installment_rate_collector: ["MERCADOPAGO"]`; `total_paid_amount` é campo separado), mas **não achei declaração explícita na doc do MP** |
| 4 | **Quantos dígitos o `binChange.bin` traz?** | `console.log` do evento | Afeta quantos dígitos o cartão 3D revela e se o BIN serve direto para `getInstallments` (que pede 8) |
| 5 | **Formato exato do erro lançado por `createCardToken`** (array de `{code,message}`? objeto com `.cause`?) | Logar o erro cru na primeira integração, antes de escrever o mapeamento. A montagem está ofuscada no bundle e a doc não especifica | `errosCampos.ts` precisa ser tolerante aos três formatos desde o início |
| 6 | **Cartões de teste do MP** (seção 8.2) | Confirmar na página oficial de cartões de teste | Números memorizados, não verificados nesta sessão |
| 7 | **`customFonts` do Google Fonts carrega dentro do iframe?** | Console + Network durante o teste | **Suposição:** a CSP do iframe é do MP, não a nossa (`vercel.json:50`), então não deve bloquear. Se falhar, cai no fallback `sans-serif` — cosmético, não bloqueante |
| 8 | **`letter-spacing` é mesmo descartado no iframe?** | Inspecionar o CVV do upsell ao vivo | Não é bloqueante, mas afeta `upsell/cardToken.ts:107-113` — não portar essa linha assumindo que funciona |
| 9 | **`X-meli-session-id` / device id já vai embutido no card token?** | **Ticket com o suporte do MP.** A doc diz "Once you have the Device ID, you must send it when creating a payment", e os headers em `checkout-pagar/index.ts:498-508` são só três — `Authorization`, `Content-Type`, `X-Idempotency-Key` | Se não vai embutido, **estamos deixando aprovação na mesa hoje, com o Brick**. Independe desta migração e pode ser a melhoria de maior retorno e menor risco do checkout. Não misturar com este PR |
| 10 | **PCI DSS v4.0 6.4.3 e 11.6.1** (inventário/integridade de scripts na página de pagamento) mudam de peso? | Não coberto pelas páginas de PCI do MP | Pergunta em aberto; aplica-se a SAQ A nos dois cenários |

### Bugs achados de passagem — tarefas separadas, fora deste PR

1. **`src/components/upsell/cardToken.ts:168-174`** — `CODIGOS_CVV_INVALIDO` contém `'221'` (nome do titular vazio) e `'E301'` (número inválido). Os códigos de CVV são **`224`** e **`E302`**. E o teste é `JSON.stringify(causa).includes(codigo)`, então `'221'` casa por substring com qualquer coisa que contenha "221".
2. **Caminho gratuito quebrado** — `PagamentoBrick.tsx:198-219` manda `formData = null`, e `checkout-pagar/index.ts:311-314` responde 400 `dados_pagamento_incompletos`; `VALOR_MINIMO_CENTAVOS = 50` barraria de qualquer forma.
3. **`analysis_id` é funcionalidade morta no front** — o servidor aceita e grava (`index.ts:443`), o cabeçalho da function descreve o funil `/c/<slug>?a=<analysis_id>`, mas nem `CheckoutPage.tsx` nem `checkoutApi.ts` leem esse query param.
4. **`pedidos` não grava `installments`** — impossível auditar a distribuição de parcelas fora do painel do MP.