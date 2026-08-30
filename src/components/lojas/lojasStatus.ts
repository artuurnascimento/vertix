import type { VertixShop } from './appsProxy'

/**
 * Lógica pura do semáforo de saúde de um app numa loja. Regras:
 *   verde    — backend respondeu, loja onboarded e chaves próprias ok;
 *   amarelo  — instalado mas com pendência (sem onboarding, sem chave
 *              própria, SMS sem Twilio próprio);
 *   vermelho — backend não respondeu / erro na consulta;
 *   cinza    — só provisionado (backend não conhece a loja) ou backend
 *              do app ainda não configurado nos secrets.
 * Nunca armazenado — sempre derivado do estado vivo (health + shops).
 */

export type Semaforo = 'verde' | 'amarelo' | 'vermelho' | 'cinza'

/** Estado da consulta ao backend de um app (health + shops). */
export type AppBackendEstado = 'ok' | 'offline' | 'nao_configurado' | 'carregando'

export interface SemaforoResultado {
  cor: Semaforo
  /** Pendências/motivos legíveis — viram tooltip no badge. */
  motivos: string[]
}

export const SEMAFORO_META: Record<
  Semaforo,
  { label: string; dotClass: string }
> = {
  verde: { label: 'Saudável', dotClass: 'bg-emerald-400' },
  amarelo: { label: 'Pendência', dotClass: 'bg-amber-400' },
  vermelho: { label: 'Erro', dotClass: 'bg-red-400' },
  cinza: { label: 'Provisionado', dotClass: 'bg-white/30' },
}

/** Semáforo de um app instalado numa loja, dado o estado vivo do backend. */
export function semaforoDoApp(
  estado: AppBackendEstado,
  shop: VertixShop | undefined
): SemaforoResultado {
  if (estado === 'carregando') {
    return { cor: 'cinza', motivos: ['Consultando backend…'] }
  }
  if (estado === 'offline') {
    return { cor: 'vermelho', motivos: ['Backend não respondeu.'] }
  }
  if (estado === 'nao_configurado') {
    return {
      cor: 'cinza',
      motivos: ['Backend do app ainda não configurado nos secrets.'],
    }
  }
  if (!shop) {
    return {
      cor: 'cinza',
      motivos: ['Só provisionado — o app ainda não se registrou nesta loja.'],
    }
  }

  const motivos: string[] = []
  if (!shop.onboardedAt) motivos.push('Onboarding pendente.')
  if (!shop.hasOwnResendKey) motivos.push('Sem chave Resend própria.')
  if (shop.smsEnabled && !shop.hasOwnTwilioCreds) {
    motivos.push('SMS ativo sem credenciais Twilio próprias.')
  }
  if (!shop.enabled) motivos.push('App desativado nas configurações.')

  if (motivos.length > 0) return { cor: 'amarelo', motivos }
  return { cor: 'verde', motivos: ['Backend ok, onboarding e chaves em dia.'] }
}
