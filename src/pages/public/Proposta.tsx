import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleSlash, LinkIcon, RotateCw } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import LogoMark from '../../components/ui/LogoMark'
import PropostaDeck from '../../components/proposals/deck/PropostaDeck'
import { parseProposalDeck } from '../../components/proposals/deck/deckData'
import {
  formatBRL,
  formatDateBR,
} from '../../lib/commercial'
import {
  parseProposalByToken,
  parseRespondResult,
} from '../../components/proposals/proposalData'
import type { ProposalByToken } from '../../components/proposals/proposalData'

/** Código Postgres para uuid malformado — tratado como link inválido. */
const INVALID_UUID_CODE = '22P02'

type Choice = 'aceitar' | 'recusar'

const inputClass =
  'w-full min-h-11 rounded-lg border border-white/5 bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-accent/60 focus:ring-2 focus:ring-accent/25 hover:border-white/10'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 py-10 font-kanit sm:px-6 sm:py-16">
      <div aria-hidden className="app-ambient pointer-events-none fixed inset-0" />
      <div className="relative mx-auto w-full max-w-2xl">
        <header className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-[0.35em] text-ink">
            VERTIX
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

function StatusScreen({
  icon,
  title,
  message,
}: {
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        {icon}
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          {message}
        </p>
      </motion.div>
    </Shell>
  )
}

function SuccessCheck() {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
      <motion.svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <motion.path
          d="M4 12.5 9.5 18 20 6.5"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        />
      </motion.svg>
    </span>
  )
}

function InvalidLinkScreen() {
  return (
    <StatusScreen
      icon={
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LinkIcon className="h-6 w-6 text-muted" />
        </span>
      }
      title="Link inválido"
      message="Esta proposta não existe ou não está mais disponível. Peça um novo link para a equipe Vertix."
    />
  )
}

function LoadErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        role="alert"
        className="mt-14 flex flex-col items-center rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center sm:mt-20"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <RotateCw className="h-6 w-6 text-muted" />
        </span>
        <h1 className="hero-heading mt-6 text-2xl font-bold sm:text-3xl">
          Não foi possível carregar a proposta
        </h1>
        <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-muted">
          Houve um problema de conexão. Tente novamente.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 touch-manipulation rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-colors duration-200 hover:bg-accent-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Recarregar
        </button>
      </motion.div>
    </Shell>
  )
}

function AcceptedScreen() {
  return (
    <StatusScreen
      icon={<SuccessCheck />}
      title="Proposta aceita!"
      message="A equipe Vertix vai entrar em contato para dar início ao projeto."
    />
  )
}

function DeclinedScreen() {
  return (
    <StatusScreen
      icon={
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <CircleSlash className="h-6 w-6 text-muted" />
        </span>
      }
      title="Resposta registrada"
      message="Você recusou esta proposta. Se mudar de ideia ou quiser conversar sobre ajustes, é só falar com a equipe Vertix."
    />
  )
}

function respondErrorMessage(error: string | undefined): string {
  if (error === 'indisponivel') {
    return 'Esta proposta não está mais disponível para resposta. Fale com a equipe Vertix.'
  }
  if (error === 'nome_obrigatorio') {
    return 'Informe seu nome completo para confirmar.'
  }
  return 'Não foi possível registrar sua resposta. Tente novamente.'
}

function ResponseBanner({ proposta }: { proposta: ProposalByToken['proposta'] }) {
  if (proposta.status === 'aceita') {
    return (
      <div className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-4 text-sm leading-relaxed text-emerald-300">
        Proposta aceita
        {proposta.aceite_nome && (
          <>
            {' '}
            por <span className="font-medium">{proposta.aceite_nome}</span>
          </>
        )}
        {proposta.accepted_at && ` em ${formatDateBR(proposta.accepted_at)}`}. A
        equipe Vertix vai entrar em contato.
      </div>
    )
  }
  if (proposta.status === 'recusada') {
    return (
      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-relaxed text-muted">
        Esta proposta foi recusada. Se quiser retomar a conversa, fale com a
        equipe Vertix.
      </div>
    )
  }
  return null
}

