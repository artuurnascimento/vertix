/**
 * checkout-pagar
 *
 * Cobrança do checkout próprio (/c/:slug). Recebe o slug da oferta, os dados
 * do comprador e o formData do Payment Brick, e cria o pagamento no Mercado
 * Pago (/v1/payments).
 *
 * Segurança — as regras que não se negociam:
 *   • O VALOR é resolvido no SERVIDOR, sempre. O corpo da requisição diz qual
 *     checkout e SE o bump foi marcado; quanto isso custa sai de `produtos`.
 *     Não existe campo de valor no payload, e acrescentar um seria um bug.
 *   • O CUPOM é validado contra o banco (existe, ativo, na validade, abaixo do
 *     limite, do produto certo). O desconto que a página mostrou não é aceito
 *     como entrada — é recalculado aqui pela mesma função (_shared/checkout).
 *   • O DESCONTO POR MÉTODO (Pix) sai de `checkouts.desconto_pix_percentual` e
 *     é aplicado DEPOIS do cupom, sobre o subtotal já descontado. A ordem
 *     inteira — (produto + bump) → cupom → método — mora em calcularTotais(),
 *     a mesma função que a cupom-validar usa para a prévia da tela: se o
 *     cliente viu R$ 238,14, é R$ 238,14 que vai ao gateway.
 *     O método que vale é o `payment_method_id` do formData, o MESMO campo que
 *     segue no corpo da cobrança — não um campo de método à parte. Assim não
 *     existe estado em que alguém receba desconto de Pix numa transação que o
 *     Mercado Pago processou como cartão.
 *   • O PEDIDO nasce antes da cobrança, com status 'aguardando', e só muda
 *     depois da resposta do MP. Cobrar antes de registrar deixaria dinheiro
 *     entrando sem linha nenhuma no banco quando a function morre no meio.
 *   • O uso do cupom só é incrementado quando o pagamento é APROVADO, por
 *     public.cupom_registrar_uso() — atomicamente, dentro do banco.
 *   • NUNCA loga token de cartão, CVV, MP_ACCESS_TOKEN nem o documento do
 *     cliente. Os logs de erro daqui carregam id de pedido e status HTTP.
 *
 * Sobre o cartão salvo (o que torna o upsell de 1 clique possível):
 *   O token do cartão gerado no navegador é de USO ÚNICO e vale 7 dias
 *   (https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/
 *    integration-configuration/card/integrate-via-core-methods).
 *   Gastá-lo no pagamento significa que não sobra token para salvar o cartão.
 *   Por isso o front pode mandar um SEGUNDO token, em `card_token_salvar`,
 *   gerado a partir dos mesmos dados do cartão antes do submit. Com ele:
 *     1. criamos (ou reaproveitamos) um Customer no MP pelo e-mail;
 *     2. associamos o cartão via POST /v1/customers/{id}/cards.
 *   Sem esse segundo token o pagamento acontece normalmente e o pedido fica
 *   sem cartão salvo — o upsell então cai no formulário completo.
 *
 *   Salvar o cartão acontece DEPOIS de o pagamento ser aprovado, e falhar aí
 *   não derruba a venda: dinheiro já entrou, e a única consequência de não ter
 *   salvo é o upsell pedir o cartão de novo.
 *
 * Pix continua funcionando e não salva cartão nenhum: o upsell de quem pagou
 * por Pix é, obrigatoriamente, um pagamento novo.
 *
 * Sobre o `analysis_id` (opcional no corpo):
 *   O Plano de Correção só faz sentido vendido a partir de um relatório, então
 *   o funil do Scan manda a pessoa para /c/<slug>?a=<analysis_id> e a página
 *   repassa esse valor aqui. Ele é gravado em `pedidos.analysis_id`, que é a
 *   coluna que o WORKER LÊ para saber sobre qual loja escrever o plano. Valor
 *   fora do formato uuid é ignorado em silêncio: um query string malformado
 *   não pode recusar um pagamento.
 *
 * Sobre o `token_compra` (opcional no corpo):
 *   O `t` da mesma URL — o payment_token do recebível que a scan-comprar
 *   criou. Por ele esta função descobre QUAL LEAD está comprando
 *   (raiox_compras.lead_id) e grava em `pedidos.lead_id`. Importa porque a
 *   análise é compartilhada entre leads (cache por domínio) e o worker escreve
 *   o plano com a plataforma e o faturamento de quem pagou. Mesma tolerância
 *   do analysis_id: token inválido ou desconhecido vira lead_id null, nunca
 *   recusa.
 *
 * Depois da aprovação (ver _shared/entrega.ts): a venda vira recebível já pago
 * no Financeiro e o worker do Scan é avisado para entregar. Nenhuma das duas
 * coisas pode derrubar a cobrança — o dinheiro já entrou, e ambas são
 * recuperáveis.
 */

