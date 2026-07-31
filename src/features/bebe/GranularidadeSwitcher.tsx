import { motion, useReducedMotion } from 'framer-motion'
import { molas } from '@/lib/motion'
import { GRANULARIDADES } from '@/features/bebe/agregacao'
import type { Granularidade } from '@/features/bebe/agregacao'
import { cn } from '@/lib/cn'

/**
 * Semana · Mês · Trimestre — a escolha de quem cuida, não do produto.
 *
 * A pílula selecionada é **um** elemento que se move entre as posições, via
 * `layoutId`, e não três fundos aparecendo e sumindo. A diferença é a que
 * importa: o olho segue o objeto, entende que é o mesmo, e a troca deixa de ser
 * um corte para virar um movimento. Mola firme, sem overshoot — não houve gesto
 * com momento aqui, houve um toque.
 */
export function GranularidadeSwitcher({
  valor,
  onChange,
  /** Rótulo da unidade do programa ("semana" na gestação, "mês" depois). */
  descricao,
  /** Granularidades que não fazem sentido nesta fase. */
  desabilitadas = [],
}: {
  valor: Granularidade
  onChange: (g: Granularidade) => void
  descricao?: string
  desabilitadas?: Granularidade[]
}) {
  const reduzido = useReducedMotion()
  const opcoes = GRANULARIDADES.filter((g) => !desabilitadas.includes(g.id))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="radiogroup"
        aria-label="Como agrupar a evolução"
        className="flex gap-1 rounded-pill border border-line bg-paper p-1 shadow-soft"
      >
        {opcoes.map((g) => {
          const ativa = g.id === valor
          return (
            <motion.button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={ativa}
              onClick={() => onChange(g.id)}
              whileTap={{ scale: 0.96 }}
              transition={molas.rapida}
              className={cn(
                'relative min-h-9 rounded-pill px-4 font-display text-sm font-semibold',
                'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
                ativa ? 'text-white' : 'text-indigo hover:bg-paper-2',
              )}
            >
              {ativa && (
                <motion.span
                  layoutId="granularidade-pilula"
                  transition={reduzido ? { duration: 0 } : molas.firme}
                  className="absolute inset-0 rounded-pill [background-image:var(--grad-brand)]"
                />
              )}
              <span className="relative">{g.rotulo}</span>
            </motion.button>
          )
        })}
      </div>

      {descricao ? <p className="text-sm text-ink-soft">{descricao}</p> : null}
    </div>
  )
}
