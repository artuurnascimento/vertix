/**
 * Identidades do log no navegador.
 *
 *   idDaAba()            Um id por ABA (sessionStorage): é o fio que liga
 *                        tudo o que uma pessoa fez numa visita — os erros
 *                        dela, as chamadas às edge functions (vai no
 *                        cabeçalho `x-vx-nav`), o rastreio do checkout.
 *
 *   novoIdDeRequisicao() Um id por chamada de rede: o navegador o manda em
 *                        `x-vx-requisicao`, a edge function o repete no log
 *                        dela e devolve no cabeçalho de resposta. Com ele, o
 *                        erro que a pessoa viu e o erro que o servidor
 *                        registrou são a MESMA linha de investigação.
 */

const CHAVE_ABA = 'vx-nav'

function hex(bytes: number): string {
  const c = globalThis.crypto
  const arr = new Uint8Array(bytes)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(arr)
  else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

let abaEmMemoria: string | null = null

export function idDaAba(): string {
  if (abaEmMemoria) return abaEmMemoria
  try {
    const guardado = window.sessionStorage.getItem(CHAVE_ABA)
    if (guardado && /^[a-f0-9]{12}$/.test(guardado)) {
      abaEmMemoria = guardado
      return guardado
    }
  } catch {
    // sem storage: vale só enquanto a página vive
  }
  abaEmMemoria = hex(6)
  try {
    window.sessionStorage.setItem(CHAVE_ABA, abaEmMemoria)
  } catch {
    // idem
  }
  return abaEmMemoria
}

export function novoIdDeRequisicao(): string {
  return hex(8)
}
