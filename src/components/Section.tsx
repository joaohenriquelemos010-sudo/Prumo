import type { ReactNode } from 'react'
import { useReveal } from '@/lib/hooks/useReveal'
import { cn } from '@/lib/cn'

interface SectionProps {
  children: ReactNode
  className?: string
  /** Constrain to the page shell. Off for full-bleed bands. */
  shell?: boolean
  id?: string
  reveal?: boolean
  as?: 'section' | 'div'
}

export function Section({
  children,
  className,
  shell = true,
  id,
  reveal = true,
  as: Tag = 'section',
}: SectionProps) {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <Tag id={id} className={cn('py-2xl sm:py-3xl', className)}>
      <div
        ref={reveal ? ref : undefined}
        data-shown={reveal ? shown : undefined}
        className={cn(shell && 'u-shell', reveal && 'u-reveal')}
      >
        {children}
      </div>
    </Tag>
  )
}

interface SectionHeadProps {
  eyebrow?: string
  titulo: ReactNode
  descricao?: ReactNode
  center?: boolean
}

/** Section head — eyebrow stacked ABOVE the heading (never left-margin label). */
export function SectionHead({ eyebrow, titulo, descricao, center }: SectionHeadProps) {
  return (
    <div className={cn('flex max-w-2xl flex-col gap-3', center && 'mx-auto items-center text-center')}>
      {eyebrow && <span className="u-eyebrow">{eyebrow}</span>}
      <h2 className="text-3xl sm:text-4xl">{titulo}</h2>
      {descricao && <p className="text-lg text-ink-soft">{descricao}</p>}
    </div>
  )
}
