import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { Consulta } from './tipos'

/**
 * Os fatores objetivos ao longo das consultas.
 *
 * Peso, pressão, altura uterina e BCF **já eram coletados** a cada atendimento —
 * e apareciam como número solto numa tabela, que é a forma mais eficiente de um
 * dado existir e não informar nada. Uma pressão de 130/85 não diz nada sozinha;
 * a mesma pressão depois de três consultas em 110/70 diz tudo.
 *
 * Sem biblioteca de gráfico: são polylines em SVG sobre um viewBox normalizado.
 * Uma dependência de charting custaria mais no bundle do que estas cinquenta
 * linhas, e o que se precisa aqui é da tendência, não de um gráfico interativo.
 */

interface Serie {
  chave: string
  rotulo: string
  unidade: string
  pontos: { x: number; y: number; rotulo: string }[]
  /** Faixa de normalidade, quando existe uma — desenhada como fundo suave. */
  faixa?: { min: number; max: number }
}

const FATORES: {
  chave: keyof NonNullable<Consulta['medidas']>
  rotulo: string
  unidade: string
  faixa?: { min: number; max: number }
}[] = [
  { chave: 'pesoKg', rotulo: 'Peso', unidade: 'kg' },
  { chave: 'paSistolica', rotulo: 'PA sistólica', unidade: 'mmHg', faixa: { min: 90, max: 140 } },
  { chave: 'paDiastolica', rotulo: 'PA diastólica', unidade: 'mmHg', faixa: { min: 60, max: 90 } },
  { chave: 'alturaUterinaCm', rotulo: 'Altura uterina', unidade: 'cm' },
  { chave: 'bcfBpm', rotulo: 'BCF', unidade: 'bpm', faixa: { min: 110, max: 160 } },
]

const L = 200
const A = 48

function Grafico({ serie }: { serie: Serie }) {
  const ys = serie.pontos.map((p) => p.y)
  const limites = [...ys, ...(serie.faixa ? [serie.faixa.min, serie.faixa.max] : [])]
  const min = Math.min(...limites)
  const max = Math.max(...limites)
  // Faixa nula (todos os valores iguais) dividiria por zero e sumiria a linha.
  const amplitude = max - min || 1

  const x = (i: number) =>
    serie.pontos.length === 1 ? L / 2 : (i / (serie.pontos.length - 1)) * L
  const y = (v: number) => A - ((v - min) / amplitude) * A

  const ultimo = serie.pontos[serie.pontos.length - 1]
  const penultimo = serie.pontos[serie.pontos.length - 2]
  const delta = penultimo ? ultimo.y - penultimo.y : null

  const foraDaFaixa =
    serie.faixa && (ultimo.y < serie.faixa.min || ultimo.y > serie.faixa.max)

  return (
    <div className="rounded-xl border border-line bg-paper-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-ink-mute">{serie.rotulo}</p>
        <p className={cn('font-display text-sm font-bold', foraDaFaixa ? 'text-warn-ink' : 'text-ink')}>
          {ultimo.y}
          <span className="ml-0.5 text-xs font-normal text-ink-mute">{serie.unidade}</span>
          {delta !== null && delta !== 0 && (
            <span className="ml-1.5 text-xs font-semibold text-ink-mute">
              {delta > 0 ? '+' : ''}
              {Math.round(delta * 10) / 10}
            </span>
          )}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="mt-1.5 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${serie.rotulo}: ${serie.pontos.map((p) => `${p.rotulo} ${p.y}`).join(', ')}`}
      >
        {serie.faixa && (
          <rect
            x={0}
            y={y(serie.faixa.max)}
            width={L}
            height={Math.max(1, y(serie.faixa.min) - y(serie.faixa.max))}
            className="fill-[var(--color-success)]"
            opacity={0.5}
          />
        )}
        <polyline
          points={serie.pontos.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')}
          fill="none"
          className="stroke-indigo"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {serie.pontos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.y)} r={2.5} className="fill-indigo" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  )
}

/**
 * Só desenha o que tem ao menos duas medidas: um ponto isolado não é evolução,
 * e um gráfico de um ponto só sugere uma tendência que não existe.
 */
export function EvolucaoObjetiva({ consultas }: { consultas: Consulta[] }) {
  const series = useMemo<Serie[]>(() => {
    // Da mais antiga para a mais nova — o eixo do tempo corre para a direita.
    const ordenadas = [...consultas].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
    )

    return FATORES.flatMap((f) => {
      const pontos = ordenadas
        .map((c) => ({
          valor: c.medidas?.[f.chave] as number | null | undefined,
          rotulo: new Date(c.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        }))
        .filter((p): p is { valor: number; rotulo: string } => typeof p.valor === 'number')
        .map((p, i) => ({ x: i, y: p.valor, rotulo: p.rotulo }))

      if (pontos.length < 2) return []
      return [{ chave: f.chave as string, rotulo: f.rotulo, unidade: f.unidade, pontos, faixa: f.faixa }]
    })
  }, [consultas])

  if (series.length === 0) return null

  return (
    <section>
      <h3 className="font-display text-xs font-bold uppercase tracking-caption text-ink-mute">
        Evolução
      </h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {series.map((s) => (
          <Grafico key={s.chave} serie={s} />
        ))}
      </div>
    </section>
  )
}
