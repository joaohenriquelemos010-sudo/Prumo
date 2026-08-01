import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { horaParaMinuto, minutoParaHora } from './grade'

export interface RegraDia {
  diaSemana: number
  inicio: string
  fim: string
}

const DIAS = [
  { n: 0, curto: 'DOM', longo: 'Domingo' },
  { n: 1, curto: 'SEG', longo: 'Segunda' },
  { n: 2, curto: 'TER', longo: 'Terça' },
  { n: 3, curto: 'QUA', longo: 'Quarta' },
  { n: 4, curto: 'QUI', longo: 'Quinta' },
  { n: 5, curto: 'SEX', longo: 'Sexta' },
  { n: 6, curto: 'SÁB', longo: 'Sábado' },
]

/** O que a maioria dos consultórios usa. Um ponto de partida, não uma regra. */
const PADRAO = { inicio: '08:00', fim: '18:00' }

/**
 * Os dias da semana em que se atende, e de que hora a que hora.
 *
 * O mapa do fluxo pede um **calendário interativo**, e a diferença com o
 * formulário que existia antes é de esforço, não de estética: lá era "adicionar
 * regra → escolher dia → escolher início → escolher fim", repetido cinco vezes,
 * com o resultado espalhado numa lista. Aqui a semana inteira está à vista, cada
 * dia é um botão que liga e desliga, e os horários aparecem no dia que já está
 * ligado.
 *
 * Ligar um dia usa 08:00–18:00 como ponto de partida em vez de campos vazios:
 * quem discorda edita, e quem não discorda já terminou.
 */
export function SemanaInterativa({
  regras,
  onChange,
}: {
  regras: RegraDia[]
  onChange: (regras: RegraDia[]) => void
}) {
  const porDia = useMemo(() => {
    const mapa = new Map<number, RegraDia>()
    for (const r of regras) mapa.set(r.diaSemana, r)
    return mapa
  }, [regras])

  function alternar(dia: number) {
    if (porDia.has(dia)) {
      onChange(regras.filter((r) => r.diaSemana !== dia))
    } else {
      onChange(
        [...regras, { diaSemana: dia, ...PADRAO }].sort((a, b) => a.diaSemana - b.diaSemana),
      )
    }
  }

  function editar(dia: number, campo: 'inicio' | 'fim', valor: string) {
    onChange(regras.map((r) => (r.diaSemana === dia ? { ...r, [campo]: valor } : r)))
  }

  /** Copia o horário do primeiro dia ligado para todos os outros. */
  function igualarTodos() {
    const modelo = regras[0]
    if (!modelo) return
    onChange(regras.map((r) => ({ ...r, inicio: modelo.inicio, fim: modelo.fim })))
  }

  const invalidos = regras.filter((r) => {
    const i = horaParaMinuto(r.inicio)
    const f = horaParaMinuto(r.fim)
    return i === null || f === null || f <= i
  })

  return (
    <div className="flex flex-col gap-md">
      {/* A semana toda à vista, ligando e desligando com um toque. */}
      <div className="flex flex-wrap gap-2">
        {DIAS.map((d) => {
          const ligado = porDia.has(d.n)
          return (
            <button
              key={d.n}
              type="button"
              aria-pressed={ligado}
              onClick={() => alternar(d.n)}
              className={cn(
                'min-h-11 min-w-14 rounded-xl border px-3 font-display text-sm font-semibold',
                'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
                ligado
                  ? 'border-indigo bg-[color-mix(in_oklab,var(--color-indigo)_16%,var(--color-paper))] text-indigo'
                  : 'border-line bg-paper text-ink-mute hover:bg-paper-2',
              )}
            >
              {d.curto}
            </button>
          )
        })}
      </div>

      {regras.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Toque nos dias em que você atende. Dá para mudar depois quando quiser.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {regras.map((r) => {
              const dia = DIAS[r.diaSemana]
              const i = horaParaMinuto(r.inicio)
              const f = horaParaMinuto(r.fim)
              const ruim = i === null || f === null || f <= i
              return (
                <li
                  key={r.diaSemana}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper-2 p-3"
                >
                  <span className="w-20 shrink-0 font-display text-sm font-semibold text-ink">
                    {dia.longo}
                  </span>
                  <label className="text-xs text-ink-mute">
                    das
                    <input
                      type="time"
                      value={r.inicio}
                      onChange={(e) => editar(r.diaSemana, 'inicio', e.target.value)}
                      className="input ml-1.5 inline-block w-auto py-1"
                    />
                  </label>
                  <label className="text-xs text-ink-mute">
                    às
                    <input
                      type="time"
                      value={r.fim}
                      onChange={(e) => editar(r.diaSemana, 'fim', e.target.value)}
                      className="input ml-1.5 inline-block w-auto py-1"
                    />
                  </label>
                  {ruim ? (
                    <span className="text-xs font-semibold text-warn-ink">
                      O fim precisa vir depois do início.
                    </span>
                  ) : (
                    <span className="text-xs text-ink-mute">
                      {Math.round(((f as number) - (i as number)) / 6) / 10} h
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => alternar(r.diaSemana)}
                    className="ml-auto text-xs font-semibold text-ink-soft hover:text-indigo"
                  >
                    Não atendo
                  </button>
                </li>
              )
            })}
          </ul>

          {regras.length > 1 && (
            <button
              type="button"
              onClick={igualarTodos}
              className="w-fit text-sm font-semibold text-indigo hover:underline"
            >
              Usar {minutoParaHora(horaParaMinuto(regras[0].inicio) ?? 480)}–
              {minutoParaHora(horaParaMinuto(regras[0].fim) ?? 1080)} em todos os dias
            </button>
          )}
        </>
      )}

      {invalidos.length > 0 && (
        <p className="text-sm font-semibold text-warn-ink">
          Confere os horários marcados em vermelho — sem isso a agenda não gera nenhum horário.
        </p>
      )}
    </div>
  )
}
