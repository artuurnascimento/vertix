import type { CSSProperties } from 'react'

interface LogoMarkProps {
  className?: string
  style?: CSSProperties
}

/** Símbolo Vertix: vértice ascendente de duas lâminas (loja + sistema). */
export default function LogoMark({ className, style }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 132 162"
      className={className}
      // Caps arredondados do traço excedem o viewBox — sem isso as pontas clipam.
      style={{ overflow: 'visible', ...style }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 132 L66 14 L126 132"
        stroke="#6C5BF2"
        strokeWidth="26"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M34 150 L66 88 L98 150"
        stroke="#F4F4F0"
        strokeWidth="20"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}
