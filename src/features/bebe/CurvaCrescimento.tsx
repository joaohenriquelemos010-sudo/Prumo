import { useMemo, useState } from 'react'

/**
 * Growth chart: one measurement series against its reference band.
 *
 * Serves both halves of the journey — fetal weight by gestational week against
 * the Hadlock band, and the child's weight/length/head circumference by month
 * against the WHO curves. Same shape, same reading, so the family recognises the
 * chart after birth instead of meeting a new one.
 *
 * Form is **emphasis**, not categorical: one series is the point and everything
 * else is context. A single accent hue for the baby, a recessive wash for the
 * P10–P90 band, a hairline median. No second axis, no rainbow, and a value
 * printed only at the endpoint — the rest live in the tooltip and in the table.
 *
 * Hand-rolled SVG because the project carries no charting library and every
 * colour here is a design token, so it flips with the theme for free.
 */

export interface FaixaPercentil {
  p3: number
  p10: number
  p50: number
  p90: number
  p97: number
}

export interface PontoCurva {
  x: number
  faixa: FaixaPercentil
}

export interface PontoMedida {
  x: number
  valor: number
  percentil: number | null
}

interface Props {
  curva: PontoCurva[]
  medidas: PontoMedida[]
  /** "semanas" / "meses" — sits at the end of the x axis. */
  rotuloX: string
  /** "g" / "kg" / "cm" */
  unidade: string
  /** Spacing of the x ticks, in x units. */
  passoX?: number
  /** Show the reference numbers to a clinician; keep them off the family's screen. */
  mostrarPercentis?: boolean
}

// A narrower viewBox keeps the tick text legible when the SVG scales down: at
// 640 wide on a 390px screen, 10px labels rendered at ~5px. The container scrolls
// below `min-w`, which is the honest fix for a chart that needs room.
const LARGURA = 480
const ALTURA = 260
const MARGEM = { top: 16, right: 60, bottom: 34, left: 46 }

function formatar(valor: number, unidade: string): string {
  if (unidade === 'kg' || unidade === 'cm') {
    return `${valor.toFixed(1).replace('.', ',')} ${unidade}`
  }
  return `${Math.round(valor)} ${unidade}`
}

export function CurvaCrescimento({
  curva,
  medidas,
  rotuloX,
  unidade,
  passoX = 6,
  mostrarPercentis,
}: Props) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const geometria = useMemo(() => {
    if (curva.length === 0) return null

    const xs = curva.map((c) => c.x)
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    if (xMax === xMin) return null

    const yMax = Math.max(...curva.map((c) => c.faixa.p97), ...medidas.map((m) => m.valor)) * 1.05

    const larguraPlot = LARGURA - MARGEM.left - MARGEM.right
    const alturaPlot = ALTURA - MARGEM.top - MARGEM.bottom
    const x = (v: number) => MARGEM.left + ((v - xMin) / (xMax - xMin)) * larguraPlot
    const y = (v: number) => MARGEM.top + alturaPlot - (v / yMax) * alturaPlot

    const medianaPath = curva
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${x(c.x)},${y(c.faixa.p50)}`)
      .join(' ')

    // The band is one closed shape: P90 out, P10 back.
    const banda = [
      ...curva.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(c.x)},${y(c.faixa.p90)}`),
      ...[...curva].reverse().map((c) => `L${x(c.x)},${y(c.faixa.p10)}`),
      'Z',
    ].join(' ')

    const ordenadas = [...medidas].sort((a, b) => a.x - b.x)
    const caminhoBebe = ordenadas.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(m.x)},${y(m.valor)}`).join(' ')

    // Clean tick values rather than raw maxima.
    const passoY = yMax > 3000 ? 1000 : yMax > 1000 ? 500 : yMax > 100 ? 50 : yMax > 20 ? 5 : 2
    const ticksY: number[] = []
    for (let v = 0; v <= yMax; v += passoY) ticksY.push(v)

    const ticksX = xs.filter((v) => v % passoX === 0)

    return { x, y, banda, medianaPath, caminhoBebe, ordenadas, ticksX, ticksY }
  }, [curva, medidas, passoX])

  if (!geometria) return null
  const { x, y, banda, medianaPath, caminhoBebe, ordenadas, ticksX, ticksY } = geometria
  const ultimo = ordenadas[ordenadas.length - 1]
  const pontoAtivo = ativo != null ? ordenadas.find((m) => m.x === ativo) : null

  return (
    <figure className="m-0">
      {/* Bleeds into the card's padding on small screens: that's ~64px of width
          the chart can use, which is the difference between fitting and scrolling
          on a phone. Still scrolls below `min-w`, so nothing is ever cropped. */}
      <div className="-mx-lg overflow-x-auto px-lg sm:mx-0 sm:px-0">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="h-auto w-full min-w-[380px]"
          role="img"
          aria-label={
            ultimo
              ? `Curva de crescimento. Última medida: ${formatar(ultimo.valor, unidade)} com ${ultimo.x} ${rotuloX}.`
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
            <g key={m.x}>
              {/* Hit target larger than the mark. */}
              <circle
                cx={x(m.x)}
                cy={y(m.valor)}
                r={14}
                fill="transparent"
                onMouseEnter={() => setAtivo(m.x)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(m.x)}
                onBlur={() => setAtivo(null)}
                tabIndex={0}
                role="button"
                aria-label={`${m.x} ${rotuloX}: ${formatar(m.valor, unidade)}${m.percentil ? `, percentil ${m.percentil}` : ''}`}
              />
              {/* 2px surface ring keeps the dot legible where it crosses the band. */}
              <circle
                cx={x(m.x)}
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
              x={Math.min(x(ultimo.x) + 10, LARGURA - MARGEM.right + 4)}
              y={y(ultimo.valor) + 4}
              className="fill-[var(--color-ink)] text-[12px] font-semibold"
            >
              {formatar(ultimo.valor, unidade)}
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
          {ticksX.map((v) => (
            <text
              key={v}
              x={x(v)}
              y={ALTURA - 10}
              textAnchor="middle"
              className="fill-[var(--color-ink-mute)] text-[11px]"
            >
              {v}
            </text>
          ))}
        </svg>
      </div>

      {/* Three distinct marks, so the key earns its place. The x unit lives here
          rather than at the end of the axis, where it collided with the last tick. */}
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mute">
        <span>Eixo horizontal em {rotuloX}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--color-azul)]" aria-hidden />
          Seu bebê
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--color-ink-mute)]" aria-hidden />
          Mediana esperada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-[var(--color-lilas)] opacity-30" aria-hidden />
          Faixa esperada
        </span>
      </figcaption>

      {pontoAtivo && (
        <p role="status" className="mt-2 inline-block rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-soft">
          <strong className="text-ink">
            {pontoAtivo.x} {rotuloX}
          </strong>{' '}
          · {formatar(pontoAtivo.valor, unidade)}
          {mostrarPercentis && pontoAtivo.percentil != null && ` · percentil ${pontoAtivo.percentil}`}
        </p>
      )}
    </figure>
  )
}
