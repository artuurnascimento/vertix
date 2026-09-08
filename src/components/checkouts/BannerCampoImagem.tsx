import { ImageUp, Loader2, Trash2 } from 'lucide-react'
import { labelClass } from '../produtos/formUi'
import {
  BANNER_TIPOS,
  VARIANTE_LABEL,
  type BannerImagem,
  type VarianteBanner,
} from './bannerUpload'

interface Props {
  variante: VarianteBanner
  imagem: BannerImagem | null
  /** Medida sugerida, mostrada como dica — não é validada. */
  dica: string
  enviando: boolean
  erro: string | null
  onArquivo: (arquivo: File) => void
  onRemover: () => void
}

/**
 * Uma das duas artes do banner. Prévia, troca e remoção no mesmo lugar: sem a
 * prévia a pessoa salva no escuro, e é o topo da página de venda que está em
 * jogo.
 *
 * O input de arquivo é `sr-only` (e não `hidden`) de propósito: ele continua
 * no fluxo de foco do teclado, e o anel de foco aparece na moldura pelo
 * `peer-focus-visible`.
 */
export default function BannerCampoImagem({
  variante,
  imagem,
  dica,
  enviando,
  erro,
  onArquivo,
  onRemover,
}: Props) {
  const rotulo = VARIANTE_LABEL[variante]
  const medidas =
    imagem?.largura && imagem.altura
      ? `${imagem.largura} × ${imagem.altura}`
      : null

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>{rotulo}</span>

      <label className="group flex cursor-pointer flex-col gap-2">
        <input
          type="file"
          accept={BANNER_TIPOS.join(',')}
          disabled={enviando}
          className="peer sr-only"
          onChange={(event) => {
            const arquivo = event.target.files?.[0]
            // Zera o valor para que escolher O MESMO arquivo de novo (depois
            // de um erro, por exemplo) volte a disparar o onChange.
            event.target.value = ''
            if (arquivo) onArquivo(arquivo)
          }}
        />

        <div
          className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-3 text-center transition-colors duration-150 peer-focus-visible:border-accent/60 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/25 ${
            imagem
              ? 'border-white/10 bg-surface-2'
              : 'border-white/10 hover:border-white/25'
          }`}
        >
          {enviando ? (
            <>
              <Loader2
                aria-hidden
                className="h-5 w-5 animate-spin text-accent"
              />
              <span className="text-xs font-light text-muted">Enviando…</span>
            </>
          ) : imagem ? (
            <img
              src={imagem.url}
              alt={`Prévia do banner ${rotulo.toLowerCase()}`}
              width={imagem.largura ?? undefined}
              height={imagem.altura ?? undefined}
              className="max-h-24 w-full rounded object-contain"
            />
          ) : (
            <>
              <ImageUp aria-hidden className="h-5 w-5 text-muted/60" />
              <span className="text-xs font-light text-muted">
                Enviar imagem {rotulo.toLowerCase()}
              </span>
              <span className="text-[11px] font-light text-muted/70">
                {dica} · até 1 MB
              </span>
            </>
          )}
        </div>
      </label>

      {imagem && !enviando && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-light tabular-nums text-muted/70">
            {medidas ?? 'medidas não lidas'}
          </span>
          <button
            type="button"
            onClick={onRemover}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted/70 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
            Remover {rotulo.toLowerCase()}
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-xs text-red-400">
          {erro}
        </p>
      )}
    </div>
  )
}
