import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MESES, paraChaveDia, deChaveDia } from './agenda'
import { cn } from '@/lib/cn'

interface CalendarioProps {
  /** 'YYYY-MM-DD' currently selected. */
  valor: string | null
  onSelecionar: (dia: string) => void
  /** Days that can be picked. When omitted, every future day is selectable. */
  diasDisponiveis?: Set<string>
  /** Days to dot-mark (an appointment already sits there). */
  diasMarcados?: Set<string>
  /** Nothing before this day. Defaults to today. */
  minimo?: string
  legenda?: string
}

const CABECALHO = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * Month grid. Hand-rolled because the project carries no date-picker dependency
 * and none of the popular ones would inherit the token system anyway.
 *
 * Follows the ARIA grid pattern: one tab stop into the month, then arrows move
 * day by day (and across month boundaries), so it is usable without a mouse.
 */
export function Calendario({
  valor,
  onSelecionar,
  diasDisponiveis,
  diasMarcados,
  minimo,
  legenda,
}: CalendarioProps) {
  const hoje = paraChaveDia(new Date())
  const piso = minimo ?? hoje
  const [mesVisivel, setMesVisivel] = useState(() => {
    const base = valor ? deChaveDia(valor) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const gradeRef = useRef<HTMLDivElement>(null)

  const semanas = useMemo(() => montarSemanas(mesVisivel), [mesVisivel])

  function selecionavel(dia: string): boolean {
    if (dia < piso) return false
    if (diasDisponiveis) return diasDisponiveis.has(dia)
    return true
  }

  /** Arrow keys walk the calendar; the month follows when you cross its edge. */
  function onKeyDown(e: React.KeyboardEvent, dia: string) {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -30,
      PageDown: 30,
    }
    const passo = passos[e.key]
    if (passo === undefined) return
    e.preventDefault()

    const alvo = deChaveDia(dia)
    alvo.setDate(alvo.getDate() + passo)
    const chaveAlvo = paraChaveDia(alvo)

    if (alvo.getMonth() !== mesVisivel.getMonth() || alvo.getFullYear() !== mesVisivel.getFullYear()) {
      setMesVisivel(new Date(alvo.getFullYear(), alvo.getMonth(), 1))
    }
    // The grid re-renders first; focus the new cell once it exists.
    requestAnimationFrame(() => {
      gradeRef.current?.querySelector<HTMLElement>(`[data-dia="${chaveAlvo}"]`)?.focus()
    })
  }

  const rotuloMes = `${MESES[mesVisivel.getMonth()]} de ${mesVisivel.getFullYear()}`
  // Where the single tab stop lands: the selection, else the first pickable day.
  const focavel =
    valor && mesmoMes(valor, mesVisivel)
      ? valor
      : semanas.flat().find((d) => d && selecionavel(d)) ?? null

  return (
    <div className="rounded-2xl border border-line bg-paper p-md shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMesVisivel((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="Mês anterior"
          className="grid size-11 place-items-center rounded-pill text-ink-soft hover:bg-paper-2 hover:text-indigo"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p aria-live="polite" className="font-display font-semibold first-letter:uppercase text-ink">
          {rotuloMes}
        </p>
        <button
          type="button"
          onClick={() => setMesVisivel((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Próximo mês"
          className="grid size-11 place-items-center rounded-pill text-ink-soft hover:bg-paper-2 hover:text-indigo"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div role="grid" aria-label={`Dias de ${rotuloMes}`} ref={gradeRef} className="mt-sm">
        <div role="row" className="grid grid-cols-7">
          {CABECALHO.map((d, i) => (
            <span
              key={i}
              role="columnheader"
              aria-label={['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][i]}
              className="grid h-8 place-items-center text-xs font-semibold text-ink-mute"
            >
              {d}
            </span>
          ))}
        </div>

        {semanas.map((semana, i) => (
          <div role="row" key={i} className="grid grid-cols-7">
            {semana.map((dia, j) => {
              if (!dia) return <span key={j} role="gridcell" aria-hidden />
              const pode = selecionavel(dia)
              const ativo = dia === valor
              const marcado = diasMarcados?.has(dia)
              return (
                <span role="gridcell" key={j} className="grid place-items-center py-0.5">
                  <button
                    type="button"
                    data-dia={dia}
                    disabled={!pode}
                    tabIndex={dia === focavel ? 0 : -1}
                    aria-selected={ativo}
                    aria-current={dia === hoje ? 'date' : undefined}
                    onKeyDown={(e) => onKeyDown(e, dia)}
                    onClick={() => pode && onSelecionar(dia)}
                    className={cn(
                      'relative grid size-11 place-items-center rounded-xl text-sm font-semibold transition-colors duration-[var(--dur-fast)]',
                      !pode && 'cursor-not-allowed text-ink-mute opacity-40',
                      pode && !ativo && 'text-ink hover:bg-paper-2 hover:text-indigo',
                      ativo && '[background-image:var(--grad-brand)] text-white shadow-soft',
                      dia === hoje && !ativo && 'ring-1 ring-[var(--color-lilas)]',
                    )}
                  >
                    {Number(dia.slice(-2))}
                    {marcado && (
                      <span
                        aria-hidden
                        className={cn(
                          'absolute bottom-1 size-1 rounded-full',
                          ativo ? 'bg-white' : 'bg-[var(--color-azul)]',
                        )}
                      />
                    )}
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>

      {legenda && <p className="mt-sm text-xs text-ink-mute">{legenda}</p>}
    </div>
  )
}

function mesmoMes(chave: string, mes: Date): boolean {
  const d = deChaveDia(chave)
  return d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear()
}

/** The month laid out as weeks, padded with nulls so columns line up. */
function montarSemanas(mes: Date): (string | null)[][] {
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const totalDias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celulas: (string | null)[] = Array.from({ length: primeiro.getDay() }, () => null)

  for (let d = 1; d <= totalDias; d++) {
    celulas.push(paraChaveDia(new Date(mes.getFullYear(), mes.getMonth(), d)))
  }
  while (celulas.length % 7 !== 0) celulas.push(null)

  const semanas: (string | null)[][] = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))
  return semanas
}
