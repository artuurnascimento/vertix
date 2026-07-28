import type { CSSProperties, ComponentType } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  SiShopify,
  SiMeta,
  SiGoogleads,
  SiFigma,
  SiGithub,
  SiVercel,
  SiSupabase,
  SiStripe,
  SiCloudflare,
  SiJavascript,
  SiTypescript,
} from 'react-icons/si'
import { VscVscode } from 'react-icons/vsc'
import {
  PhotoshopIcon,
  IllustratorIcon,
  OpenAiIcon,
} from '../ui/brand-icons'

type IconType = ComponentType<{ className?: string; style?: CSSProperties }>

interface TechNode {
  label: string
  Icon: IconType
  x: number // % horizontal
  y: number // % vertical
  scale: number // 0.9–1.1 (variação 10–20%)
  opacity: number // 0.35–0.7
}

/** Distribuição orgânica, distâncias variadas do centro, bastante respiro. */
const NODES: TechNode[] = [
  { label: 'Shopify Partners', Icon: SiShopify, x: 48, y: 13, scale: 1.0, opacity: 0.62 },
  { label: 'Adobe Illustrator', Icon: IllustratorIcon, x: 28, y: 23, scale: 0.95, opacity: 0.5 },
  { label: 'Adobe Photoshop', Icon: PhotoshopIcon, x: 70, y: 23, scale: 0.95, opacity: 0.5 },
  { label: 'Shopify', Icon: SiShopify, x: 49, y: 28, scale: 0.92, opacity: 0.55 },
  { label: 'VS Code', Icon: VscVscode, x: 16, y: 39, scale: 1.0, opacity: 0.6 },
  { label: 'Meta Ads', Icon: SiMeta, x: 85, y: 39, scale: 1.0, opacity: 0.6 },
  { label: 'Google Ads', Icon: SiGoogleads, x: 21, y: 56, scale: 0.95, opacity: 0.5 },
  { label: 'Figma', Icon: SiFigma, x: 78, y: 56, scale: 0.95, opacity: 0.55 },
  { label: 'OpenAI', Icon: OpenAiIcon, x: 49, y: 64, scale: 1.05, opacity: 0.66 },
  { label: 'GitHub', Icon: SiGithub, x: 30, y: 68, scale: 0.9, opacity: 0.5 },
  { label: 'Vercel', Icon: SiVercel, x: 65, y: 68, scale: 0.95, opacity: 0.55 },
  { label: 'Supabase', Icon: SiSupabase, x: 40, y: 78, scale: 0.92, opacity: 0.55 },
  { label: 'Stripe', Icon: SiStripe, x: 59, y: 78, scale: 0.95, opacity: 0.6 },
  { label: 'JavaScript', Icon: SiJavascript, x: 20, y: 83, scale: 0.9, opacity: 0.45 },
  { label: 'TypeScript', Icon: SiTypescript, x: 79, y: 83, scale: 0.9, opacity: 0.5 },
  { label: 'Cloudflare', Icon: SiCloudflare, x: 48, y: 90, scale: 1.0, opacity: 0.55 },
]

const ICON_GLOW = 'drop-shadow(0 0 6px rgba(255,255,255,0.28))'

/** Deriva um float lento e variado por índice (5–10s, direções alternadas). */
function floatFor(i: number) {
  const dir = i % 2 === 0 ? 1 : -1
  const dx = dir * (4 + (i % 3) * 2)
  const dy = (i % 3 === 0 ? 1 : -1) * (5 + (i % 2) * 3)
  const duration = 6 + (i % 5)
  const delay = (i % 4) * 0.5
  return { dx, dy, duration, delay }
}

/** Constelação de logos de tecnologia ao redor do logo central. */
export default function TechConstellation() {
  const reduce = useReducedMotion()

  return (
    <div className="absolute inset-0">
      {NODES.map((node, i) => {
        const { dx, dy, duration, delay } = floatFor(i)
        const { Icon } = node
        return (
          <div
            key={node.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <motion.div
              className="flex items-center gap-2"
              style={{ opacity: node.opacity, scale: node.scale }}
              animate={
                reduce ? undefined : { x: [0, dx, 0], y: [0, dy, 0] }
              }
              transition={
                reduce
                  ? undefined
                  : {
                      duration,
                      delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
              }
            >
              <Icon
                className="h-[17px] w-[17px] shrink-0 text-white"
                style={{ filter: ICON_GLOW }}
              />
              <span className="whitespace-nowrap text-[11px] font-light leading-tight text-white/70">
                {node.label}
              </span>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
