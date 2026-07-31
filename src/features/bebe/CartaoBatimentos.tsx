import { motion, useReducedMotion } from 'framer-motion'
import { molas } from '@/lib/motion'
import { HeartPulse } from 'lucide-react'
import { BPM_NORMAL } from '@/features/bebe/tipos'
import type { PontoBatimento } from '@/features/bebe/tipos'
import { cn } from '@/lib/cn'

/**
 * O coração do bebê.
 *
 * `bcfBpm` já era coletado em toda consulta e terminava numa célula de tabela,
 * ao lado da altura uterina. É o número que a gestante mais quer rever depois da
 * consulta — o que faltava não era o dado, era dar a ele o lugar que ele tem na
 * cabeça dela.
 *
 * O coração pulsa em `60/bpm` segundos: no ritmo **real** do bebê daquela
 * consulta. Não é enfeite. É a única coisa nesta tela que a pessoa consegue
 * sentir em vez de ler, e é por isso que a animação usa `duration` literal em
 * vez de mola — aqui o valor exato do tempo é o conteúdo.
 */
export function CartaoBatimentos({ batimentos }: { batimentos: PontoBatimento[] }) {
  const reduzido = useReducedMotion()
  if (batimentos.length === 0) return null

  const ultimo = batimentos[batimentos.length - 1]
  const segundosPorBatida = 60 / ultimo.bpm
  const dentroDaFaixa = ultimo.bpm >= BPM_NORMAL.min && ultimo.bpm <= BPM_NORMAL.max

  // Onde o valor cai na faixa, para posicionar o marcador. Estourar a faixa
  // gruda nas pontas em vez de sair do trilho.
  const posicao = Math.min(
    100,
    Math.max(0, ((ultimo.bpm - BPM_NORMAL.min) / (BPM_NORMAL.max - BPM_NORMAL.min)) * 100),
  )

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <HeartPulse className="size-5 text-indigo" aria-hidden />O coração do bebê
      </h2>

      <div className="mt-md flex items-center gap-lg">
        <motion.span
          aria-hidden
          className="grid size-20 shrink-0 place-items-center rounded-full [background-image:var(--grad-brand-soft)] text-indigo"
          animate={reduzido ? undefined : { scale: [1, 1.12, 1, 1.06, 1] }}
          transition={
            reduzido
              ? undefined
              : {
                  // Duas contrações por batida — sístole e a segunda bulha —,
                  // que é o que faz parecer um coração e não um pulsar genérico.
                  duration: segundosPorBatida,
                  repeat: Infinity,
                  ease: 'easeOut',
                  times: [0, 0.16, 0.36, 0.5, 1],
                }
          }
        >
          <HeartPulse className="size-10" />
        </motion.span>

        <div className="min-w-0">
          <p className="font-display text-4xl font-bold leading-none text-ink">
            {ultimo.bpm}
            <span className="ml-1 font-display text-lg font-semibold text-ink-soft">bpm</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            medido na semana {ultimo.semana}
            {ultimo.autorNome ? ` por ${ultimo.autorNome}` : ''}
          </p>
        </div>
      </div>

      {/* A faixa de normalidade, do lado do número. Sem ela, "142" é um dado
          que a pessoa vai pesquisar às duas da manhã. */}
      <div className="mt-md">
        <div className="relative h-2 rounded-pill bg-paper-3">
          <div className="absolute inset-y-0 left-0 right-0 rounded-pill [background-image:var(--grad-brand-soft)]" />
          <motion.span
            aria-hidden
            className={cn(
              'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-soft',
              dentroDaFaixa ? '[background-image:var(--grad-brand)]' : 'bg-warn',
            )}
            initial={false}
            animate={{ left: `${posicao}%` }}
            transition={reduzido ? { duration: 0 } : molas.suave}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ink-mute">
          <span>{BPM_NORMAL.min}</span>
          <span className="font-semibold text-ink-soft">
            {dentroDaFaixa
              ? 'dentro do que se espera'
              : 'fora da faixa comum — vale conversar na consulta'}
          </span>
          <span>{BPM_NORMAL.max}</span>
        </div>
      </div>

      {batimentos.length > 1 && (
        <p className="mt-md rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
          Já foram {batimentos.length} medidas, entre {Math.min(...batimentos.map((b) => b.bpm))} e{' '}
          {Math.max(...batimentos.map((b) => b.bpm))} bpm. O coração do bebê bate mais rápido que o seu —
          é assim mesmo, e ele vai desacelerando conforme a gravidez avança.
        </p>
      )}
    </section>
  )
}
