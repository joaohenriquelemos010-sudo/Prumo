import { motion, useReducedMotion } from 'framer-motion'
import { molas } from '@/lib/motion'
import { cn } from '@/lib/cn'

export interface Aba {
  id: string
  rotulo: string
  /** Aparece como bolinha no canto — o que está esperando o médico. */
  contador?: number
}

/**
 * As abas de dentro do hub da paciente.
 *
 * A pílula é um `layoutId` compartilhado, então trocar de aba desliza o fundo em
 * vez de piscar em outro lugar — o olho segue o movimento e sabe de onde veio.
 * Com `prefers-reduced-motion` a mola vira zero, e a pílula simplesmente aparece
 * na aba certa: nada de meia animação.
 *
 * Rola horizontalmente no celular em vez de quebrar em duas linhas. Uma linha de
 * abas que vira duas muda de altura ao trocar de aba, e o conteúdo abaixo pula.
 */
export function AbasPaciente({
  abas,
  ativa,
  onTrocar,
}: {
  abas: Aba[]
  ativa: string
  onTrocar: (id: string) => void
}) {
  const reduzido = useReducedMotion()

  return (
    <div
      role="tablist"
      aria-label="Áreas da paciente"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {abas.map((a) => {
        const eAtiva = a.id === ativa
        return (
          <motion.button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={eAtiva}
            onClick={() => onTrocar(a.id)}
            whileTap={{ scale: 0.97 }}
            transition={molas.rapida}
            className={cn(
              'relative min-h-10 shrink-0 rounded-pill px-4 font-display text-sm font-semibold',
              'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
              eAtiva ? 'text-white' : 'text-indigo hover:bg-paper-2',
            )}
          >
            {eAtiva && (
              <motion.span
                layoutId="aba-paciente-pilula"
                transition={reduzido ? { duration: 0 } : molas.firme}
                className="absolute inset-0 rounded-pill [background-image:var(--grad-brand)]"
              />
            )}
            <span className="relative">{a.rotulo}</span>
            {a.contador ? (
              <span
                className={cn(
                  'relative ml-1.5 inline-flex min-w-5 items-center justify-center rounded-pill px-1.5 text-xs font-bold',
                  eAtiva ? 'bg-white/25 text-white' : 'bg-indigo text-white',
                )}
              >
                {a.contador}
              </span>
            ) : null}
          </motion.button>
        )
      })}
    </div>
  )
}
