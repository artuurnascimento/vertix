/**
 * O shader do fundo precisa de WebGL (o `ogl` pede WebGL 2 e cai para 1).
 * Sem nenhum dos dois — e no jsdom dos testes — o fundo fica só na cor de
 * base, em vez de um canvas preto e erros no console.
 */
export function suportaWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') != null || canvas.getContext('webgl') != null
  } catch {
    return false
  }
}
