import { motion } from 'framer-motion'
import { useMovimento } from '@/lib/motion'

/**
 * O anel de progresso de um grupo.
 *
 * O traço é animado por **mola**, não por transição CSS: marcar dois passos
 * rápido faz a segunda animação partir de onde a primeira estava, em vez de
 * saltar para o novo valor. É a mesma regra que vale para todo o resto do
 * produto — animar do valor apresentado, nunca do alvo.
 */
export function ProgressoAnel({
  feitos,
  total,
  tamanho = 44,
  espessura = 4,
}: {
  feitos: number
  total: number
  tamanho?: number
  espessura?: number
}) {
  const { ativo, mola } = useMovimento()

  const raio = (tamanho - espessura) / 2
  const circunferencia = 2 * Math.PI * raio
  const fracao = total === 0 ? 0 : Math.min(1, feitos / total)
  const completo = total > 0 && feitos >= total

  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: tamanho, height: tamanho }}
      role="img"
      aria-label={`${feitos} de ${total} passos`}
    >
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke="var(--color-paper-3)"
          strokeWidth={espessura}
        />
        <motion.circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={completo ? 'var(--color-success)' : 'var(--color-lilas)'}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          initial={false}
          animate={{ strokeDashoffset: circunferencia * (1 - fracao) }}
          transition={ativo ? mola('suave') : { duration: 0 }}
        />
      </svg>

      <span className="absolute font-display text-xs font-semibold tabular-nums text-ink-soft">
        {completo ? '✓' : `${feitos}/${total}`}
      </span>
    </span>
  )
}
