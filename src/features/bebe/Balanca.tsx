import { motion, useReducedMotion } from 'framer-motion'
import { progressoGestacional } from './comparacoes-semanais'

/**
 * The little scale.
 *
 * A cradle that tips with the baby's weight and a baby that grows week by week —
 * the visual the investor asked for, and the reason to come back on a Tuesday when
 * nothing else has changed. It reads the same measurement the clinical chart does;
 * it just says it in a way you can feel.
 *
 * Pure SVG on brand tokens, so it flips with the theme and adds no dependency.
 * Under `prefers-reduced-motion` everything settles into place without animating.
 */
export function Balanca({
  semana,
  pesoG,
  vazio,
}: {
  semana: number
  pesoG: number | null
  /** Voice-aware empty message — the family and the clinician read different sentences. */
  vazio?: string
}) {
  const reduzir = useReducedMotion()
  const progresso = progressoGestacional(semana)

  // The pan tips with weight, capped so it stays a gesture rather than a slide.
  const inclinacao = pesoG ? Math.min(9, (pesoG / 3600) * 9) : 0
  // The baby grows from a third of its final size to full across the pregnancy.
  const escalaBebe = 0.34 + progresso * 0.66

  const transicao = reduzir
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 60, damping: 14, mass: 1.1 }

  return (
    <div className="grid place-items-center py-md">
      <svg
        viewBox="0 0 240 200"
        className="h-auto w-full max-w-[280px]"
        role="img"
        aria-label={
          pesoG
            ? `Ilustração: bebê de aproximadamente ${Math.round(pesoG)} gramas na semana ${semana}.`
            : `Ilustração do bebê na semana ${semana}.`
        }
      >
        <defs>
          <linearGradient id="balanca-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-lilas)" />
            <stop offset="100%" stopColor="var(--color-azul)" />
          </linearGradient>
        </defs>

        {/* Base */}
        <ellipse cx="120" cy="186" rx="52" ry="7" fill="var(--color-paper-3)" />
        <rect x="114" y="128" width="12" height="54" rx="6" fill="var(--color-paper-3)" />

        {/* Pan + baby tip together */}
        <motion.g
          style={{ originX: '120px', originY: '128px' }}
          animate={{ rotate: inclinacao }}
          transition={transicao}
        >
          {/* Cradle */}
          <path
            d="M56 118 Q120 156 184 118 L184 124 Q120 164 56 124 Z"
            fill="url(#balanca-grad)"
            opacity={0.9}
          />
          <rect x="52" y="112" width="136" height="9" rx="4.5" fill="url(#balanca-grad)" />

          {/* Baby, growing with the weeks */}
          <motion.g
            style={{ originX: '120px', originY: '110px' }}
            animate={{ scale: escalaBebe }}
            transition={transicao}
          >
            {/* body */}
            <ellipse cx="120" cy="86" rx="30" ry="26" fill="var(--color-lilas-soft)" />
            {/* head */}
            <circle cx="120" cy="50" r="24" fill="var(--color-lilas-soft)" />
            {/* cheeks */}
            <circle cx="108" cy="55" r="4" fill="var(--color-lilas)" opacity={0.45} />
            <circle cx="132" cy="55" r="4" fill="var(--color-lilas)" opacity={0.45} />
            {/* eyes — closed, sleeping */}
            <path
              d="M110 47 q4 4 8 0"
              stroke="var(--color-indigo)"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M122 47 q4 4 8 0"
              stroke="var(--color-indigo)"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            {/* smile */}
            <path
              d="M114 60 q6 5 12 0"
              stroke="var(--color-indigo)"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            {/* curl */}
            <path
              d="M120 26 q6 -8 12 -2"
              stroke="var(--color-indigo)"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              opacity={0.6}
            />
            {/* arms tucked in */}
            <path
              d="M94 82 q-10 6 -6 16"
              stroke="var(--color-lilas-soft)"
              strokeWidth={9}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M146 82 q10 6 6 16"
              stroke="var(--color-lilas-soft)"
              strokeWidth={9}
              fill="none"
              strokeLinecap="round"
            />
          </motion.g>
        </motion.g>
      </svg>

      {pesoG ? (
        <p className="text-center">
          <span className="u-gradient-text font-display text-4xl font-extrabold">
            {pesoG >= 1000 ? `${(pesoG / 1000).toFixed(2).replace('.', ',')} kg` : `${Math.round(pesoG)} g`}
          </span>
          <span className="mt-1 block text-sm text-ink-mute">peso estimado na semana {semana}</span>
        </p>
      ) : (
        <p className="max-w-prose text-center text-sm text-ink-soft">
          {vazio ?? 'Assim que sua obstetra registrar as medidas do ultrassom, o peso aparece aqui.'}
        </p>
      )}
    </div>
  )
}
