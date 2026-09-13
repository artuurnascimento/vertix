import { variacao } from './antesDepoisData'
import type { AntesDepois } from './antesDepoisData'

interface Props {
  dados: AntesDepois
}

function nota(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(1).replace('.', ',')
}

function lcp(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(1).replace('.', ',')} s`
}

function data(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Antes → depois no portal do cliente: a nota e o LCP da análise original
 * do Scan contra a medição mais recente, e os problemas que a medição não
 * encontra mais. É a prova de resultado da correção — com a ressalva certa:
 * mede a loja, não atribui vendas.
 */
export default function PortalAntesDepois({ dados }: Props) {
  const delta = variacao(dados.antes.nota, dados.depois.nota)
  const subiu = delta?.startsWith('+')
  const caiu = delta?.startsWith('−')

  return (
    <div data-testid="portal-antes-depois">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Nota antes</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-muted">{nota(dados.antes.nota)}</p>
          <p className="text-[11px] text-muted">{data(dados.antes.medido_em)}</p>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-accent">Nota agora</p>
          <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums text-ink">
            {nota(dados.depois.nota)}
            {delta && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  subiu ? 'bg-emerald-400/15 text-emerald-300' : caiu ? 'bg-red-400/15 text-red-300' : 'bg-white/10 text-muted'
                }`}
              >
                {delta}
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted">{data(dados.depois.medido_em)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Carregamento (LCP)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
            <span className="text-muted">{lcp(dados.antes.lcp_s)}</span>
            <span className="mx-1.5 text-muted">→</span>
            {lcp(dados.depois.lcp_s)}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Problemas</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
            <span className="text-emerald-300">{dados.resolvidos.length} resolvidos</span>
          </p>
          <p className="text-[11px] text-muted">
            {dados.abertos} {dados.abertos === 1 ? 'aberto' : 'abertos'}
            {dados.novos.length > 0 && ` · ${dados.novos.length} ${dados.novos.length === 1 ? 'novo' : 'novos'}`}
          </p>
        </div>
      </div>

      {dados.resolvidos.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5" aria-label="Problemas resolvidos">
          {dados.resolvidos.map((titulo) => (
            <li key={titulo} className="flex items-start gap-2 text-sm text-ink/85">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {titulo}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs font-light leading-relaxed text-muted">
        Medimos a loja com o mesmo Scan da análise original{dados.dominio ? ` (${dados.dominio})` : ''}. Os números
        mostram o que mudou na loja — não atribuem vendas a nenhuma correção.
      </p>
    </div>
  )
}
