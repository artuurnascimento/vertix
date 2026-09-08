import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ehTabelaAusente } from '../components/produtos/catalogoSupabase'
import { fetchPedidos, reembolsarPedido } from '../components/pedidos/pedidosData'
import type { Pedido } from '../components/pedidos/pedidosData'
import {
  formatCentavos,
  resumoDosPedidos,
} from '../components/pedidos/pedidosResumo'
import PedidosTable from '../components/pedidos/PedidosTable'
import ReembolsoModal from '../components/pedidos/ReembolsoModal'
import FiltroPeriodo from '../components/ui/FiltroPeriodo'
import Toast, { useToast } from '../components/ui/Toast'
import { rotuloDoPeriodo } from '../lib/periodo'
import type { Periodo } from '../lib/periodo'

/**
 * Pedidos — o que foi vendido pelos checkouts próprios (public.pedidos).
 *
 * É a única tela do painel que enxerga essa tabela: a aba de vendas do Vertix
 * Scan lê `raiox_compras`, que é o funil do Scan. Sem esta página, quem vende
 * por checkout não via o que vendeu nem tinha por onde reembolsar.
 *
 * O reembolso mora aqui, e não numa tela de detalhe, porque a decisão se toma
 * olhando a lista: o valor, o estado da entrega e o histórico do cliente
 * estão todos na mesma linha.
 */

const STALE_TIME_MS = 60_000
const SKELETON_ROWS = 4

export default function Pedidos() {
  const queryClient = useQueryClient()
  const { toast, mostrar } = useToast()

  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [paraReembolsar, setParaReembolsar] = useState<Pedido | null>(null)
  const [erroReembolso, setErroReembolso] = useState<string | null>(null)

  const pedidosQuery = useQuery({
    queryKey: ['pedidos', periodo],
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => fetchPedidos(periodo),
  })

  const reembolso = useMutation({
    mutationFn: (pedido: Pedido) => reembolsarPedido(pedido.id),
    onSuccess: async (resultado, pedido) => {
      setParaReembolsar(null)
      setErroReembolso(null)
      // Invalidação e não edição local: o novo status, a data do reembolso e
      // a revogação do acesso são decididos no servidor, e reescrever a linha
      // no cliente mostraria o que ESPERAMOS que tenha acontecido.
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      mostrar({
        texto:
          resultado === 'ja_reembolsado'
            ? `Este pedido de ${pedido.cliente_nome} já estava reembolsado. A lista foi atualizada.`
            : `${formatCentavos(pedido.total_centavos)} devolvidos a ${pedido.cliente_nome}. Acesso revogado.`,
      })
    },
    onError: (erro: unknown) => {
      const mensagem =
        erro instanceof Error
          ? erro.message
          : 'Não deu para reembolsar. Confira no Mercado Pago antes de tentar de novo.'
      // O erro fica NO MODAL, não num toast que some: é a única pista de que
      // o dinheiro pode ou não ter saído, e some junto com a resposta.
      setErroReembolso(mensagem)
    },
  })

  const abrirReembolso = (pedido: Pedido) => {
    setErroReembolso(null)
    setParaReembolsar(pedido)
  }

  const fecharReembolso = () => {
    if (reembolso.isPending) return
    setParaReembolsar(null)
    setErroReembolso(null)
  }

  const migracaoPendente = ehTabelaAusente(pedidosQuery.error)
  const rotuloPeriodo = rotuloDoPeriodo(periodo)
  const dados = pedidosQuery.data
  const pedidos = dados?.pedidos ?? []
  const resumo = resumoDosPedidos(pedidos)

  const cards = [
    { label: `Pedidos pagos · ${rotuloPeriodo}`, valor: resumo.pagos.toLocaleString('pt-BR') },
    { label: `Receita · ${rotuloPeriodo}`, valor: formatCentavos(resumo.receitaCentavos) },
    { label: 'Checkouts abandonados', valor: resumo.aguardando.toLocaleString('pt-BR') },
    {
      label: 'Reembolsado',
      valor: `${formatCentavos(resumo.reembolsadoCentavos)}${
        resumo.reembolsados > 0 ? ` · ${resumo.reembolsados}` : ''
      }`,
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="hero-heading font-kanit text-4xl font-bold leading-tight sm:text-5xl">
            Pedidos
          </h1>
          <p className="mt-2 max-w-xl text-sm font-light text-muted">
            O que foi comprado pelos checkouts: quem comprou, o que levou,
            quanto pagou e em que pé está a entrega. O reembolso sai daqui.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} />
      </div>

      {pedidosQuery.isLoading && (
        <div className="mt-8" aria-label="Carregando pedidos" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-1" />
            ))}
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-surface-1"
                style={{ opacity: 1 - i * 0.22 }}
              />
            ))}
          </div>
        </div>
      )}

      {migracaoPendente && (
        <div className="mt-8 rounded-2xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-ink">
            A tabela de pedidos ainda não existe
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-light leading-relaxed text-muted">
            A tela está pronta, mas este ambiente ainda não tem
            <span className="font-mono"> public.pedidos</span>. Aplique a
            migração do checkout e recarregue a página.
          </p>
        </div>
      )}

      {pedidosQuery.isError && !migracaoPendente && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center"
        >
          <p className="text-sm font-light text-red-100/90">
            Não deu para carregar os pedidos. Tente atualizar a página.
          </p>
        </div>
      )}

      {!pedidosQuery.isLoading && !pedidosQuery.isError && dados && (
        <>
          {dados.total === 0 ? (
            // Estado vazio honesto: zeros em quatro cartões não dizem nada
            // sobre um período em que ninguém comprou.
            <div className="mt-8 rounded-2xl border border-white/5 bg-surface-1 px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
                <Receipt aria-hidden className="h-6 w-6 text-accent" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-ink">
                Nenhum pedido em {rotuloPeriodo}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm font-light leading-relaxed text-muted">
                Todo pagamento iniciado num checkout vira um pedido aqui, mesmo
                o que não foi aprovado. Amplie o período ou divulgue o link da
                oferta.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {cards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-white/5 bg-surface-1 px-4 py-3"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
                      {card.label}
                    </p>
                    <p className="mt-1 truncate tabular-nums text-lg font-semibold text-ink">
                      {card.valor}
                    </p>
                  </div>
                ))}
              </div>

              {dados.truncado && (
                <p className="mt-4 text-xs font-light text-muted">
                  O período tem {dados.total.toLocaleString('pt-BR')} pedidos; os
                  números e a lista cobrem os{' '}
                  {pedidos.length.toLocaleString('pt-BR')} mais recentes.
                </p>
              )}

              <div className="mt-8">
                <PedidosTable
                  pedidos={pedidos}
                  temColunaReembolso={!dados.semColunaReembolso}
                  onReembolsar={abrirReembolso}
                />
              </div>
            </>
          )}
        </>
      )}

      <ReembolsoModal
        pedido={paraReembolsar}
        isPending={reembolso.isPending}
        erro={erroReembolso}
        onConfirm={() => {
          if (paraReembolsar) reembolso.mutate(paraReembolsar)
        }}
        onClose={fecharReembolso}
      />

      <Toast mensagem={toast} />
    </div>
  )
}
