import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-display font-semibold ' +
  'transition-[transform,background,box-shadow,color] duration-[var(--dur-fast)] ease-out ' +
  'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px'

const variants: Record<Variant, string> = {
  primary:
    'text-white shadow-soft [background-image:var(--grad-brand)] hover:shadow-lift hover:brightness-[1.04]',
  secondary:
    'bg-paper text-indigo border border-line shadow-soft hover:bg-paper-2 hover:border-[var(--color-lilas-soft)]',
  ghost: 'bg-transparent text-indigo hover:bg-paper-2',
}

const sizes: Record<Size, string> = {
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-8 text-[1.05rem]',
}

/**
 * The single primary action per screen. Ships all eight interaction states:
 * default · hover · focus-visible · active · disabled · loading (spinner +
 * aria-busy) · error / success handled by the caller through content.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="size-[1.15em] animate-spin" aria-hidden />}
      {!loading && iconLeft}
      <span>{children}</span>
      {!loading && iconRight}
    </button>
  )
})
