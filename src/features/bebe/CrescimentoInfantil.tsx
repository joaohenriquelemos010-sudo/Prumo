import { useMemo, useState } from 'react'
import { Ruler } from 'lucide-react'
import { CurvaCrescimento } from './CurvaCrescimento'
import type { PontoCurva, PontoMedida } from './CurvaCrescimento'
import { cn } from '@/lib/cn'

export type MedidaInfantilChave = 'pesoKg' | 'comprimentoCm' | 'perimetroCefalicoCm'

export interface PontoInfantil {
  meses: number
  data: string
  pesoKg: number | null
  comprimentoCm: number | null
  perimetroCefalicoCm: number | null
  origem: 'nascimento' | 'consulta'
  autorNome: string
  percentis?: Partial<Record<MedidaInfantilChave, number | null>>
}

export interface CurvasInfantis {
  pesoKg: { meses: number; faixa: PontoCurva['faixa'] }[]
  comprimentoCm: { meses: number; faixa: PontoCurva['faixa'] }[]
  perimetroCefalicoCm: { meses: number; faixa: PontoCurva['faixa'] }[]
}

const ABAS: { chave: MedidaInfantilChave; label: string; unidade: string }[] = [
  { chave: 'pesoKg', label: 'Peso', unidade: 'kg' },
  { chave: 'comprimentoCm', label: 'Comprimento', unidade: 'cm' },
  { chave: 'perimetroCefalicoCm', label: 'Perímetro cefálico', unidade: 'cm' },
]

/**
 * The child's growth against the WHO curves.
 *
 * Three measures behind one chart rather than three charts stacked: they share an
 * x axis and the reader only ever asks about one at a time. Head circumference
 * gets a tab of its own because it is the one the guideline singles out — "is this
 * head size normal for the age?" — and it is the easiest to skip in a busy visit.
 */
export function CrescimentoInfantil({
  medidas,
  curvas,
  mostrarPercentis,
}: {
  medidas: PontoInfantil[]
  curvas: CurvasInfantis | null
  mostrarPercentis?: boolean
}) {
  const [aba, setAba] = useState<MedidaInfantilChave>('pesoKg')
  const atual = ABAS.find((a) => a.chave === aba)!

  const pontos: PontoMedida[] = useMemo(
    () =>
      medidas
        .filter((m) => typeof m[aba] === 'number' && (m[aba] as number) > 0)
        .map((m) => ({
          x: m.meses,
          valor: m[aba] as number,
          percentil: m.percentis?.[aba] ?? null,
        })),
    [medidas, aba],
  )

  /**
   * The band is tabulated to 24 months, but plotting all of it squeezes a
   * five-month-old's four points into the left fifth of the axis and pushes the
   * last ticks off a phone screen. Follow the data instead: a bit of headroom
   * past the last measurement, never less than a year, never more than the table.
   */
  const curva: PontoCurva[] = useMemo(() => {
    const completa = curvas?.[aba] ?? []
    if (completa.length === 0) return []
    const ultimoMes = medidas.reduce((max, m) => Math.max(max, m.meses), 0)
    const limite = Math.min(24, Math.max(12, Math.ceil((ultimoMes + 2) / 3) * 3))
    return completa.filter((c) => c.meses <= limite).map((c) => ({ x: c.meses, faixa: c.faixa }))
  }, [curvas, aba, medidas])

  if (curva.length === 0) return null

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <h2 className="inline-flex items-center gap-2 text-lg">
        <Ruler className="size-5 text-indigo" aria-hidden />
        Como o bebê vem crescendo
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Cada ponto é uma medida da consulta. A faixa é a referência da OMS para a idade.
      </p>

      <div className="mt-md flex flex-wrap gap-1 rounded-pill bg-paper-2 p-1" role="tablist" aria-label="Medida">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            role="tab"
            aria-selected={aba === a.chave}
            onClick={() => setAba(a.chave)}
            className={cn(
              'min-h-9 flex-1 rounded-pill px-3 font-display text-sm font-semibold transition-colors',
              aba === a.chave ? 'bg-paper text-indigo shadow-soft' : 'text-ink-soft hover:text-indigo',
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-md">
        {pontos.length === 0 ? (
          <p className="text-sm text-ink-mute">
            Ainda não há {atual.label.toLowerCase()} registrado nas consultas.
          </p>
        ) : (
          <CurvaCrescimento
            curva={curva}
            medidas={pontos}
            rotuloX="meses"
            unidade={atual.unidade}
            passoX={3}
            mostrarPercentis={mostrarPercentis}
          />
        )}
      </div>
    </section>
  )
}
