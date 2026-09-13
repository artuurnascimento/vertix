/**
 * Carrega uma página do roteador e se recupera de chunk que sumiu.
 *
 * O DEFEITO QUE ISTO CONSERTA: as rotas são `lazy()`, e o nome de cada
 * chunk carrega o hash do conteúdo (`UpsellPage-abc123.js`), então cada
 * deploy publica nomes novos. Quem está com a aba aberta ANTES do deploy
 * continua com o `index.html` velho na memória, que aponta para os nomes
 * velhos. Ao navegar — por exemplo, do pagamento para o upsell — o navegador
 * pede um arquivo que não existe mais; a Vercel devolve o `index.html` da SPA
 * no lugar, o `import()` estoura, o `lazy()` rejeita, e sem fronteira de erro
 * a tela fica PRETA. Sem mensagem, sem saída.
 *
 * Foi o que aconteceu no checkout em 13/09/2026, com deploys em sequência e
 * gente terminando de pagar: a tela do upsell só aparecia depois de um F5.
 *
 * A SAÍDA: recarregar. Busca o `index.html` novo, com os nomes novos, e não
 * se perde nada — a rota está na URL, e é para ela que a pessoa volta. Uma
 * vez só por aba: se a segunda tentativa também falhar, o problema é outro
 * (sem rede, servidor fora) e recarregar em laço não conserta; aí o erro
 * sobe para a fronteira mostrar uma saída. É o mesmo mecanismo do Scan
 * (`raiox-vertix/web/src/lib/carregarPagina.ts`).
 */

/** Marca que esta aba já se recarregou por causa de chunk faltando. */
const CHAVE = 'vx-chunk-recarregado'

function jaRecarregou(): boolean {
  try {
    return window.sessionStorage.getItem(CHAVE) !== null
  } catch {
    // Armazenamento bloqueado: sem memória, tratamos como "ainda não tentou".
    // No pior caso recarrega uma vez a mais — melhor que tela preta.
    return false
  }
}

function anotarRecarga(): void {
  try {
    window.sessionStorage.setItem(CHAVE, '1')
  } catch {
    // ver acima
  }
}

export function carregarPagina<T>(importar: () => Promise<T>): Promise<T> {
  return importar().catch((erro: unknown) => {
    if (typeof window === 'undefined' || jaRecarregou()) throw erro

    anotarRecarga()
    window.location.reload()

    // Promessa que nunca resolve, de propósito: a página está indo embora, e o
    // Suspense segue mostrando o "carregando" até ela ir. Rejeitar aqui
    // pintaria a tela de erro por um instante antes da recarga.
    return new Promise<T>(() => {})
  })
}
