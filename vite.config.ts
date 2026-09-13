import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

interface Novidade {
  data: string
  titulo: string
  itens: string[]
}

function git(comando: string, padrao: string): string {
  try {
    return execSync(`git ${comando}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return padrao
  }
}

/** "feat: cards do painel…" → "Cards do painel…" — o prefixo é jargão de commit. */
function limparAssunto(assunto: string): string {
  const semPrefixo = assunto.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '')
  return semPrefixo.charAt(0).toUpperCase() + semPrefixo.slice(1)
}

/**
 * Versão do app e o que mudou nela — para o aviso "tem versão nova".
 *
 * O build grava `versao.json` com o hash do commit e as novidades. O app em
 * execução compara com o hash embutido nele (`__VERSAO_APP__`): diferente =
 * saiu deploy novo, aparece o aviso com a descrição.
 *
 * A descrição vem de `src/novidades.json` (escrita à mão, a entrada mais
 * recente). Se o commit do build é de um dia posterior à última nota — ou
 * seja, ninguém escreveu a nota deste deploy —, os assuntos dos commits
 * desde a nota entram como itens, para o aviso nunca descrever uma versão
 * antiga como se fosse a nova.
 */
function versaoPlugin(): Plugin {
  const versao = git('rev-parse --short HEAD', 'dev')
  const dataCommit = git('log -1 --format=%cI', new Date().toISOString())
  const notas = JSON.parse(readFileSync('src/novidades.json', 'utf8')) as Novidade[]
  const ultima = notas[0] ?? { data: '1970-01-01', titulo: 'Atualização', itens: [] }
  const notaDesatualizada = dataCommit.slice(0, 10) > ultima.data
  const commits = notaDesatualizada
    ? git(`log --since=${ultima.data}T23:59:59 --no-merges --format=%s`, '')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map(limparAssunto)
    : []
  const conteudo = JSON.stringify({
    versao,
    data: dataCommit,
    titulo: notaDesatualizada ? 'Atualização do sistema' : ultima.titulo,
    itens: notaDesatualizada && commits.length > 0 ? commits : ultima.itens,
  })

  return {
    name: 'vertix-versao',
    config: () => ({ define: { __VERSAO_APP__: JSON.stringify(versao) } }),
    configureServer(servidor) {
      servidor.middlewares.use('/versao.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(conteudo)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'versao.json', source: conteudo })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versaoPlugin()],
})
