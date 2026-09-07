/**
 * Pós-venda do checkout próprio: tudo o que tem de acontecer DEPOIS de um
 * pedido virar 'pago'.
 *
 * POR QUE ISTO EXISTE
 *   Um pedido passa a 'pago' em DOIS lugares — na aprovação imediata do cartão
 *   (checkout-pagar) e na reconciliação do Pix (checkout-info). Antes deste
 *   módulo, nenhum dos dois fazia nada além de gravar o status: o cliente
 *   pagava e não recebia, e a venda não aparecia no Financeiro. Escrever a
 *   consequência duas vezes seria pior — uma das cópias envelheceria, e a
 *   diferença só apareceria no caminho do Pix, que é o menos testado.
 *
 * AS DUAS CONSEQUÊNCIAS
 *   1. Avisar o worker do Scan (POST /api/vertix/pedido-pago) para ele gerar o
 *      Plano de Correção, o recibo e mandar por e-mail.
 *   2. Criar o recebível JÁ PAGO no Financeiro, com cliente e projeto, no
 *      mesmo espírito da `scan-comprar`.
 *
 * UM RECEBÍVEL POR COBRANÇA
 *   O upsell é um pagamento SEPARADO no Mercado Pago — id próprio, data
 *   própria, linha própria no extrato — e por isso vira um recebível NOVO
 *   (criarRecebivelComplementar), no mesmo cliente e no mesmo projeto da venda
 *   original. Somar o valor ao recebível de antes produziria uma linha que não
 *   corresponde a transação nenhuma: quem confere o mês veria R$ 1.394 no
 *   Financeiro e duas cobranças de R$ 197 e R$ 1.197 no extrato, sem conseguir
 *   casar uma coisa com a outra. Duas cobranças, duas linhas.
 *
 * A REGRA QUE MANDA EM TODO O ARQUIVO
 *   NADA aqui pode derrubar um pagamento. O cliente já pagou: a entrega é
 *   recuperável (o worker tem varredura própria para pedido pago sem entrega,
 *   e é para isso que `pedidos.entregue_em` existe), e o recebível é uma linha
 *   que alguém consegue lançar à mão. A cobrança, não — desfazê-la por causa
 *   de uma falha de pós-venda seria trocar um problema recuperável por um
 *   irrecuperável. Por isso nenhuma função exportada daqui lança: toda falha
 *   vira log e o fluxo segue.
 *
 * O LOG ALTO E CLARO DE ENV AUSENTE NÃO É ZELO EXCESSIVO
 *   Foi exatamente esse o defeito que já custou caro nesta semana: numa venda
 *   real, VERTIX_SERVICE_TOKEN não estava configurado, a chamada ao worker nem
 *   chegou a ser tentada, e o cliente ficou pago sem receber, em silêncio. Se
 *   uma env faltar, o log tem de dizer o id do pedido e que ele está PAGO SEM
 *   AVISO — porque é a única pista que alguém terá.
 *
 * NUNCA loga VERTIX_SERVICE_TOKEN, service role key, dado de cartão nem
 * documento do cliente.
 */

import type { Db, PedidoItem } from './checkout.ts'

/**
 * Teto de espera pelo worker. Curto de propósito: em checkout-pagar esta
 * chamada acontece com o comprador olhando a tela de "processando", e o worker
 * tem varredura própria para pedido pago sem entrega. Esperar mais não aumenta
 * a chance de entregar — só segura a tela de quem já pagou.
 */
const WORKER_TIMEOUT_MS = 5_000

