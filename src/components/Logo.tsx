import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/stores/theme'

type LogoVariant = 'full' | 'symbol' | 'wordmark'

// The wordmark is drawn with fixed dark-navy fills, so on dark paper it drops to
// ~1.7:1. The asset can't be recoloured from CSS (it's an <img>), so every variant
// that carries lettering ships a dark twin. The symbol alone is already a bright
// lilás→azul ramp and needs none.
const SRC: Record<LogoVariant, { light: string; dark: string }> = {
  full: {
    light: '/img/logo_sem_fundo_com_nome_e_desenho.svg',
    dark: '/img/logo_sem_fundo_com_nome_e_desenho_dark.svg',
  },
  symbol: {
    light: '/img/logo_sem_fundo_so_com_desenho.svg',
    dark: '/img/logo_sem_fundo_so_com_desenho.svg',
  },
  wordmark: {
    light: '/img/logo_sem_fundo_so_com_nome.svg',
    dark: '/img/logo_sem_fundo_so_com_nome_dark.svg',
  },
}

interface LogoProps {
  variant?: LogoVariant
  className?: string
  /** Decorative when paired with visible wordmark text; labelled otherwise. */
  label?: string
}

export function Logo({ variant = 'full', className, label = 'Prumo' }: LogoProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <img
      src={SRC[variant][theme]}
      alt={label}
      // Width follows the SVG's aspect ratio; height comes from `className`.
      // No `h-auto` here — it would override the caller's height utility.
      style={{ width: 'auto' }}
      className={cn('block max-w-full select-none', className)}
      draggable={false}
      loading="eager"
      decoding="async"
    />
  )
}
