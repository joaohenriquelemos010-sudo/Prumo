import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Fetal growth chart: the baby's estimated weight against the reference band.
 *
 * Form is **emphasis**, not categorical — one series is the point and everything
 * else is context. So: a single accent hue for the baby, a recessive wash for the
 * P10–P90 band and a hairline median. No second axis, no rainbow, no value printed
 * on every point (only the endpoint is labelled; the rest live in the tooltip and
 * in the table below the chart).
 *
 * Hand-rolled SVG because the project carries no charting library and every colour
 * here is a design token, so it flips with the theme for free.
 */

export interface FaixaPercentil {
  p3: number
  p10: number
  p50: number
  p90: number
  p97: number
}

export interface PontoCurva {
  semana: number
  faixa: FaixaPercentil
}

export interface PontoMedida {
  semana: number
  valor: number
  percentil: number | null
}

interface Props {
  curva: PontoCurva[]
  medidas: PontoMedida[]
  /** Show the reference numbers to a clinician; keep them off the family's screen. */
  mostrarPercentis?: boolean
}

// A narrower viewBox keeps the tick text legible when the SVG scales down: at
// 640 wide on a 390px screen, 10px labels rendered at ~5px. The container scrolls
// below `min-w`, which is the honest fix for a chart that needs room.
const LARGURA = 480
const ALTURA = 260
const MARGEM = { top: 16, right: 56, bottom: 34, left: 46 }

export function CurvaCrescimento({ curva, medidas, mostrarPercentis }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const geometria = useMemo(() => {
    if (curva.length === 0) return null

    const semanas = curva.map((c) => c.semana)
    const xMin = Math.min(...semanas)
    const xMax = Math.max(...semanas)
    const yMax = Math.max(...curva.map((c) => c.faixa.p97), ...medidas.map((m) => m.valor)) * 1.05

    const larguraPlot = LARGURA - MARGEM.left - MARGEM.right
    const alturaPlot = ALTURA - MARGEM.top - MARGEM.bottom
    const x = (s: number) => MARGEM.left + ((s - xMin) / (xMax - xMin)) * larguraPlot
    const y = (v: number) => MARGEM.top + alturaPlot - (v / yMax) * alturaPlot

    const linha = (sel: (f: FaixaPercentil) => number) =>
      curva.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(c.semana)},${y(sel(c.faixa))}`).join(' ')

    // The band is drawn as one closed shape: P90 out, P10 back.
    const banda = [
      ...curva.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(c.semana)},${y(c.faixa.p90)}`),
      ...[...curva].reverse().map((c) => `L${x(c.semana)},${y(c.faixa.p10)}`),
      'Z',
    ].join(' ')

    const ordenadas = [...medidas].sort((a, b) => a.semana - b.semana)
    const caminhoBebe = ordenadas
      .map((m, i) => `${i === 0 ? 'M' : 'L'}${x(m.semana)},${y(m.valor)}`)
      .join(' ')

    // Clean tick values rather than raw maxima.
    const passoY = yMax > 3000 ? 1000 : yMax > 1000 ? 500 : 100
    const ticksY: number[] = []
    for (let v = 0; v <= yMax; v += passoY) ticksY.push(v)

    const ticksX = semanas.filter((s) => s % 6 === 0)

    return { x, y, banda, medianaPath: linha((f) => f.p50), caminhoBebe, ordenadas, ticksX, ticksY, xMin, xMax }
  }, [curva, medidas])

  if (!geometria) return null
  const { x, y, banda, medianaPath, caminhoBebe, ordenadas, ticksX, ticksY } = geometria
  const ultimo = ordenadas[ordenadas.length - 1]
  const pontoAtivo = ativo != null ? ordenadas.find((m) => m.semana === ativo) : null

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="h-auto w-full min-w-[420px]"
          role="img"
          aria-label={
            ultimo
              ? `Curva de crescimento. Última medida na semana ${ultimo.semana}: ${Math.round(ultimo.valor)} gramas.`
              : 'Curva de crescimento, ainda sem medidas.'
          }
        >
          {/* Gridlines — hairline, solid, recessive. */}
          {ticksY.map((v) => (
            <line
              key={v}
              x1={MARGEM.left}
              x2={LARGURA - MARGEM.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          ))}

          {/* Reference band P10–P90: context, so it stays a wash. */}
          <path d={banda} fill="var(--color-lilas)" opacity={0.12} />
          {/* Median: hairline, dashed only to say "this is a reference, not data". */}
          <path
            d={medianaPath}
            fill="none"
            stroke="var(--color-ink-mute)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* The baby — the one thing allowed to be loud. */}
          {ordenadas.length > 1 && (
            <path
              d={caminhoBebe}
              fill="none"
              stroke="var(--color-azul)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {ordenadas.map((m) => (
            <g key={m.semana}>
              {/* Hit target larger than the mark. */}
              <circle
                cx={x(m.semana)}
                cy={y(m.valor)}
                r={14}
                fill="transparent"
                onMouseEnter={() => setAtivo(m.semana)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(m.semana)}
                onBlur={() => setAtivo(null)}
                tabIndex={0}
                role="button"
                aria-label={`Semana ${m.semana}: ${Math.round(m.valor)} gramas${m.percentil ? `, percentil ${m.percentil}` : ''}`}
              />
              {/* 2px surface ring keeps the dot legible where it crosses the band. */}
              <circle
                cx={x(m.semana)}
                cy={y(m.valor)}
                r={5}
                fill="var(--color-azul)"
                stroke="var(--color-paper)"
                strokeWidth={2}
              />
            </g>
          ))}

          {/* Only the endpoint gets a direct label. */}
          {ultimo && (
            <text
              x={x(ultimo.semana) + 10}
              y={y(ultimo.valor) + 4}
              className="fill-[var(--color-ink)] text-[12px] font-semibold"
            >
              {Math.round(ultimo.valor)} g
            </text>
          )}

          {/* Axes */}
          {ticksY.map((v) => (
            <text
              key={v}
              x={MARGEM.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-[var(--color-ink-mute)] text-[11px]"
            >
              {v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR')}k` : v}
            </text>
          ))}
          {ticksX.map((s) => (
            <text
              key={s}
              x={x(s)}
              y={ALTURA - 10}
              textAnchor="middle"
              className="fill-[var(--color-ink-mute)] text-[11px]"
            >
              {s}
            </text>
          ))}
          <text
            x={LARGURA - MARGEM.right}
            y={ALTURA - 10}
            textAnchor="end"
            className="fill-[var(--color-ink-mute)] text-[11px]"
          >
            semanas
          </text>
        </svg>
      </div>

      {/* Three distinct marks, so the key earns its place. */}
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mute">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--color-azul)]" aria-hidden />
          Seu bebê
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--color-ink-mute)]" aria-hidden />
          Mediana esperada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-sm bg-[var(--color-lilas)] opacity-30"
            aria-hidden
          />
          Faixa esperada
        </span>
      </figcaption>

      {pontoAtivo && (
        <p
          role="status"
          className={cn(
            'mt-2 inline-block rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-soft',
          )}
        >
          <strong className="text-ink">Semana {pontoAtivo.semana}</strong> ·{' '}
          {Math.round(pontoAtivo.valor)} g
          {mostrarPercentis && pontoAtivo.percentil != null && ` · percentil ${pontoAtivo.percentil}`}
        </p>
      )}
    </figure>
  )
}