/**
 * Origem gravada no recebível, no cliente e no projeto desta venda.
 *
 * É 'scan', e não um valor próprio do checkout, por uma razão de
 * comportamento, não de nomenclatura: hoje 'scan' é o ÚNICO valor que o
 * trigger `notify_client_parcela_criada` reconhece para NÃO disparar o e-mail
 * automático de "nova cobrança" (20260907160000, seção 6). Uma venda de
 * produto que já está paga não pode mandar cobrança para o comprador — seria a
 * pior mensagem possível logo depois do "obrigado". O mesmo valor também
 * mantém a linha fora da régua de lembretes da `payment-reminders`.
 *
 * Criar aqui uma origem 'checkout' exigiria ensinar esse valor ao trigger e à
 * payment-reminders — os dois compartilhados com a cobrança da agência, e
 * nenhum dos dois deste escopo. Até lá, 'checkout' significaria e-mail de
 * cobrança para quem acabou de pagar.
 *
 * A separação por canal não se perde: `pedidos.origem` guarda de onde veio a
 * venda e `pedidos.receivable_id` liga a linha do Financeiro ao pedido.
 */
const ORIGEM = 'scan'

/** O Scan analisa loja; o projeto da venda é de e-commerce. Igual à scan-comprar. */
const TIPO_SERVICO = 'ecommerce'

/** O pedido, como o pós-venda precisa vê-lo. */
export interface PedidoPago {
  id: string
  cliente_nome: string
  cliente_email: string
  cliente_whatsapp: string | null
  total_centavos: number
  itens: PedidoItem[]
  /** Já preenchido = recebível criado antes. Não cria outro. */
  receivable_id: string | null
}

/**
 * Centavos → string decimal para a coluna numeric(12,2). Aritmética inteira do
 * começo ao fim, igual à scan-comprar: dividir por 100 em float e serializar
 * já produziu centavo a menos em sistema de cobrança.
 */
function centavosParaReais(centavos: number): string {
  const reais = Math.trunc(centavos / 100)
  const resto = Math.abs(centavos % 100)
  return `${reais}.${String(resto).padStart(2, '0')}`
}

/** Data de hoje em YYYY-MM-DD (UTC, igual ao resto das functions). */
function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Descrição da cobrança, tirada do SNAPSHOT do pedido e não do catálogo: é o
 * que foi comprado naquele instante que precisa aparecer no Financeiro, mesmo
 * que o produto tenha sido renomeado depois.
 */
function descricaoDoPedido(itens: PedidoItem[]): string {
  const principal = itens.find((item) => item.tipo === 'principal') ?? itens[0]
  const extras = itens.length - 1
  const base = principal?.nome?.trim() || 'Pedido do checkout'
  return extras > 0 ? `${base} (+${extras})` : base
}

// ---------------------------------------------------------------------------
// 1. Aviso ao worker do Scan
// ---------------------------------------------------------------------------

/**
 * POST <SCAN_WORKER_URL>/api/vertix/pedido-pago com o token de serviço.
 *
 * Mesma direção e mesmo segredo que a `payment-webhook` usa para
 * /api/vertix/compra-paga: VERTIX_SERVICE_TOKEN é o token do sentido
 * admin → worker. O corpo leva só o `pedido_id`; o worker lê o resto
 * (analysis_id, itens, plano_code) do banco, que é a fonte da verdade —
 * mandar o conteúdo por aqui abriria espaço para os dois lados divergirem.
 *
 * Nunca lança. Toda falha — env ausente, worker fora do ar, resposta != 2xx —
 * é log e segue.
 */
export async function avisarWorkerPedidoPago(
  pedidoId: string,
  rotulo: string
): Promise<void> {
  const workerUrl = Deno.env.get('SCAN_WORKER_URL')
  const vertixToken = Deno.env.get('VERTIX_SERVICE_TOKEN')

  if (!workerUrl || !vertixToken) {
    // Log deliberadamente gritante — ver cabeçalho. Diz QUAL env falta (nunca
    // o valor dela) e deixa explícito que existe um cliente pago esperando.
    console.error(
      `[${rotulo}] ENTREGA NÃO AVISADA — pedido ${pedidoId} está PAGO e o ` +
        'worker do Scan não foi chamado. Env ausente: ' +
        `${!workerUrl ? 'SCAN_WORKER_URL ' : ''}${!vertixToken ? 'VERTIX_SERVICE_TOKEN' : ''}`.trim()
    )
    return
  }

  try {
    const res = await fetch(
      `${workerUrl.replace(/\/+$/, '')}/api/vertix/pedido-pago`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${vertixToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pedido_id: pedidoId }),
        signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
      }
    )
    if (!res.ok) {
      console.error(
        `[${rotulo}] Worker do Scan recusou o pedido ${pedidoId}:`,
        res.status
      )
    }
  } catch (erro) {
    console.error(
      `[${rotulo}] Worker do Scan indisponível (pedido ${pedidoId}):`,
      erro
    )
  }
}

