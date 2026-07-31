import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CalendarX2 } from 'lucide-react'
import { useMovimento } from '@/lib/motion'
import { Calendario } from './Calendario'
import { horaCurta, rotuloDoDia } from './agenda'
import type { DiaComSlots } from './agenda'
import { cn } from '@/lib/cn'

interface SeletorHorarioProps {
  dias: DiaComSlots[]
  diaSelecionado: string | null
  onSelecionarDia: (dia: string) => void
  slotSelecionado: string | null
  onSelecionarSlot: (inicio: string) => void
  carregando?: boolean
}

/**
 * "When?" — a month to pick the day, then the free times for that day.
 *
 * Only days with real openings are selectable, so nobody taps into an empty
 * screen; the calendar itself communicates the doctor's rhythm.
 */
export function SeletorHorario({
  dias,
  diaSelecionado,
  onSelecionarDia,
  slotSelecionado,
  onSelecionarSlot,
  carregando,
}: SeletorHorarioProps) {
  const disponiveis = useMemo(() => new Set(dias.map((d) => d.dia)), [dias])
  const doDia = dias.find((d) => d.dia === diaSelecionado)
  const { ativo: movimento, mola } = useMovimento()

  if (!carregando && dias.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-lg text-center shadow-soft">
        <span className="mx-auto grid size-12 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
          <CalendarX2 className="size-6" aria-hidden />
        </span>
        <p className="mt-3 font-display font-semibold text-ink">Sem horários abertos por enquanto</p>
        <p className="mt-1 text-sm text-ink-soft">
          Este profissional ainda não abriu vagas para as próximas semanas. Tente outro, ou volte em
          alguns dias.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-md">
      <Calendario
        valor={diaSelecionado}
        onSelecionar={onSelecionarDia}
        diasDisponiveis={disponiveis}
        legenda="Só aparecem os dias com horário livre."
      />

      {diaSelecionado && (
        <div>
          <p className="mb-2 font-display text-sm font-semibold text-indigo">
            Horários de {rotuloDoDia(diaSelecionado)}
          </p>
          {doDia && doDia.slots.length > 0 ? (
            <div role="radiogroup" aria-label="Horários disponíveis" className="flex flex-wrap gap-2">
              {doDia.slots.map((s, i) => {
                const ativo = s.inicio === slotSelecionado
                return (
                  <motion.button
                    key={s.inicio}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => onSelecionarSlot(s.inicio)}
                    /**
                     * Escalonada, e com teto no atraso.
                     *
                     * A entrada em cascata diz "esta é uma lista, e ela acabou
                     * de chegar" — mas um dia com trinta horários faria o
                     * trigésimo esperar meio segundo por nada. O teto em 10
                     * mantém a leitura da cascata e o resto entra junto.
                     */
                    initial={movimento ? { opacity: 0, y: 6, scale: 0.96 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...mola('firme'), delay: movimento ? Math.min(i, 10) * 0.022 : 0 }}
                    whileTap={movimento ? { scale: 0.95 } : undefined}
                    className={cn(
                      'min-h-11 rounded-pill border px-4 text-sm font-semibold transition-colors duration-[var(--dur-fast)]',
                      ativo
                        ? 'border-transparent [background-image:var(--grad-brand)] text-white shadow-soft'
                        : 'border-line bg-paper text-ink-soft hover:border-[var(--color-lilas-soft)] hover:text-indigo',
                    )}
                  >
                    {horaCurta(s.inicio)}
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-mute">Nenhum horário livre nesse dia.</p>
          )}
        </div>
      )}
    </div>
  )
}
