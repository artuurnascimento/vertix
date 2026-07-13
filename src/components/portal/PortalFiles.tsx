import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatFileSize } from './portalData'
import type { PortalFile } from './portalData'

/**
 * Seção "Arquivos" do portal — lista os arquivos liberados ao cliente
 * (project_files.visivel_cliente = true) e baixa via bucket 'project-files'.
 *
 * Download: tenta createSignedUrl primeiro (mais leve, sem carregar o blob
 * na memória do navegador); a policy de storage.objects para anon já libera
 * SELECT nos arquivos visíveis (ver migration fase 14). Se createSignedUrl
 * falhar por qualquer motivo, cai para .download() + object URL local.
 */

const SIGNED_URL_TTL_SECONDS = 60

async function downloadViaBlobFallback(
  storagePath: string,
  nomeArquivo: string
): Promise<void> {
  const { data: blob, error } = await supabase.storage
    .from('project-files')
    .download(storagePath)
  if (error || !blob) {
    throw new Error(error?.message ?? 'Não foi possível baixar o arquivo.')
  }
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

async function downloadFile(file: PortalFile): Promise<void> {
  const { data: signed, error: signedError } = await supabase.storage
    .from('project-files')
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS)

  if (!signedError && signed?.signedUrl) {
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer')
    return
  }

  await downloadViaBlobFallback(file.storage_path, file.nome)
}

function FileRow({ file }: { file: PortalFile }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const handleDownload = async () => {
    setStatus('loading')
    try {
      await downloadFile(file)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/5 bg-surface-2 p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <FileText aria-hidden className="h-4 w-4 text-muted" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{file.nome}</p>
        {file.tamanho != null && (
          <p className="mt-0.5 text-xs font-light text-muted">
            {formatFileSize(file.tamanho)}
          </p>
        )}
        {status === 'error' && (
          <p role="alert" className="mt-0.5 text-xs text-red-400">
            Não foi possível baixar. Tente novamente.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === 'loading'}
        aria-label={`Baixar ${file.nome}`}
        className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-white/10 text-muted transition-colors duration-200 hover:bg-white/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {status === 'loading' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <Download aria-hidden className="h-4 w-4" />
        )}
      </button>
    </li>
  )
}

interface PortalFilesProps {
  files: PortalFile[]
}

/**
 * Lista pura — a busca via get_portal_files e a decisão de ocultar a seção
 * quando vazia ficam no Portal.tsx (mesmo padrão de propostas/atividades).
 */
export default function PortalFiles({ files }: PortalFilesProps) {
  return (
    <ul className="flex flex-col gap-2.5">
      {files.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </ul>
  )
}