export default function Proposta() {
  const { token } = useParams<{ token: string }>()
  const [nome, setNome] = useState('')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const [rootError, setRootError] = useState<string | null>(null)
  const [pendingChoice, setPendingChoice] = useState<Choice | null>(null)
  const [responded, setResponded] = useState<Choice | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['proposal-public', token],
    enabled: Boolean(token),
    retry: false,
    // Enquanto o cliente estiver no checkout da entrada, a página fica
    // observando o pagamento — quando o receivable vira "pago" (webhook MP ou
    // baixa manual), os próximos passos aparecem sem precisar recarregar.
    refetchInterval: (query) => {
      const atual = query.state.data
      if (!atual) return false
      const aguardandoPagamento =
        atual.proposta.status === 'aceita' &&
        atual.proposta.entrada?.status === 'pendente'
      return aguardandoPagamento ? 8000 : false
    },
    queryFn: async () => {
      const { data: payload, error } = await supabase.rpc(
        'get_proposal_by_token',
        { t: token ?? '' }
      )
      if (error) {
        if (error.code === INVALID_UUID_CODE) return null
        throw new Error(error.message)
      }
      return parseProposalByToken(payload)
    },
  })

  const mutation = useMutation({
    mutationFn: async (choice: Choice) => {
      const { data: payload, error } = await supabase.rpc('respond_proposal', {
        t: token ?? '',
        p_aceite: choice === 'aceitar',
        p_nome: nome.trim(),
      })
      if (error) throw new Error(error.message)
      return { choice, result: parseRespondResult(payload) }
    },
    onSuccess: ({ choice, result }) => {
      if (result.success) {
        setResponded(choice)
        // No aceite, recarrega o payload: o respond_proposal acabou de criar
        // os receivables e o deck precisa da entrada para montar o checkout.
        if (choice === 'aceitar') void refetch()
        return
      }
      setPendingChoice(null)
      setRootError(respondErrorMessage(result.error))
    },
    onError: () => {
      setPendingChoice(null)
      setRootError('Não foi possível registrar sua resposta. Tente novamente.')
    },
  })

  if (responded === 'recusar') return <DeclinedScreen />

  if (isLoading) {
    return (
      <Shell>
        <div className="mt-14 sm:mt-20" aria-label="Carregando proposta">
          <div className="h-9 w-64 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
          <div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface-1" />
        </div>
      </Shell>
    )
  }

  if (isError) return <LoadErrorScreen onRetry={() => refetch()} />
  if (!data) return <InvalidLinkScreen />

  const { proposta, projeto_nome: projetoNome, cliente } = data
  const deck = parseProposalDeck(proposta.apresentacao)

  if (responded === 'aceitar' && !deck) return <AcceptedScreen />

  const aceito = responded === 'aceitar' || proposta.status === 'aceita'
  const canRespond = proposta.status === 'enviada' && responded === null

  const startChoice = (choice: Choice) => {
    setRootError(null)
    if (nome.trim() === '') {
      setNomeError('Informe seu nome completo para responder.')
      return
    }
    setNomeError(null)
    setPendingChoice(choice)
  }

  const respostaSection = canRespond ? (
    <div className="mt-6 max-w-2xl rounded-2xl border border-white/5 bg-surface-1 p-5 sm:p-8">
      <h2 className="text-base font-semibold text-ink">Responder proposta</h2>
      <p className="mt-1 text-sm font-light text-muted">
        Confirme seu nome completo para registrar a resposta.
      </p>

      <label className="mt-5 flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">
          Seu nome completo
          <span aria-hidden className="ml-1 text-accent">
            *
          </span>
        </span>
        <input
          type="text"
          autoComplete="name"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value)
            if (nomeError) setNomeError(null)
          }}
          placeholder="Maria da Silva"
          aria-invalid={Boolean(nomeError)}
          className={inputClass}
        />
        {nomeError && (
          <span role="alert" className="text-xs text-red-400">
            {nomeError}
          </span>
        )}
      </label>

      {rootError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          {rootError}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {pendingChoice === null ? (
          <motion.div
            key="choices"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <button
              type="button"
              onClick={() => startChoice('aceitar')}
              className="flex-1 touch-manipulation rounded-lg bg-accent px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(108,91,242,0.6)] transition-all duration-200 hover:bg-accent-2 hover:shadow-[0_10px_28px_-8px_rgba(85,70,224,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Aceitar proposta
            </button>
            <button
              type="button"
              onClick={() => startChoice('recusar')}
              className="flex-1 touch-manipulation rounded-lg border border-white/10 px-5 py-3.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Recusar
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-6 rounded-xl border border-white/10 bg-surface-2/60 p-4"
          >
            <p className="text-sm text-ink">
              {pendingChoice === 'aceitar'
                ? `Confirmar o aceite da proposta como ${nome.trim()}?`
                : `Confirmar a recusa da proposta como ${nome.trim()}?`}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(pendingChoice)}
                className={`flex-1 touch-manipulation rounded-lg px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${
                  pendingChoice === 'aceitar'
                    ? 'bg-accent hover:bg-accent-2'
                    : 'bg-red-500/90 hover:bg-red-500'
                }`}
              >
                {mutation.isPending
                  ? 'Registrando…'
                  : pendingChoice === 'aceitar'
                    ? 'Confirmar aceite'
                    : 'Confirmar recusa'}
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => setPendingChoice(null)}
                className="flex-1 touch-manipulation rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                Voltar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : null

  if (deck) {
    return (
      <PropostaDeck
        deck={deck}
        proposta={proposta}
        cliente={cliente}
        aceito={aceito}
        aceiteNome={
          proposta.aceite_nome ?? (responded === 'aceitar' ? nome.trim() : null)
        }
      >
        {respostaSection}
      </PropostaDeck>
    )
  }

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mt-10 sm:mt-14"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-accent">
          Proposta comercial
        </p>
        <h1 className="hero-heading mt-2 break-words text-3xl font-bold leading-tight sm:text-4xl">
          {proposta.titulo}
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted">
          {projetoNome} · {cliente.nome}
          {cliente.empresa && ` — ${cliente.empresa}`}
        </p>

        <ResponseBanner proposta={proposta} />

        {/* Corpo da proposta */}
        <div className="mt-8 rounded-2xl border border-white/5 bg-surface-1 p-5 shadow-[0_24px_80px_-40px_rgba(108,91,242,0.3)] sm:p-8">
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[26rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-surface-2/50 text-[11px] uppercase tracking-widest text-muted">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 text-center font-medium">Qtd</th>
                  <th className="px-3 py-3 text-right font-medium">Unitário</th>
                  <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {proposta.itens.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-light text-ink/90">
                      {item.descricao}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-muted">
                      {item.quantidade}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">
                      {formatBRL(item.valor_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">
                      {formatBRL(item.quantidade * item.valor_unitario)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col items-end gap-1">
            {proposta.desconto > 0 && (
              <p className="text-xs font-light tabular-nums text-muted">
                Desconto: −{formatBRL(proposta.desconto)}
              </p>
            )}
            <p className="text-[11px] uppercase tracking-widest text-muted">
              Total
            </p>
            <p className="text-3xl font-bold tabular-nums text-accent">
              {formatBRL(proposta.valor_total)}
            </p>
          </div>

          {proposta.condicoes && (
            <div className="mt-6 border-t border-white/5 pt-5">
              <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted">
                Condições
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm font-light leading-relaxed text-ink/85">
                {proposta.condicoes}
              </p>
            </div>
          )}

          {proposta.parcelas && proposta.parcelas.length > 0 && (
            <div className="mt-6 border-t border-white/5 pt-5">
              <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted">
                Parcelas
              </h2>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/5">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {proposta.parcelas.map((parcela, index) => (
                      <tr
                        key={index}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-4 py-2.5 font-light text-ink/90">
                          {parcela.descricao}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                          {formatDateBR(parcela.vencimento)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">
                          {formatBRL(parcela.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {proposta.validade && (
            <p className="mt-6 text-xs font-light text-muted">
              Proposta válida até{' '}
              <span className="font-medium text-ink/80">
                {formatDateBR(proposta.validade)}
              </span>
              .
            </p>
          )}
        </div>

        {/* Resposta do cliente */}
        {respostaSection}
      </motion.div>
    </Shell>
  )
}