import { withCors } from '../_shared/cors.ts'
import {
  avaliarCupom,
  calcularTotais,
  carregarOferta,
  criarDb,
  entregaPlanoScan,
  gerarPlanoCode,
  jsonResponse,
  normalizarMetodo,
  EMAIL_RE,
  METODO_PIX,
  SLUG_RE,
  UUID_RE,
  VALOR_MAXIMO_CENTAVOS,
  VALOR_MINIMO_CENTAVOS,
  type Db,
  type PedidoItem,
  type ProdutoRow,
} from '../_shared/checkout.ts'
import { concluirPedidoPago } from '../_shared/entrega.ts'

interface PayerIdentification {
  type?: string
  number?: string
}

interface BrickFormData {
  payment_method_id?: string
  token?: string
  installments?: number
  issuer_id?: string | number
  payer?: {
    email?: string
    first_name?: string
    last_name?: string
    identification?: PayerIdentification
  }
}

interface RequestBody {
  slug?: string
  cliente?: {
    nome?: string
    email?: string
    whatsapp?: string
    documento?: string
  }
  formData?: BrickFormData
  bump?: boolean
  cupom?: string
  /**
   * Método escolhido na tela. Aceito para a página poder mandar o mesmo corpo
   * que manda para a cupom-validar, mas NÃO é ele que decide o desconto: quem
   * decide é `formData.payment_method_id`, que é o campo que de fato vai ao
   * Mercado Pago. Se os dois discordarem, vale o do formData — em silêncio,
   * porque recusar uma venda por causa de um campo redundante seria trocar
   * dinheiro por rigor, e o desconto concedido continua correto de qualquer
   * jeito. Nunca um valor: o preço é sempre conta do servidor.
   */
  metodo?: string
  /** Segundo token do cartão, só para salvar. Ver cabeçalho. */
  card_token_salvar?: string
  origem?: string
  /** Análise do Scan que originou a venda (/c/:slug?a=<uuid>). Opcional. */
  analysis_id?: string
  /** Token da compra (o `t` da URL), para achar o lead do Scan. */
  token_compra?: string
}

interface PedidoRow {
  id: string
}

const PIX_EXPIRATION_MS = 60 * 60 * 1000

/**
 * raiox_compras.lead_id da compra cujo recebível tem este payment_token.
 * Duas leituras pequenas; qualquer falha vira null e a venda segue.
 */
async function leadDoTokenDeCompra(db: Db, token: string): Promise<string | null> {
  try {
    const recebiveis = await db.select<{ id: string }>(
      `receivables?payment_token=eq.${token}&select=id&limit=1`
    )
    const receivableId = recebiveis[0]?.id
    if (!receivableId) return null
    const compras = await db.select<{ lead_id: string | null }>(
      `raiox_compras?receivable_id=eq.${receivableId}&select=lead_id&limit=1`
    )
    return compras[0]?.lead_id ?? null
  } catch (erro) {
    console.error('[checkout-pagar] Falha ao resolver o lead da compra:', erro)
    return null
  }
}

