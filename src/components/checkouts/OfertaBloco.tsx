import { AlertTriangle } from 'lucide-react'
import { Bloco, inputClass, labelClass } from '../produtos/formUi'
import { formatCentavos } from '../produtos/precos'
import type { Produto } from '../produtos/produtosData'

interface Props {
  titulo: string
  ajuda: string
  /** Produtos do catálogo, para o select. */
  produtos: readonly Produto[]
  /** Produto principal do checkout — não pode ser escolhido aqui. */
  produtoPrincipalId: string
  produtoId: string
  tituloOferta: string
  textoOferta: string
  erro?: string
  rotuloTitulo: string
  rotuloTexto: string
  onProdutoId: (valor: string) => void
  onTitulo: (valor: string) => void
  onTexto: (valor: string) => void
}

/**
 * Bloco de uma oferta adicional (order bump, upsell ou downsell): qual
 * produto, o título e o texto que aparecem na página. O produto principal
 * aparece desabilitado no select — oferecer de novo o que a pessoa acabou de
 * comprar cobraria duas vezes o mesmo item.
 */
export default function OfertaBloco({
  titulo,
  ajuda,
  produtos,
  produtoPrincipalId,
  produtoId,
  tituloOferta,
  textoOferta,
  erro,
  rotuloTitulo,
  rotuloTexto,
  onProdutoId,
  onTitulo,
  onTexto,
}: Props) {
  const escolhido = produtoId !== ''
  return (
    <Bloco titulo={titulo} ajuda={ajuda}>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Produto</span>
        <select
          value={produtoId}
          onChange={(e) => onProdutoId(e.target.value)}
          className={`${inputClass} appearance-none`}
        >
          <option value="">Sem esta oferta</option>
          {produtos.map((produto) => {
            const ehPrincipal = produto.id === produtoPrincipalId
            return (
              <option key={produto.id} value={produto.id} disabled={ehPrincipal}>
                {produto.nome} · {formatCentavos(produto.preco_centavos)}
                {ehPrincipal ? ' (produto principal)' : ''}
                {produto.ativo ? '' : ' (inativo)'}
              </option>
            )
          })}
        </select>
        {erro && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
            {erro}
          </span>
        )}
      </label>

      {escolhido && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{rotuloTitulo}</span>
            <input
              type="text"
              value={tituloOferta}
              onChange={(e) => onTitulo(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{rotuloTexto}</span>
            <textarea
              rows={2}
              value={textoOferta}
              onChange={(e) => onTexto(e.target.value)}
              className={`${inputClass} resize-y`}
            />
          </label>
        </>
      )}
    </Bloco>
  )
}
