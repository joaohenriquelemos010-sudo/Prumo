import { ShieldCheck, Info } from 'lucide-react'
import { usePerfil } from '@/lib/stores/perfil'
import { coberturaDe, AVISO_COBERTURA } from './cobertura'
import type { ItemCoberto } from './cobertura'
import { cn } from '@/lib/cn'

/**
 * A small "who pays for this?" hint next to a scheduled item. Reads the journey's
 * plan from the profile store, so the answer follows whatever the family told us
 * once, rather than asking again on every screen.
 *
 * Deliberately quiet: it's guidance, and the tooltip carries the caveat.
 */
export function ChipCobertura({ item, className }: { item: ItemCoberto; className?: string }) {
  const convenio = usePerfil((s) => s.perfil?.convenio ?? null)
  const cobertura = coberturaDe(item, convenio)
  const Icon = cobertura.nivel === 'coberto' ? ShieldCheck : Info

  return (
    <span
      title={`${cobertura.detalhe} ${AVISO_COBERTURA}`}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-pill px-2 py-0.5 text-[0.7rem] font-semibold',
        cobertura.nivel === 'coberto' ? 'u-chip-success' : 'bg-paper-2 text-ink-soft',
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {cobertura.rotulo}
    </span>
  )
}
