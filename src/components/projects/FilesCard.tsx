import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Download,
  Eye,
  EyeOff,
  File,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Tables } from '../../lib/database.types'

type ProjectFile = Tables<'project_files'>

interface FilesCardProps {
  projectId: string
}

const BUCKET = 'project-files'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const SIGNED_URL_TTL_S = 60

/**
 * Allowlist de extensões. SVG e HTML ficam de fora de propósito: ambos podem
 * carregar script e, servidos do mesmo domínio de storage, viram XSS
 * armazenado. Quem precisa mandar logo em vetor manda PDF ou zipa o arquivo.
 */
const EXTENSOES_PERMITIDAS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md',
  'zip', 'rar', '7z',
  'mp4', 'mov', 'webm', 'mp3', 'wav',
  'psd', 'ai', 'fig', 'sketch', 'eps',
  'ttf', 'otf', 'woff', 'woff2',
]

function extensaoDe(nome: string): string {
  const partes = nome.toLowerCase().split('.')
  return partes.length > 1 ? partes[partes.length - 1] : ''
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/** Card de arquivos do projeto — dropzone de upload + lista com visibilidade. */
export default function FilesCard({ projectId }: FilesCardProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const shouldReduceMotion = useReducedMotion()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const { data: files, isLoading } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async (): Promise<ProjectFile[]> => {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data
    },
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['project-files', projectId] })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`"${file.name}" excede o limite de 10MB.`)
      }
      const ext = extensaoDe(file.name)
      if (!EXTENSOES_PERMITIDAS.includes(ext)) {
        throw new Error(
          `Tipo de arquivo não permitido (.${ext || '?'}). ` +
            'Envie imagem, PDF, documento, mídia ou arquivo compactado.'
        )
      }
      const storagePath = `${projectId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file)
      if (uploadErr) throw new Error(uploadErr.message)

      const { error: insertErr } = await supabase.from('project_files').insert({
        project_id: projectId,
        nome: file.name,
        storage_path: storagePath,
        tamanho: file.size,
        tipo_mime: file.type || null,
        uploaded_by: user?.id ?? null,
      })
      if (insertErr) throw new Error(insertErr.message)
    },
    onSuccess: async () => {
      setUploadError(null)
      await invalidate()
    },
    onError: (error: Error) => {
      setUploadError(error.message)
    },
  })

  const toggleVisibleMutation = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const { error } = await supabase
        .from('project_files')
        .update({ visivel_cliente: !file.visivel_cliente })
        .eq('id', file.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([file.storage_path])
      if (storageErr) throw new Error(storageErr.message)
      const { error: rowErr } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id)
      if (rowErr) throw new Error(rowErr.message)
    },
    onSuccess: async () => {
      setPendingDeleteId(null)
      await invalidate()
    },
  })

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    Array.from(fileList).forEach((file) => uploadMutation.mutate(file))
  }

  const handleDownload = async (file: ProjectFile) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(file.storage_path, SIGNED_URL_TTL_S)
    if (error || !data) return
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDeleteClick = (file: ProjectFile) => {
    if (pendingDeleteId === file.id) {
      deleteMutation.mutate(file)
    } else {
      setPendingDeleteId(file.id)
    }
  }

  const total = files?.length ?? 0

  return (
    <motion.section
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Arquivos do projeto"
      className="rounded-2xl border border-white/5 bg-surface-1 p-6"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <File className="h-4 w-4 text-accent" />
        Arquivos
        {total > 0 && (
          <span className="text-xs font-light text-muted">({total})</span>
        )}
      </h2>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        aria-label="Enviar arquivos: clique ou arraste aqui"
        className={`mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors duration-150 ${
          isDragging
            ? 'border-accent/60 bg-accent/5'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <UploadCloud
          className={`h-6 w-6 ${isDragging ? 'text-accent' : 'text-muted/60'}`}
        />
        <p className="text-xs font-light text-muted">
          Arraste arquivos aqui ou clique para selecionar (máx. 10MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {uploadError && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {uploadError}
        </p>
      )}

      {isLoading && (
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-surface-2" />
      )}

      {!isLoading && total === 0 && (
        <p className="mt-4 text-sm font-light text-muted">
          Nenhum arquivo enviado ainda.
        </p>
      )}

      {!isLoading && total > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {files!.map((file) => (
            <li
              key={file.id}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/[0.03]"
            >
              <File className="h-4 w-4 shrink-0 text-muted/60" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{file.nome}</p>
                <p className="text-xs font-light tabular-nums text-muted">
                  {formatFileSize(file.tamanho)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleVisibleMutation.mutate(file)}
                aria-pressed={file.visivel_cliente}
                title={
                  file.visivel_cliente
                    ? 'Visível ao cliente'
                    : 'Oculto do cliente'
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  file.visivel_cliente
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-muted'
                }`}
              >
                {file.visivel_cliente ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                Visível ao cliente
              </button>

              <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Baixar ${file.nome}`}
                  onClick={() => void handleDownload(file)}
                  className="rounded-lg p-2 text-muted/60 hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${file.nome}`}
                  onClick={() => handleDeleteClick(file)}
                  onBlur={() => setPendingDeleteId(null)}
                  className={`rounded-lg p-2 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 ${
                    pendingDeleteId === file.id
                      ? 'bg-red-500/20 text-red-300'
                      : 'text-muted/60 hover:bg-red-500/10 hover:text-red-400'
                  }`}
                  title={
                    pendingDeleteId === file.id
                      ? 'Clique novamente para confirmar'
                      : 'Excluir'
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  )
}