// ---------------------------------------------------------------------------
// 2. Recebível no Financeiro
// ---------------------------------------------------------------------------

/** Onde a cobrança é pendurada: cliente e projeto que já existem, ou os novos. */
interface DestinoFinanceiro {
  client_id: string
  project_id: string
}

/**
 * Cliente e projeto desta venda.
 *
 * REAPROVEITA quando o pedido já tem recebível: o cliente e o projeto da venda
 * original são lidos dele. É o caminho do upsell — a segunda cobrança do mesmo
 * comprador não pode abrir um segundo cliente nem um segundo projeto, ou o CRM
 * ganha duas fichas da mesma pessoa a cada oferta aceita.
 *
 * CRIA quando não há recebível anterior: é a venda original, e aí o cliente é
 * reaproveitado por e-mail exato em minúsculas — mesmo critério da
 * `scan-comprar`. Cliente antigo gravado com maiúsculas não casa e vira um
 * segundo cadastro; preferível a unir duas pessoas diferentes por engano num
 * registro financeiro.
 *
 * Esse fallback também cobre o upsell de um pedido cujo recebível original não
 * chegou a ser criado (uma venda anterior a este deploy, ou uma falha
 * registrada no log): o dinheiro do upsell aparece no Financeiro de qualquer
 * jeito, que é o que importa.
 *
 * Devolve null se não deu. Nunca lança — quem chama já está dentro de um try.
 */
async function resolverDestino(
  db: Db,
  pedido: PedidoPago,
  nomeProjeto: string,
  rotulo: string
): Promise<DestinoFinanceiro | null> {
  if (pedido.receivable_id) {
    const anteriores = await db.select<DestinoFinanceiro>(
      `receivables?id=eq.${pedido.receivable_id}&select=client_id,project_id&limit=1`
    )
    if (anteriores[0]?.client_id && anteriores[0]?.project_id) {
      return anteriores[0]
    }
    // Recebível apontado mas ilegível: não é motivo para perder a cobrança.
    // Segue para o caminho de criação, e o log diz por quê.
    console.error(
      `[${rotulo}] Recebível ${pedido.receivable_id} do pedido ${pedido.id} ` +
        'não pôde ser lido; criando cliente e projeto novos.'
    )
  }

  const nome = pedido.cliente_nome.trim()
  const email = pedido.cliente_email.trim().toLowerCase()

  let clientId: string
  const existentes = await db.select<{ id: string }>(
    `clients?email=eq.${encodeURIComponent(email)}&select=id&limit=1`
  )
  if (existentes[0]) {
    clientId = existentes[0].id
  } else {
    const criado = await db.insert<{ id: string }>('clients', {
      nome,
      email,
      telefone: pedido.cliente_whatsapp,
      origem: ORIGEM,
    })
    if (!criado) {
      console.error(
        `[${rotulo}] Recebível não criado: cliente sem linha. Pedido:`,
        pedido.id
      )
      return null
    }
    clientId = criado.id
  }

  const projeto = await db.insert<{ id: string }>('projects', {
    client_id: clientId,
    nome: nomeProjeto,
    tipo_servico: TIPO_SERVICO,
    origem: ORIGEM,
  })
  if (!projeto) {
    console.error(
      `[${rotulo}] Recebível não criado: projeto sem linha. Pedido:`,
      pedido.id,
      'cliente:',
      clientId
    )
    return null
  }

  return { client_id: clientId, project_id: projeto.id }
}

