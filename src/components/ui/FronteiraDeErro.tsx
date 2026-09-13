import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface Estado {
  quebrou: boolean
}

/**
 * A rede de segurança: erro em render vira mensagem, não tela preta.
 *
 * Sem ela, qualquer exceção durante o render desmonta a árvore inteira e o
 * React deixa o `<div id="root">` VAZIO — no checkout, uma página preta sem
 * texto e sem botão segundos depois de alguém pagar. O `carregarPagina`
 * recarrega uma vez quando um chunk some depois de um deploy; se a segunda
 * tentativa também falhar (sem rede, servidor fora), é aqui que a pessoa
 * encontra uma saída em vez do vazio.
 *
 * O texto é curto de propósito: o que aconteceu e o único botão que resolve.
 * Recarregar é honesto — a rota está na URL, e é para ela que a pessoa volta.
 *
 * Precisa ser classe: `componentDidCatch` não tem equivalente em hook.
 */
export default class FronteiraDeErro extends Component<Props, Estado> {
  state: Estado = { quebrou: false }

  static getDerivedStateFromError(): Estado {
    return { quebrou: true }
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    // O console é o que sobra para depurar: engolir a exceção em silêncio
    // esconderia a causa da próxima vez.
    console.error('[vertix] erro de render', erro, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.quebrou) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 font-kanit text-ink">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <AlertTriangle aria-hidden className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-semibold leading-snug">Essa tela não carregou</h1>
          <p className="text-sm font-light leading-relaxed text-muted">
            Foi um problema aqui do nosso lado. Recarregar costuma resolver — o endereço continua o
            mesmo e nada do que você fez se perde.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-2"
          >
            Recarregar
          </button>
        </div>
      </main>
    )
  }
}
