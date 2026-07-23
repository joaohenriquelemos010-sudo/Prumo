import type { ReactNode } from 'react'
import { Blob } from './Blob'

interface EmptyStateProps {
  titulo: string
  descricao: string
  action?: ReactNode
  icon?: ReactNode
}

/** Empty states that welcome, never "nenhum dado encontrado". */
export function EmptyState({ titulo, descricao, action, icon }: EmptyStateProps) {
  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center gap-md rounded-2xl bg-paper-2 px-lg py-2xl text-center">
      <Blob variant="b" intensity={0.35} className="left-1/2 top-0 size-64 -translate-x-1/2 opacity-70" />
      {icon && (
        <div className="grid size-16 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo">
          {icon}
        </div>
      )}
      <h3 className="text-xl">{titulo}</h3>
      <p className="text-ink-soft">{descricao}</p>
      {action && <div className="mt-xs">{action}</div>}
    </div>
  )
}
