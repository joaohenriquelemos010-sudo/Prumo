import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

interface BottomSheetProps {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: ReactNode
}

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A thumb-reachable sheet that rises from the bottom edge — the app's first real
 * dialog. Everything else here expands in place, which is the right default; this
 * exists for the cases where a panel genuinely has to sit above the page, like the
 * mobile nav overflow.
 *
 * Does the three things an overlay owes you: traps focus, locks the page behind it,
 * and closes on Escape or a tap outside — returning focus where it came from.
 */
export function BottomSheet({ aberto, onFechar, titulo, children }: BottomSheetProps) {
  const painelRef = useRef<HTMLDivElement>(null)
  const origemFoco = useRef<HTMLElement | null>(null)
  const reduzirMovimento = useReducedMotion()

  useEffect(() => {
    if (!aberto) return

    origemFoco.current = document.activeElement as HTMLElement | null
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the sheet so the next Tab stays inside it.
    const primeiro = painelRef.current?.querySelector<HTMLElement>(FOCAVEIS)
    ;(primeiro ?? painelRef.current)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFechar()
        return
      }
      if (e.key !== 'Tab') return
      const alvos = painelRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS)
      if (!alvos || alvos.length === 0) return
      const primeiroAlvo = alvos[0]
      const ultimoAlvo = alvos[alvos.length - 1]
      if (e.shiftKey && document.activeElement === primeiroAlvo) {
        e.preventDefault()
        ultimoAlvo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimoAlvo) {
        e.preventDefault()
        primeiroAlvo.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowAnterior
      origemFoco.current?.focus()
    }
  }, [aberto, onFechar])

  return (
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          <motion.button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--color-ink)_45%,transparent)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduzirMovimento ? 0 : 0.18 }}
          />
          <motion.div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            tabIndex={-1}
            className="relative max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-paper px-md pt-md shadow-lift [padding-bottom:calc(var(--space-md)+env(safe-area-inset-bottom))]"
            initial={{ y: reduzirMovimento ? 0 : '100%', opacity: reduzirMovimento ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduzirMovimento ? 0 : '100%', opacity: reduzirMovimento ? 0 : 1 }}
            transition={{ duration: reduzirMovimento ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Grab handle — reads as "this pulls down" without any text. */}
            <span aria-hidden className="mx-auto mb-md block h-1 w-10 rounded-pill bg-paper-3" />

            <div className="mb-sm flex items-center justify-between gap-md">
              <h2 className="font-display text-lg font-semibold text-ink">{titulo}</h2>
              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar"
                className="grid size-11 shrink-0 place-items-center rounded-pill text-ink-soft hover:bg-paper-2"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
