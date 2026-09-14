import { Link } from 'react-router-dom'
import { Activity, Copy, ExternalLink, X } from 'lucide-react'
import {
  CLASSE_NIVEL, ROTULO_ORIGEM, contextoSemMigalhas, dataHora, haQuanto, jsonBonito, migalhasDe,
  slugDoCheckout, type LinhaDeLog, type Nivel, type Origem,
} from './logs'

/**
 * O detalhe de uma linha: tudo o que foi gravado, na ordem em que alguém
 * investigando precisa — o que aconteceu, onde, em que aparelho/versão, o
 * que a pessoa fez antes (migalhas) e o que mais aconteceu na mesma
 * requisição ou sessão. Nada é escondido atrás de "ver mais".
 */

const ROTULO_CAMPO: Record<string, string> = {
  rota: 'Rota',
  host: 'Host',
  nav: 'Aba',
  agente: 'Navegador',
  viewport: 'Tela',
  pixel_ratio: 'Densidade',
  toque: 'Toque',
  online: 'Online',
  idioma: 'Idioma',
  visivel: 'Aba visível',
  tempo_na_pagina_s: 'Tempo na página',
  referrer: 'Veio de',
  usuario: 'Usuário',
  memoria_mb: 'Memória (MB)',
  metodo: 'Método',
  caminho: 'Caminho',
  origem_http: 'Origem HTTP',
  pais: 'País',
  function: 'Function',
}

function valorLegivel(chave: string, valor: unknown): string {
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  if (chave === 'tempo_na_pagina_s' && typeof valor === 'number') return `${valor} s`
  if (valor === null || valor === undefined) return '—'
  return typeof valor === 'string' ? valor : JSON.stringify(valor)
}

function Selo({ nivel }: { nivel: Nivel }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CLASSE_NIVEL[nivel]}`}>
      {nivel}
    </span>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{titulo}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

export default function LogDetalhe({
  linha,
  relacionadas,
  agora,
  aoFechar,
  aoEscolher,
}: {
  linha: LinhaDeLog
  relacionadas: LinhaDeLog[]
  agora: Date
  aoFechar: () => void
  aoEscolher: (linha: LinhaDeLog) => void
}) {
  const contexto = contextoSemMigalhas(linha.contexto)
  const migalhas = migalhasDe(linha.contexto)
  const slug = slugDoCheckout(linha.contexto)
  const temDetalhes = linha.detalhes && typeof linha.detalhes === 'object' && Object.keys(linha.detalhes as object).length > 0
  const copiar = () => {
    void navigator.clipboard?.writeText(JSON.stringify(linha, null, 2))
  }

  return (
    <aside aria-label="Detalhe do log" className="rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Selo nivel={linha.nivel as Nivel} />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{ROTULO_ORIGEM[linha.origem as Origem] ?? linha.origem}</span>
            {linha.ocorrencias > 1 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink">×{linha.ocorrencias}</span>
            )}
          </div>
          <h2 className="mt-2 break-words font-mono text-sm text-ink">
            {linha.fonte} <span className="text-muted">·</span> {linha.evento}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={copiar} title="Copiar como JSON" aria-label="Copiar como JSON" className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-ink">
            <Copy aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" onClick={aoFechar} aria-label="Fechar detalhe" className="rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-ink">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{linha.mensagem}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div><dt className="text-muted">Última vez</dt><dd className="tabular-nums text-ink" title={dataHora(linha.ultima_em)}>{haQuanto(linha.ultima_em, agora)} · {dataHora(linha.ultima_em)}</dd></div>
        <div><dt className="text-muted">Primeira vez</dt><dd className="tabular-nums text-ink">{dataHora(linha.criado_em)}</dd></div>
        <div><dt className="text-muted">Versão</dt><dd className="font-mono text-ink">{linha.versao ?? '—'}</dd></div>
        <div><dt className="text-muted">Requisição</dt><dd className="break-all font-mono text-ink">{linha.requisicao_id ?? '—'}</dd></div>
        <div><dt className="text-muted">Sessão do checkout</dt><dd className="break-all font-mono text-ink">{linha.sessao_id ? linha.sessao_id.slice(0, 8) + '…' : '—'}</dd></div>
        <div><dt className="text-muted">Usuário</dt><dd className="break-all font-mono text-ink">{linha.usuario_id ? linha.usuario_id.slice(0, 8) + '…' : '—'}</dd></div>
      </dl>

      {linha.sessao_id && slug && (
        <Link to={`/admin/checkouts?checkout=${encodeURIComponent(slug)}`} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <Activity aria-hidden className="h-3.5 w-3.5" /> Ver esta visita no Ao vivo
          <ExternalLink aria-hidden className="h-3 w-3" />
        </Link>
      )}

      {temDetalhes && (
        <Bloco titulo="Detalhes">
          <pre className="max-h-80 overflow-auto rounded-xl border border-white/5 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-ink/90">{jsonBonito(linha.detalhes)}</pre>
        </Bloco>
      )}

      {Object.keys(contexto).length > 0 && (
        <Bloco titulo="Contexto">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
            {Object.entries(contexto).map(([chave, valor]) => (
              <div key={chave} className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-muted">{ROTULO_CAMPO[chave] ?? chave}</dt>
                <dd className="min-w-0 break-words text-ink">{valorLegivel(chave, valor)}</dd>
              </div>
            ))}
          </dl>
        </Bloco>
      )}

      {migalhas.length > 0 && (
        <Bloco titulo="O que aconteceu antes">
          <ol className="space-y-1 border-l border-white/10 pl-3 text-xs">
            {migalhas.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-14 shrink-0 tabular-nums text-muted">{(m.t / 1000).toFixed(1)} s</span>
                <span className="w-16 shrink-0 text-muted">{m.tipo}</span>
                <span className="min-w-0 break-words text-ink">{m.texto}{m.dados ? ` ${JSON.stringify(m.dados)}` : ''}</span>
              </li>
            ))}
          </ol>
        </Bloco>
      )}

      {relacionadas.length > 0 && (
        <Bloco titulo="Na mesma requisição ou sessão">
          <ul className="space-y-1">
            {relacionadas.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => aoEscolher(r)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/5">
                  <Selo nivel={r.nivel as Nivel} />
                  <span className="font-mono text-muted">{r.fonte}</span>
                  <span className="min-w-0 truncate text-ink">{r.mensagem}</span>
                </button>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </aside>
  )
}
