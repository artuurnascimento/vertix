/**
 * O shader do fundo é WebGL 2 (`#version 300 es`); sem ele o `ogl` cai para
 * WebGL 1 e a compilação falha aos berros no console. Nesse caso, e no jsdom
 * dos testes, o fundo fica só na cor de base.
 */
export function suportaWebGl2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') != null
  } catch {
    return false
  }
}
