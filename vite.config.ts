import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function git(comando: string, padrao: string): string {
  try {
    return execSync(`git ${comando}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return padrao
  }
}

/** Quantos commits o versao.json carrega — quem está mais atrás que isso vê a lista inteira. */
const TAMANHO_DO_HISTORICO = 80

/**
 * Versão do app e o histórico do que entrou — para o aviso "tem versão nova".
 *
 * O build grava `versao.json` com o hash do commit e os últimos commits
 * (hash, data, assunto). O app em execução compara com o hash embutido nele
 * (`__VERSAO_APP__`): diferente = saiu deploy novo, e o aviso lista os
 * assuntos dos commits que vieram DEPOIS da versão daquela aba — nunca os
 * de uma atualização que a pessoa já recebeu. Por isso as mensagens de
 * commit deste repositório são escritas para quem usa o painel, em
 * português, e não em jargão.
 */
function versaoPlugin(): Plugin {
  const versao = git('rev-parse --short HEAD', 'dev')
  const dataCommit = git('log -1 --format=%cI', new Date().toISOString())
  const historico = git(`log -${TAMANHO_DO_HISTORICO} --no-merges --format=%h%x1f%cI%x1f%s`, '')
    .split('\n')
    .filter((l) => l.includes('\x1f'))
    .map((l) => {
      const [hash, data, assunto] = l.split('\x1f')
      return { versao: hash, data, assunto }
    })
  const conteudo = JSON.stringify({ versao, data: dataCommit, historico })

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