/**
 * Centavos → número em reais para o `transaction_amount` do MP. A conta é
 * feita com inteiros e só então convertida: dividir por 100 em ponto flutuante
 * e serializar já produziu centavo a menos em sistema de cobrança.
 */
function centavosParaReais(centavos: number): number {
  const inteiros = Math.trunc(centavos / 100)
  const resto = centavos % 100
  return Number(`${inteiros}.${String(resto).padStart(2, '0')}`)
}

/**
 * Status do MP → status do pedido.
 * 'pending' e 'in_process' continuam 'aguardando' de propósito: Pix nasce
 * pendente, e cartão em análise ainda pode ser aprovado. Marcar 'recusado' aí
 * mostraria uma tela de erro para uma venda que vai entrar.
 */
function statusDoPedido(mpStatus: unknown): string {
  switch (mpStatus) {
    case 'approved':
      return 'pago'
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'aguardando'
    case 'refunded':
    case 'charged_back':
      return 'reembolsado'
    default:
      return 'recusado'
  }
}

/**
 * Garante um Customer no Mercado Pago para este e-mail.
 *
 * O caminho é criar e, no erro 101 ("the customer already exist"), buscar —
 * e não "buscar e criar se não achar". A ordem importa: buscar-depois-criar é
 * ler-antes-de-escrever, e dois checkouts simultâneos do mesmo e-mail criariam
 * dois customers. Criar primeiro deixa o próprio MP arbitrar a unicidade.
 *
 * Devolve null se não der: cliente sem customer só perde o cartão salvo.
 * Docs: https://www.mercadopago.com.br/developers/pt/reference/customers/_customers/post
 *       https://www.mercadopago.com.br/developers/pt/reference/customers/_customers_search/get
 */
async function garantirCustomer(
  mpToken: string,
  email: string,
  nome: string
): Promise<string | null> {
  const [firstName, ...resto] = nome.split(' ')

  const criarRes = await fetch('https://api.mercadopago.com/v1/customers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mpToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      ...(resto.length > 0 && { last_name: resto.join(' ') }),
    }),
  })

  if (criarRes.ok) {
    const criado = (await criarRes.json()) as { id?: string }
    return criado.id ?? null
  }

  // 101 = já existe. Qualquer outro erro é falha de verdade.
  const erro = (await criarRes.json().catch(() => ({}))) as {
    cause?: Array<{ code?: number | string }>
  }
  const jaExiste = (erro.cause ?? []).some(
    (c) => String(c.code) === '101'
  )
  if (!jaExiste) {
    console.error('[checkout-pagar] Falha ao criar customer:', criarRes.status)
    return null
  }

  const buscaRes = await fetch(
    `https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${mpToken}` } }
  )
  if (!buscaRes.ok) {
    console.error('[checkout-pagar] Falha ao buscar customer:', buscaRes.status)
    return null
  }
  const busca = (await buscaRes.json()) as { results?: Array<{ id?: string }> }
  return busca.results?.[0]?.id ?? null
}

/**
 * Associa o cartão ao customer com o SEGUNDO token.
 * Docs: https://www.mercadopago.com.br/developers/pt/reference/cards/_customers_customer_id_cards/post
 * A resposta traz só metadados (últimos 4 dígitos, bandeira, tamanho do CVV) —
 * nunca o número nem o código de segurança, que o MP não guarda.
 */
async function salvarCartao(
  mpToken: string,
  customerId: string,
  cardToken: string
): Promise<{ id: string; ultimos_digitos: string | null } | null> {
  const res = await fetch(
    `https://api.mercadopago.com/v1/customers/${customerId}/cards`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: cardToken }),
    }
  )
  if (!res.ok) {
    // Só o status: o corpo do erro pode ecoar o token enviado.
    console.error('[checkout-pagar] Falha ao salvar cartão:', res.status)
    return null
  }
  const card = (await res.json()) as {
    id?: string
    last_four_digits?: string
  }
  if (!card.id) return null
  return { id: card.id, ultimos_digitos: card.last_four_digits ?? null }
}

