import type { JSX, SVGProps } from 'react'
import type { BriefingIlustracao } from '../../lib/briefing'
import {
  Entrega,
  Estoque,
  Loja,
  Orcamento,
  Pagamento,
  Prazo,
  Catalogo,
} from './illustrations/comercio'
import {
  EstiloMinimalista,
  EstiloPremium,
  EstiloVibrante,
  IdentidadeVisual,
} from './illustrations/estilo'
import {
  Automacao,
  Integracoes,
  Recorrencia,
  Relatorios,
  Seguranca,
  Suporte,
  Usuarios,
} from './illustrations/sistema'
import {
  Conteudo,
  Dominio,
  Mobile,
  RedesSociais,
  SitePaginas,
} from './illustrations/site'
import {
  Agendamento,
  Concorrentes,
  Metas,
  PublicoAlvo,
} from './illustrations/planejamento'

/**
 * Catálogo de ilustrações das perguntas visuais do briefing. Cobertura total
 * de BRIEFING_ILUSTRACOES é garantida pelo Record — adicionar chave nova no
 * schema exige adicionar o SVG num dos módulos de src/components/briefings/
 * illustrations/ e registrá-lo aqui (erro de compilação caso contrário).
 *
 * Este arquivo é apenas o ponto de montagem — os desenhos em si (e a
 * animação de cada um via framer-motion) vivem agrupados por tema em
 * ./illustrations/{comercio,estilo,sistema,site,planejamento,shared}.tsx.
 */

export type IllustrationComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

export const BRIEFING_ILLUSTRATIONS: Record<BriefingIlustracao, IllustrationComponent> = {
  loja: Loja,
  catalogo: Catalogo,
  pagamento: Pagamento,
  entrega: Entrega,
  identidade_visual: IdentidadeVisual,
  estilo_minimalista: EstiloMinimalista,
  estilo_vibrante: EstiloVibrante,
  estilo_premium: EstiloPremium,
  automacao: Automacao,
  usuarios: Usuarios,
  integracoes: Integracoes,
  site_paginas: SitePaginas,
  conteudo: Conteudo,
  agendamento: Agendamento,
  metas: Metas,
  publico_alvo: PublicoAlvo,
  concorrentes: Concorrentes,
  orcamento: Orcamento,
  prazo: Prazo,
  dominio: Dominio,
  redes_sociais: RedesSociais,
  estoque: Estoque,
  recorrencia: Recorrencia,
  relatorios: Relatorios,
  seguranca: Seguranca,
  mobile: Mobile,
  suporte: Suporte,
}
