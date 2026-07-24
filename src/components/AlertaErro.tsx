import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface AlertaErroProps {
  /** User-safe message. Always rendered. */
  children: ReactNode
  /**
   * The way out. An error that has an obvious next step should always offer it
   * here — otherwise the person reads what went wrong and has nowhere to go.
   */
  acao?: ReactNode
  className?: string
}

/**
 * An error that never strands anyone: the message says what happened, `acao`
 * says where to go next.
 */
export function AlertaErro({ children, acao, className }: AlertaErroProps) {
  return (
    <div
      role="alert"
      className={cn(
        'mt-3 rounded-xl border p-3',
        'border-[color-mix(in_oklch,var(--color-warn)_35%,transparent)]',
        'bg-[color-mix(in_oklch,var(--color-warn)_8%,transparent)]',
        className,
      )}
    >
      <p className="text-sm font-semibold text-warn">{children}</p>
      {acao && <div className="mt-2 flex flex-wrap items-center gap-2">{acao}</div>}
    </div>
  )
}