/**
 * Insere o recebível JÁ PAGO. Três diferenças em relação à `scan-comprar`, e
 * todas vêm de o dinheiro já ter entrado:
 *
 *   • Nasce com status 'pago', `pago_em` de hoje e forma_pagamento
 *     'mercado_pago'. Não existe instante em que essa cobrança esteja
 *     pendente: ela é o registro de um pagamento que já aconteceu.
 *
 *   • Não gera `payment_link`. Link de pagamento para algo já pago é convite a
 *     uma segunda cobrança. (`payment_token` continua vindo do default da
 *     coluna, que é NOT NULL.)
 *
 *   • NÃO há rollback. A scan-comprar desfaz criação parcial porque lá a venda
 *     ainda não aconteceu e o comprador pode clicar de novo; aqui o cartão já
 *     foi debitado, e apagar registro de dinheiro que entrou é o oposto do que
 *     se quer.
 *
 * Efeito colateral conhecido e aceito: `notify_receivable_pago`
 * (20260713070001) só dispara em UPDATE, então a equipe não recebe a
 * notificação "Pagamento recebido" destas vendas. Inserir pendente e atualizar
 * logo em seguida daria a notificação, ao custo de uma janela em que o
 * Financeiro mostra como pendente um dinheiro que já entrou — e de deixar essa
 * linha pendente para sempre se o segundo passo falhasse. A venda aparece no
 * Financeiro do mesmo jeito; o que falta é o aviso, não o registro.
 */
async function inserirRecebivelPago(
  db: Db,
  destino: DestinoFinanceiro,
  descricao: string,
  valorCentavos: number
): Promise<string | null> {
  const recebivel = await db.insert<{ id: string }>('receivables', {
    project_id: destino.project_id,
    client_id: destino.client_id,
    descricao,
    valor: centavosParaReais(valorCentavos),
    vencimento: hojeISO(),
    status: 'pago',
    pago_em: hojeISO(),
    forma_pagamento: 'mercado_pago',
    origem: ORIGEM,
  })
  return recebivel?.id ?? null
}

/**
 * Recebível da venda ORIGINAL do checkout: cria cliente, projeto e a cobrança
 * já paga.
 *
 * Devolve o id do recebível, ou null se não deu. Nunca lança.
 */
export async function criarRecebivelDoPedido(
  db: Db,
  pedido: PedidoPago,
  rotulo: string
): Promise<string | null> {
  // Idempotência: pedido que já tem recebível não ganha um segundo. Duas abas
  // confirmando o mesmo Pix, ou um retry da function, não podem dobrar o
  // faturamento no relatório.
  if (pedido.receivable_id) return pedido.receivable_id

  const descricao = descricaoDoPedido(pedido.itens ?? [])

  try {
    const destino = await resolverDestino(
      db,
      pedido,
      `${descricao} — ${pedido.cliente_nome.trim()}`,
      rotulo
    )
    if (!destino) return null

    const receivableId = await inserirRecebivelPago(
      db,
      destino,
      descricao,
      pedido.total_centavos
    )
    if (!receivableId) {
      console.error(
        `[${rotulo}] Recebível sem linha na resposta. Pedido:`,
        pedido.id,
        'projeto:',
        destino.project_id
      )
    }
    return receivableId
  } catch (erro) {
    // O db compartilhado já logou status e corpo do PostgREST. Aqui interessa
    // amarrar a falha ao pedido, que é por onde alguém vai procurar.
    console.error(
      `[${rotulo}] Falha ao criar recebível do pedido ${pedido.id}:`,
      erro
    )
    return null
  }
}

/**
 * Recebível COMPLEMENTAR: a segunda cobrança de um pedido que já foi pago —
 * hoje, o upsell e o downsell.
 *
 * Vai no MESMO cliente e no MESMO projeto da venda original (lidos do
 * recebível que o pedido já aponta), com descrição que deixa o vínculo
 * explícito para quem estiver olhando o Financeiro. O valor é o do item, não o
 * total do pedido: cada linha corresponde a uma transação do Mercado Pago.
 *
 * Depois de criar, amarra o recebível ao item dentro de `itens` por
 * public.checkout_item_recebivel() — um comando só, que grava apenas se o item
 * ainda não tinha vínculo. Se essa gravação disser que não escreveu, existe um
 * recebível duplicado e o log precisa dizer qual, com todos os ids.
 *
 * Devolve o id do recebível, ou null. Nunca lança.
 */
