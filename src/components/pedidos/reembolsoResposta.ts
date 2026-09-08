import { supabase } from '../../lib/supabase'

/**
 * Tradução da resposta das edge functions de reembolso, e a chamada delas.
 *
 * São duas: `checkout-reembolsar` (public.pedidos) e `scan-reembolsar`
 * (public.raiox_compras). O contrato de RESPOSTA é o mesmo nas duas de
 * propósito — mesmos códigos de erro, mesma regra de `mensagem` do servidor,
 * mesmos dois desfechos de sucesso —, e por isso a tradução mora aqui em vez
 * de existir em duas versões que divergiriam.
 *
 * O que se protege é a diferença entre "o dinheiro voltou" e "o dinheiro PODE
 * ter voltado": as functions distinguem os dois casos com cuidado, e o painel
 * só é útil se repassar a distinção inteira para quem está olhando. Um código
 * novo que esta versão do painel não conhece vira aviso de dúvida, nunca
 * sucesso silencioso.
 *
 * Mora em `components/pedidos/` porque foi ali que o reembolso nasceu e é ali
 * que ele está inteiro (o diálogo, as contas da confirmação, a lista). O Scan
 * importa daqui; duplicar do outro lado criaria duas ideias de reembolso no
 * mesmo painel.
 */

/**
 * Os dois desfechos de sucesso. `ja_reembolsado` NÃO é erro: duas abas
 * abertas, um retry de rede ou um estorno feito ontem caem todos ali, e a tela
 * deve mostrar "reembolsado" em vez de uma falha.
 */
export type ResultadoReembolso = 'reembolsado' | 'ja_reembolsado'

/** Erro de reembolso já traduzido para quem está olhando a tela. */
export class ReembolsoError extends Error {
  /** true quando a edge function ainda não foi publicada neste ambiente. */
  naoPublicada: boolean

  constructor(message: string, naoPublicada = false) {
    super(message)
    this.name = 'ReembolsoError'
    this.naoPublicada = naoPublicada
  }
}

/**
 * Códigos que as functions devolvem SEM `mensagem` própria e que valem para as
 * duas. Os que têm mensagem (gateway_recusou, gateway_indisponivel,
 * reembolsado_sem_registro, reembolso_em_andamento, pagamento_ambiguo…) são
 * mostrados com o texto do servidor: ele sabe se o dinheiro saiu, e reescrever
 * aqui só criaria uma segunda versão da verdade, capaz de divergir da primeira
 * numa atualização do backend.
 */
const MENSAGENS_COMUNS: Record<string, string> = {
  nao_autenticado: 'Sua sessão expirou. Entre de novo e repita a operação.',
  acesso_negado: 'Seu usuário não tem permissão para reembolsar.',
  falha_ao_validar_permissao:
    'Não deu para conferir sua permissão. Nada foi cobrado nem estornado.',
  config_ausente:
    'O ambiente está sem a credencial do Mercado Pago. Nada foi estornado.',
  falha_ao_reservar_reembolso:
    'O banco não conseguiu reservar este reembolso. Nada foi estornado — tente de novo.',
  payload_invalido: 'A requisição saiu malformada. Recarregue a página.',
  method_not_allowed: 'A função de reembolso recusou a chamada. Recarregue a página.',
}

export const MENSAGEM_PADRAO =
  'Não deu para reembolsar. O dinheiro pode não ter voltado — confira no Mercado Pago antes de tentar de novo.'

export const MENSAGEM_NAO_PUBLICADA =
  'A função de reembolso ainda não está publicada neste ambiente. Nada foi cobrado nem estornado.'

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
}

/**
 * Monta o tradutor de corpo → mensagem de uma function.
 *
 * `especificos` são os códigos que só aquele fluxo devolve sem `mensagem`
 * própria (`pedido_nao_encontrado` de um lado, `compra_nao_encontrada` do
 * outro). Tudo o mais é comum.
 */
export function criarMensagemDoCorpo(
  especificos: Record<string, string> = {}
): (corpo: Record<string, unknown> | null) => string | null {
  const mensagens = { ...MENSAGENS_COMUNS, ...especificos }
  return (corpo) => {
    if (corpo === null) return null
    const codigo = texto(corpo.erro) ?? texto(corpo.error)
    if (codigo === null) return null
    // A `mensagem` do servidor tem precedência sobre o mapa local.
    return texto(corpo.mensagem) ?? mensagens[codigo] ?? MENSAGEM_PADRAO
  }
}

async function corpoDoErro(erro: unknown): Promise<Record<string, unknown> | null> {
  const contexto = (erro as { context?: unknown })?.context
  if (!(contexto instanceof Response)) return null
  try {
    const corpo: unknown = await contexto.clone().json()
    return ehRegistro(corpo) ? corpo : null
  } catch {
    return null
  }
}

function statusDoErro(erro: unknown): number | null {
  const contexto = (erro as { context?: unknown })?.context
  return contexto instanceof Response ? contexto.status : null
}

/** 'ja_reembolsado' e 'reembolsado' são sucesso; qualquer outro corpo não é. */
function resultadoDoCorpo(corpo: unknown): ResultadoReembolso {
  if (!ehRegistro(corpo)) return 'reembolsado'
  return texto(corpo.resultado) === 'ja_reembolsado' ? 'ja_reembolsado' : 'reembolsado'
}

/**
 * Chama a edge function de reembolso e devolve como terminou.
 *
 * Devolve o desfecho porque "já estava reembolsado" e "acabei de reembolsar"
 * são a mesma resposta HTTP e frases diferentes na tela.
 */
export async function invocarReembolso(
  functionName: string,
  body: Record<string, unknown>,
  traduzir: (corpo: Record<string, unknown> | null) => string | null
): Promise<ResultadoReembolso> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    const corpo = await corpoDoErro(error)
    const mensagem = traduzir(corpo)
    if (mensagem !== null) throw new ReembolsoError(mensagem)
    // 404 SEM corpo reconhecível = a rota não existe. Com corpo, o 404 é
    // "não encontrado" do próprio registro, que já saiu pelo ramo acima —
    // distinguir os dois importa porque um manda publicar a function e o
    // outro, não.
    if (statusDoErro(error) === 404) {
      throw new ReembolsoError(MENSAGEM_NAO_PUBLICADA, true)
    }
    throw new ReembolsoError(MENSAGEM_PADRAO)
  }

  // A function também pode responder 2xx com um `erro` no corpo: sucesso de
  // transporte não é sucesso de estorno, e tratar como sucesso mostraria
  // "reembolsado" para um cliente que continua sem o dinheiro de volta.
  const mensagem = traduzir(ehRegistro(data) ? data : null)
  if (mensagem !== null) throw new ReembolsoError(mensagem)

  return resultadoDoCorpo(data)
}
