import { useRef, useState } from 'react'
import { Loader2, Trash2, UserRound } from 'lucide-react'
import { FOTO_TIPOS, enviarFoto, validarFoto } from './fotoDepoimento'

interface Props {
  /** URL atual, ou `null` quando o depoimento ainda não tem foto. */
  valor: string | null
  onChange: (url: string | null) => void
  /** Aparece no rótulo acessível, para distinguir um depoimento do outro. */
  posicao: number
}

/**
 * Foto de perfil de um depoimento: escolher, ver e remover.
 *
 * O estado de envio vive aqui, e não no editor inteiro, porque cada depoimento
 * envia a sua foto de forma independente — subir uma não pode congelar os
 * outros campos do formulário.
 *
 * A prévia é a imagem JÁ ENVIADA, não um `URL.createObjectURL` do arquivo
 * escolhido. Mostrar o arquivo local daria a impressão de que deu tudo certo
 * mesmo quando o envio falhou, e a pessoa só descobriria ao abrir a página
 * pública e encontrar o círculo vazio.
 */
export default function FotoDepoimentoCampo({
  valor,
  onChange,
  posicao,
}: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return

    const recusa = validarFoto(arquivo)
    if (recusa !== null) {
      setErro(recusa)
      return
    }

    setErro(null)
    setEnviando(true)
    try {
      onChange(await enviarFoto(arquivo))
    } catch {
      // Mensagem genérica de propósito: o erro do storage vem em inglês e fala
      // de bucket e policy, o que não ajuda quem está cadastrando depoimento.
      setErro('Não foi possível enviar a foto. Tente de novo.')
    } finally {
      setEnviando(false)
      // Zera o input para que escolher o MESMO arquivo de novo dispare o
      // evento — sem isso, tentar outra vez depois de uma falha não faz nada.
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-surface-2">
        {valor ? (
          <img src={valor} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserRound aria-hidden className="h-5 w-5 text-muted/50" />
        )}
        {enviando && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface-2/80">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin text-accent" />
          </span>
        )}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            className="rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-xs text-ink transition-colors duration-150 hover:border-white/25 disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : valor ? 'Trocar foto' : 'Adicionar foto'}
          </button>

          {valor && !enviando && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setErro(null)
              }}
              aria-label={`Remover foto do depoimento ${posicao}`}
              className="rounded-lg p-1.5 text-muted/60 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {erro ? (
          <p role="alert" className="mt-1 text-[11px] text-red-300">
            {erro}
          </p>
        ) : (
          <p className="mt-1 text-[11px] font-light text-muted/70">
            Opcional. Cortamos no centro e reduzimos para o tamanho do círculo.
          </p>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept={FOTO_TIPOS.join(',')}
        onChange={(e) => void escolher(e.target.files?.[0])}
        aria-label={`Foto do depoimento ${posicao}`}
        className="sr-only"
      />
    </div>
  )
}