export async function criarRecebivelComplementar(
  db: Db,
  args: {
    pedido: PedidoPago
    produto_id: string
    descricao: string
    valor_centavos: number
  },
  rotulo: string
): Promise<string | null> {
  const { pedido, produto_id, descricao, valor_centavos } = args

  // Guarda barata antes de tocar no banco: item que já gerou recebível não
  // gera outro. O caminho normal nem chega aqui — checkout_item_reservar()
  // barra a segunda tentativa antes da cobrança —, mas dinheiro duplicado no
  // relatório é caro demais para depender de uma guarda só.
  const itemAnterior = (pedido.itens ?? []).find(
    (item) => item.produto_id === produto_id
  )
  if (itemAnterior?.receivable_id) return itemAnterior.receivable_id

  try {
    const destino = await resolverDestino(db, pedido, descricao, rotulo)
    if (!destino) return null

    const receivableId = await inserirRecebivelPago(
      db,
      destino,
      descricao,
      valor_centavos
    )
    if (!receivableId) {
      console.error(
        `[${rotulo}] Recebível complementar sem linha na resposta. Pedido:`,
        pedido.id,
        'produto:',
        produto_id
      )
      return null
    }

    const amarrou = await db.rpc<boolean>('checkout_item_recebivel', {
      p_pedido_id: pedido.id,
      p_produto_id: produto_id,
      p_receivable_id: receivableId,
    })
    if (amarrou !== true) {
      // Alguém amarrou primeiro: o recebível recém-criado é duplicado. Não é
      // apagado daqui — apagar registro de dinheiro por conta própria é pior
      // do que uma linha a mais que alguém confere. O log tem os três ids.
      console.error(
        `[${rotulo}] RECEBÍVEL DUPLICADO — ${receivableId} criado para o ` +
          `produto ${produto_id} do pedido ${pedido.id}, que já tinha vínculo. ` +
          'Conferir no Financeiro.'
      )
    }

    return receivableId
  } catch (erro) {
    console.error(
      `[${rotulo}] Falha ao criar recebível complementar do pedido ${pedido.id}:`,
      erro
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// 3. Orquestração
// ---------------------------------------------------------------------------

/**
 * Fecha o ciclo de um pedido que acabou de virar 'pago': cria o recebível,
 * grava o `receivable_id` no pedido e avisa o worker.
 *
 * A ORDEM É PROPOSITAL. O recebível vem primeiro porque é escrita local e
 * rápida (milissegundos no Postgres), enquanto o aviso ao worker é rede com
 * até WORKER_TIMEOUT_MS de espera. Invertendo, uma indisponibilidade do worker
 * atrasaria — ou, num timeout de plataforma, impediria — o registro do
 * dinheiro que já entrou.
 *
 * Nunca lança. Chamar isto de dentro de um `try` do fluxo de pagamento é
 * desnecessário, mas inofensivo.
 */
export async function concluirPedidoPago(
  db: Db,
  pedido: PedidoPago,
  rotulo: string
): Promise<{ receivable_id: string | null }> {
  const receivableId = await criarRecebivelDoPedido(db, pedido, rotulo)

  if (receivableId && receivableId !== pedido.receivable_id) {
    try {
      await db.update('pedidos', `id=eq.${pedido.id}`, {
        receivable_id: receivableId,
      })
    } catch {
      // O recebível existe e o dinheiro está registrado; só o ponteiro de
      // volta ficou faltando. O log tem os dois ids para reconciliar à mão —
      // e, sem o ponteiro, uma segunda passagem criaria um recebível
      // duplicado, que é justamente o que este log serve para pegar.
      console.error(
        `[${rotulo}] Recebível ${receivableId} criado mas não gravado no ` +
          `pedido ${pedido.id}.`
      )
    }
  }

  await avisarWorkerPedidoPago(pedido.id, rotulo)

  return { receivable_id: receivableId }
}
