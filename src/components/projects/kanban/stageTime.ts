const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/**
 * Tempo que o card está na etapa atual, derivado de updated_at
 * (o trigger do banco reseta updated_at a cada mudança de status).
 * Ex.: "menos de 1h nesta etapa", "5h nesta etapa", "3 dias nesta etapa".
 */
export function formatTimeInStage(updatedAt: string, now = Date.now()): string {
  const elapsed = now - new Date(updatedAt).getTime()
  if (elapsed < HOUR_MS) return 'menos de 1h nesta etapa'
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    return `${hours}h nesta etapa`
  }
  const days = Math.floor(elapsed / DAY_MS)
  return days === 1 ? '1 dia nesta etapa' : `${days} dias nesta etapa`
}
