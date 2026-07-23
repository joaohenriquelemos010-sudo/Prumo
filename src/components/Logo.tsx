import { cn } from '@/lib/cn'

type LogoVariant = 'full' | 'symbol' | 'wordmark'

const SRC: Record<LogoVariant, string> = {
  full: '/img/logo_sem_fundo_com_nome_e_desenho.svg',
  symbol: '/img/logo_sem_fundo_so_com_desenho.svg',
  wordmark: '/img/logo_sem_fundo_so_com_nome.svg',
}

interface LogoProps {
  variant?: LogoVariant
  className?: string
  /** Decorative when paired with visible wordmark text; labelled otherwise. */
  label?: string
}

export function Logo({ variant = 'full', className, label = 'Prumo' }: LogoProps) {
  return (
    <img
      src={SRC[variant]}
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
