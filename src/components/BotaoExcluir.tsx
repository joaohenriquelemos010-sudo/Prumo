import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Delete with an inline "are you sure?" step — no accidental data loss, and no
 * modal to trap focus. For people who aren't tech-savvy, a clear two-step
 * confirmation right where they clicked is calmer than a pop-up. The icon button
 * arms into two explicit choices; anything else cancels.
 */
export function BotaoExcluir({
  onConfirm,
  titulo = 'Remover',
  size = 'sm',
}: {
  onConfirm: () => void
  titulo?: string
  size?: 'sm' | 'md'
}) {
  const [armado, setArmado] = useState(false)
  const iconSize = size === 'md' ? 'size-4' : 'size-3.5'
  const box = size === 'md' ? 'size-9' : 'size-8'

  if (armado) {
    return (
      <span className="inline-flex items-center gap-1" role="group" aria-label="Confirmar remoção">
        <button
          type="button"
          onClick={() => {
            onConfirm()
            setArmado(false)
          }}
          className="inline-flex h-8 items-center rounded-pill bg-[var(--color-warn)] px-3 text-xs font-semibold text-white"
        >
          Sim, remover
        </button>
        <button
          type="button"
          onClick={() => setArmado(false)}
          className="inline-flex h-8 items-center rounded-pill px-3 text-xs font-semibold text-ink-soft hover:bg-paper-2"
        >
          Cancelar
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setArmado(true)}
      aria-label={titulo}
      className={cn('grid shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-paper-2 hover:text-warn', box)}
    >
      <Trash2 className={iconSize} aria-hidden />
    </button>
  )
}
