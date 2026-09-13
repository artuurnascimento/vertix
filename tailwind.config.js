/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        kanit: ['Kanit', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--vx-bg, 12 12 12) / <alpha-value>)',
        ink: 'rgb(var(--vx-ink, 244 244 240) / <alpha-value>)',
        muted: 'rgb(var(--vx-muted, 138 138 130) / <alpha-value>)',
        accent: 'rgb(var(--vx-accent, 108 91 242) / <alpha-value>)',
        'accent-2': 'rgb(var(--vx-accent-2, 85 70 224) / <alpha-value>)',
        'surface-1': 'rgb(var(--vx-surface-1, 21 21 21) / <alpha-value>)',
        'surface-2': 'rgb(var(--vx-surface-2, 28 28 28) / <alpha-value>)',
      },
      maxWidth: {
        container: '1280px',
      },
      animation: {
        marquee: 'marquee var(--duration) linear infinite',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
      },
    },
  },
  plugins: [],
}