Deno.serve(
  withCors(async (req) => {
    if (req.method !== 'POST') {
      return jsonResponse({ erro: 'method_not_allowed' }, 405)
    }

    let body: RequestBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ erro: 'payload_invalido' }, 400)
    }

    // ----------------------------------------------------------------------
    // 1. Validação da entrada
    // ----------------------------------------------------------------------

    const slug = (body.slug ?? '').trim().toLowerCase()
    if (!SLUG_RE.test(slug)) {
      return jsonResponse({ erro: 'slug_invalido' }, 400)
    }

    const nome = (body.cliente?.nome ?? '').trim()
    if (!nome) return jsonResponse({ erro: 'nome_obrigatorio' }, 400)

    const email = (body.cliente?.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ erro: 'email_invalido' }, 400)
    }

    const whatsapp = (body.cliente?.whatsapp ?? '').trim() || null
    // Só dígitos: o que vale para o MP e para o WhatsApp. Nunca logado.
    const documento =
      (body.cliente?.documento ?? '').replace(/\D/g, '') || null

    // Análise do Scan que originou a venda. Opcional e DELIBERADAMENTE
    // tolerante: o valor vem da URL da página, e lixo no parâmetro vira null em
    // silêncio. Recusar o pagamento por causa de um query string malformado
    // seria trocar dinheiro por rigor — sem o analysis_id a venda acontece
    // igual, e o que se perde é o worker saber de qual loja é o plano.
    const analysisIdBruto = (body.analysis_id ?? '').trim()
    const analysisId = UUID_RE.test(analysisIdBruto) ? analysisIdBruto : null

    const tokenCompraBruto = (body.token_compra ?? '').trim()
    const tokenCompra = UUID_RE.test(tokenCompraBruto) ? tokenCompraBruto : null

    const formData = body.formData
    if (!formData?.payment_method_id) {
      return jsonResponse({ erro: 'dados_pagamento_incompletos' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    if (!supabaseUrl || !serviceRoleKey || !mpAccessToken) {
      console.error('[checkout-pagar] Env ausente.')
      return jsonResponse({ erro: 'config_ausente' }, 500)
    }

    const db: Db = criarDb(supabaseUrl, serviceRoleKey)

    // Lead do Scan que está comprando, pelo token da compra. Nunca derruba o
    // pagamento: sem lead, o worker cai no lead mais recente da análise.
    const leadId = tokenCompra ? await leadDoTokenDeCompra(db, tokenCompra) : null

    // ----------------------------------------------------------------------
    // 2. Preço — resolvido no servidor, do catálogo
    // ----------------------------------------------------------------------

    let oferta
    try {
      oferta = await carregarOferta(db, slug)
    } catch {
      return jsonResponse({ erro: 'falha_ao_ler_checkout' }, 502)
    }
    if (!oferta) {
      return jsonResponse({ erro: 'checkout_nao_encontrado' }, 404)
    }

    // Bump só entra se ele existe, está ativo E foi marcado. Pedir o bump de
    // um checkout que não tem bump é ignorado, nunca é erro: o navegador não
    // acrescenta item ao pedido, ele só marca uma caixinha que já existia.
    const comBump = body.bump === true && oferta.bump !== null
    const itensProdutos: ProdutoRow[] = comBump
      ? [oferta.produto, oferta.bump as ProdutoRow]
      : [oferta.produto]

    const subtotal = itensProdutos.reduce(
      (soma, p) => soma + p.preco_centavos,
      0
    )

    // ----------------------------------------------------------------------
    // 3. Cupom e desconto de método — revalidados aqui, nunca aceitos prontos
    // ----------------------------------------------------------------------
    // O método sai do `payment_method_id` do Brick, e não de `body.metodo`,
    // porque é esta variável que vai depois no corpo enviado ao Mercado Pago
    // (secção 5). Um só campo decidindo o desconto E a cobrança significa que
    // "ganhar o desconto de Pix" e "ser cobrado por Pix" são a mesma coisa,
    // por construção, sem depender de os dois campos concordarem.

    const metodo = normalizarMetodo(formData.payment_method_id)
    const isPix = metodo === METODO_PIX

    let cupomId: string | null = null
    let descontoCupom = 0
    const codigoCupom = (body.cupom ?? '').trim()
    if (codigoCupom) {
      let avaliado
      try {
        avaliado = await avaliarCupom(db, codigoCupom, oferta.produto.id, subtotal)
      } catch {
        return jsonResponse({ erro: 'falha_ao_validar_cupom' }, 502)
      }
      // Cupom inválido NÃO é cobrado sem desconto às escondidas: o cliente viu
      // um preço com desconto na tela, e cobrar o cheio seria a pior surpresa
      // possível num checkout. Ele volta com a mensagem e decide.
      if (!avaliado.valido) {
        return jsonResponse(
          { erro: 'cupom_invalido', mensagem: avaliado.mensagem },
          422
        )
      }
      cupomId = avaliado.cupom.id
      descontoCupom = avaliado.desconto_centavos
    }

    // A conta inteira, na ordem oficial: (produto + bump) → cupom → método.
    // Mesma chamada que a cupom-validar fez para a prévia — é isso que garante
    // que o número da tela e o número da fatura sejam o mesmo número.
    const totais = calcularTotais(
      oferta.checkout,
      subtotal,
      descontoCupom,
      metodo
    )
    const desconto = totais.desconto_centavos
    const descontoMetodo = totais.desconto_metodo_centavos
    const total = totais.total_centavos

    if (total < VALOR_MINIMO_CENTAVOS || total > VALOR_MAXIMO_CENTAVOS) {
      console.error('[checkout-pagar] Total fora da faixa:', total, 'slug:', slug)
      return jsonResponse({ erro: 'valor_invalido' }, 422)
    }

    // ----------------------------------------------------------------------
    // 4. Pedido nasce ANTES da cobrança
    // ----------------------------------------------------------------------

    const itens: PedidoItem[] = itensProdutos.map((p) => ({
      produto_id: p.id,
      nome: p.nome,
      tipo: p === oferta.produto ? 'principal' : 'bump',
      preco_centavos: p.preco_centavos,
      pago: false,
      entrega: p.entrega,
      mp_payment_id: null,
    }))

    let pedido: PedidoRow | null
    try {
      pedido = await db.insert<PedidoRow>('pedidos', {
        checkout_id: oferta.checkout.id,
        cliente_nome: nome,
        cliente_email: email,
        cliente_whatsapp: whatsapp,
        cliente_documento: documento,
        itens,
        subtotal_centavos: subtotal,
        // Soma dos descontos (cupom + método), para valer a identidade que o
        // recibo, a tela de obrigado e o Financeiro assumem:
        //     total_centavos = subtotal_centavos − desconto_centavos
        desconto_centavos: desconto,
        // Quanto daquele desconto veio do método. Gravado à parte porque, sem
        // isso, "R$ 55,86 de desconto" é indistinguível de um cupom maior — e
        // o Financeiro precisa saber quanto o incentivo ao Pix custou. Ver a
        // migration 20260908200000.
        desconto_metodo_centavos: descontoMetodo,
        total_centavos: total,
        cupom_id: cupomId,
        status: 'aguardando',
        origem: (body.origem ?? '').trim() || null,
        analysis_id: analysisId,
        lead_id: leadId,
      })
    } catch {
      return jsonResponse({ erro: 'falha_ao_criar_pedido' }, 502)
    }
    if (!pedido) {
      return jsonResponse({ erro: 'falha_ao_criar_pedido' }, 502)
    }

    // ----------------------------------------------------------------------
    // 5. Cobrança no Mercado Pago
    // ----------------------------------------------------------------------

    // `isPix` foi resolvido junto com o desconto, na secção 3, a partir deste
    // mesmo `payment_method_id`.

    // Whitelist explícita do formData do Brick: só os campos abaixo cruzam a
    // fronteira. Repassar o objeto inteiro deixaria o navegador injetar
    // qualquer campo da API do MP — inclusive `transaction_amount`.
    const pagamento: Record<string, unknown> = {
      transaction_amount: centavosParaReais(total),
      description: oferta.checkout.titulo,
      external_reference: pedido.id,
      payment_method_id: formData.payment_method_id,
      statement_descriptor: 'VERTIX',
      payer: {
        email,
        first_name: nome.split(' ')[0],
        ...(formData.payer?.last_name && { last_name: formData.payer.last_name }),
        ...(documento && {
          identification: {
            type: documento.length > 11 ? 'CNPJ' : 'CPF',
            number: documento,
          },
        }),
      },
    }

    if (isPix) {
      pagamento.date_of_expiration = new Date(
        Date.now() + PIX_EXPIRATION_MS
      ).toISOString()
    } else {
      if (!formData.token) {
        // Pedido já existe: marca recusado para não deixar 'aguardando' eterno.
        await db
          .update('pedidos', `id=eq.${pedido.id}`, { status: 'recusado' })
          .catch(() => {})
        return jsonResponse({ erro: 'dados_pagamento_incompletos' }, 400)
      }
      pagamento.token = formData.token
      pagamento.installments = formData.installments ?? 1
      if (formData.issuer_id != null) pagamento.issuer_id = formData.issuer_id
    }

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
        // Chave derivada do pedido: se a function for reexecutada (retry de
        // rede, duplo clique que passou), o MP devolve o MESMO pagamento em
        // vez de cobrar de novo.
        'X-Idempotency-Key': pedido.id,
      },
      body: JSON.stringify(pagamento),
    })

    const mpBody = (await mpRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >

    if (!mpRes.ok) {
      // O corpo do erro do MP não contém o access token nem número de cartão.
      console.error(
        '[checkout-pagar] Erro do MP:',
        mpRes.status,
        'pedido:',
        pedido.id,
        JSON.stringify(mpBody).slice(0, 500)
      )
      await db
        .update('pedidos', `id=eq.${pedido.id}`, { status: 'recusado' })
        .catch(() => {})
      return jsonResponse(
        {
          pedido_id: pedido.id,
          status: 'recusado',
          erro: 'gateway_recusou',
          mensagem: (mpBody.message as string) ?? null,
        },
        502
      )
    }

    const status = statusDoPedido(mpBody.status)
    const aprovado = status === 'pago'

    // ----------------------------------------------------------------------
    // 6. Consequências da aprovação
    // ----------------------------------------------------------------------

    let mpCustomerId: string | null = null
    let cartaoSalvo: { id: string; ultimos_digitos: string | null } | null = null

    if (aprovado) {
      // Cupom: incrementado só agora, e dentro do banco (ver migration).
      if (cupomId) {
        try {
          const ok = await db.rpc<boolean>('cupom_registrar_uso', {
            p_cupom_id: cupomId,
          })
          if (ok === false) {
            // Cupom estourou o limite entre a validação e a aprovação. O
            // pagamento JÁ passou: honramos o desconto e registramos o caso —
            // desfazer a cobrança por causa de uma corrida de cupom seria
            // muito pior para o cliente do que um uso a mais no relatório.
            console.error(
              '[checkout-pagar] Cupom esgotou entre validar e cobrar. Pedido:',
              pedido.id
            )
          }
        } catch {
          console.error(
            '[checkout-pagar] Falha ao registrar uso do cupom. Pedido:',
            pedido.id
          )
        }
      }

      // Cartão salvo — só cartão, só com o segundo token, e sempre depois de o
      // dinheiro estar garantido. Falhar aqui não derruba a venda.
      const tokenSalvar = body.card_token_salvar
      if (!isPix && typeof tokenSalvar === 'string' && tokenSalvar.length > 0) {
        try {
          mpCustomerId = await garantirCustomer(mpAccessToken, email, nome)
          if (mpCustomerId) {
            cartaoSalvo = await salvarCartao(
              mpAccessToken,
              mpCustomerId,
              tokenSalvar
            )
          }
        } catch {
          console.error(
            '[checkout-pagar] Falha ao salvar cartão. Pedido:',
            pedido.id
          )
        }
      }
    }

    const mpPaymentId = mpBody.id != null ? String(mpBody.id) : null

    // Código do Plano de Correção: sorteado só quando a venda foi aprovada E
    // algum item pago é entregue como plano_scan. Gerar antes da aprovação
    // criaria links de documento para quem não comprou.
    const planoCode =
      aprovado && entregaPlanoScan(itens) ? gerarPlanoCode() : null

    try {
      await db.update('pedidos', `id=eq.${pedido.id}`, {
        status,
        mp_payment_id: mpPaymentId,
        mp_customer_id: mpCustomerId,
        mp_card_id: cartaoSalvo?.id ?? null,
        plano_code: planoCode,
        itens: itens.map((item) => ({
          ...item,
          pago: aprovado,
          mp_payment_id: aprovado ? mpPaymentId : null,
        })),
      })
    } catch {
      // O dinheiro entrou; só a linha ficou desatualizada. O log tem o id do
      // pagamento no MP, que é o que permite reconciliar à mão.
      console.error(
        '[checkout-pagar] Pagamento OK mas pedido não atualizou. Pedido:',
        pedido.id,
        'mp_payment_id:',
        mpPaymentId
      )
    }

    // ----------------------------------------------------------------------
    // 7. Pós-venda — Financeiro e entrega
    // ----------------------------------------------------------------------
    // Só depois de o pedido estar gravado como pago, e só na aprovação. Nada
    // daqui derruba a resposta ao comprador: concluirPedidoPago() não lança e
    // engole as próprias falhas (ver _shared/entrega.ts). O Pix não passa por
    // aqui — ele nasce 'aguardando' e é a checkout-info que fecha o ciclo.
    if (aprovado) {
      await concluirPedidoPago(
        db,
        {
          id: pedido.id,
          cliente_nome: nome,
          cliente_email: email,
          cliente_whatsapp: whatsapp,
          total_centavos: total,
          itens,
          // Pedido recém-criado nesta mesma execução: não existe recebível
          // anterior para reaproveitar.
          receivable_id: null,
        },
        'checkout-pagar'
      )
    }

    const poi = mpBody.point_of_interaction as
      | {
          transaction_data?: {
            qr_code?: string
            qr_code_base64?: string
            ticket_url?: string
          }
        }
      | undefined

    return jsonResponse({
      pedido_id: pedido.id,
      status,
      total_centavos: total,
      // Soma dos descontos, como no pedido. A quebra vai junto para a tela de
      // confirmação poder creditar o Pix por nome em vez de mostrar um total
      // anônimo. Campos acrescentados, nenhum renomeado.
      desconto_centavos: desconto,
      desconto_cupom_centavos: totais.desconto_cupom_centavos,
      desconto_metodo_centavos: descontoMetodo,
      ...(planoCode && { plano_code: planoCode }),
      ...(isPix &&
        poi?.transaction_data && {
          pix: {
            qr: poi.transaction_data.qr_code_base64 ?? null,
            copia_cola: poi.transaction_data.qr_code ?? null,
            ticket_url: poi.transaction_data.ticket_url ?? null,
          },
        }),
      // O front precisa do card_id para gerar, com o CVV, o token do upsell.
      // É um id opaco: sem número, sem validade e inútil sem o CVV.
      ...(cartaoSalvo && {
        cartao_salvo: {
          card_id: cartaoSalvo.id,
          ultimos_digitos: cartaoSalvo.ultimos_digitos,
        },
      }),
    })
  })
)
