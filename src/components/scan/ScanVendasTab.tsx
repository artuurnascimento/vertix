import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ShoppingBag } from 'lucide-react'
import { fetchScanCompras, reembolsarCompraDoScan } from './comprasData'
import type { ScanCompra } from './comprasData'
import {
  entregaDaCompra,
  formatCentavos,
  resumoDasCompras,
  taxaDeConversao,
} from './comprasResumo'
import ScanComprasTable from './ScanComprasTable'
import ScanReembolsoModal from './ScanReembolsoModal'
import Toast, { useToast } from '../ui/Toast'
import type { Periodo } from '../../lib/periodo'

/**
 * Visão de vendas do Vertix Scan: quanto entrou com o Plano de Correção no
 * período, quantos checkouts ficaram pelo caminho, que fatia dos leads virou
 * venda e — o mais importante — quem pagou e ainda não recebeu.
 *
 * A aba tem consulta própria (public.raiox_compras) e recebe de fora o
 * período do filtro e o total de leads do MESMO período, que é o denominador
 * da conversão. Ler os leads de novo aqui daria dois números diferentes na
 * mesma tela.
 *
 * O REEMBOLSO SAI DAQUI, e não de uma tela de detalhe, porque a decisão se
 * toma olhando a lista: o valor, o estado da entrega e o tempo desde a compra
 * estão todos na mesma linha. É o mesmo arranjo da tela de Pedidos, com a
 * mesma confirmação forte — e estas são as vendas que realmente existem hoje.
 */

const STALE_TIME_MS = 60_000

interface ScanVendasTabProps {
  periodo: Periodo
  rotuloPeriodo: string
  /** Leads captados no mesmo período — denominador da conversão. */
  leadsPeriodo: number
}

export default function ScanVendasTab({
  periodo,
  rotuloPeriodo,
  leadsPeriodo,
}: ScanVendasTabProps) {
  const queryClient = useQueryClient()
  const { toast, mostrar } = useToast()
  const [paraReembolsar, setParaReembolsar] = useState<ScanCompra | null>(null)
  const [erroReembolso, setErroReembolso] = useState<string | null>(null)

  const compras = useQuery({
    queryKey: ['apps-proxy', 'scan', 'compras', periodo],
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => fetchScanCompras(periodo),
  })

  const reembolso = useMutation({
    mutationFn: (compra: ScanCompra) => reembolsarCompraDoScan(compra.id),
    onSuccess: async (resultado, compra) => {
      setParaReembolsar(null)
      setErroReembolso(null)
      // Invalidação e não edição local: o novo status, a data do reembolso e a
      // revogação do plano são decididos no servidor, e reescrever a linha no
      // cliente mostraria o que ESPERAMOS que tenha acontecido.
      await queryClient.invalidateQueries({
        queryKey: ['apps-proxy', 'scan', 'compras'],
      })
      const quem = compra.comprador ?? 'o comprador'
      mostrar({
        texto:
          resultado === 'ja_reembolsado'
            ? `Esta venda para ${quem} já estava reembolsada. A lista foi atualizada.`
            : `${formatCentavos(compra.valor_centavos)} devolvidos a ${quem}. Acesso ao plano revogado.`,
      })
    },
    onError: (erro: unknown) => {
      const mensagem =
        erro instanceof Error
          ? erro.message
          : 'Não deu para reembolsar. Confira no Mercado Pago antes de tentar de novo.'
      // O erro fica NO MODAL, não num toast que some: é a única pista de que o
      // dinheiro pode ou não ter saído, e some junto com a resposta.
      setErroReembolso(mensagem)
    },
  })

  const abrirReembolso = (compra: ScanCompra) => {
    setErroReembolso(null)
    setParaReembolsar(compra)
  }

  const fecharReembolso = () => {
    if (reembolso.isPending) return
    setParaReembolsar(null)
    setErroReembolso(null)
  }

  if (compras.isLoading) {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-1" />
          ))}
        </div>
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-surface-1"
              style={{ opacity: 1 - i * 0.3 }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (compras.isError || !compras.data) {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-6 py-8 text-center">
        <p className="text-sm font-light text-red-100/90">
          Não deu para carregar as vendas do Plano de Correção. Tente atualizar.
        </p>
      </div>
    )
  }

  const { compras: lista, total, truncado } = compras.data

  // Estado vazio honesto: sem nenhuma venda no período, zeros em cartão não
  // dizem nada — é melhor explicar que a venda ainda não aconteceu.
  if (total === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-1 px-6 py-14 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-muted/50" />
        <p className="mt-3 text-sm font-medium text-ink">
          Nenhuma venda do Plano de Correção em {rotuloPeriodo}.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm font-light text-muted">
          {leadsPeriodo > 0
            ? `${leadsPeriodo.toLocaleString('pt-BR')} lead(s) chegaram no período e nenhum comprou ainda — nem checkout aberto existe.`
            : 'Nenhum lead chegou no período, então também não havia a quem vender.'}
        </p>
      </div>
    )
  }

  const { pagas, receitaCentavos, aguardando } = resumoDasCompras(lista)
  const atrasadas = lista.filter((c) => entregaDaCompra(c).alerta)

  const cards = [
    { label: `Vendas pagas · ${rotuloPeriodo}`, valor: pagas.toLocaleString('pt-BR') },
    { label: `Receita · ${rotuloPeriodo}`, valor: formatCentavos(receitaCentavos) },
    { label: 'Checkouts abandonados', valor: aguardando.toLocaleString('pt-BR') },
  ]

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
            Leads que viraram venda
          </p>
          <p className="mt-1 truncate tabular-nums text-lg font-semibold text-ink">
            {taxaDeConversao(pagas, leadsPeriodo)}
          </p>
        </div>
      </div>

      {atrasadas.length > 0 && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="text-sm font-light text-red-100/90">
            {atrasadas.length === 1
              ? '1 cliente pagou há mais de 1 hora e ainda não recebeu o plano.'
              : `${atrasadas.length} clientes pagaram há mais de 1 hora e ainda não receberam o plano.`}{' '}
            Verifique o worker do Scan.
          </p>
        </div>
      )}

      {truncado && (
        <p className="mt-4 text-xs font-light text-muted">
          O período tem {total.toLocaleString('pt-BR')} compras; os números e a
          lista acima cobrem as {lista.length.toLocaleString('pt-BR')} mais
          recentes.
        </p>
      )}

      <div className="mt-8">
        <ScanComprasTable
          compras={lista}
          temColunaReembolso={!compras.data.semColunaReembolso}
          onReembolsar={abrirReembolso}
        />
      </div>

      <ScanReembolsoModal
        compra={paraReembolsar}
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
