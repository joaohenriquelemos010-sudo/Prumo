import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { molas } from '@/lib/motion'
import { Balanca } from '@/features/bebe/Balanca'
import { comparacaoDaSemana } from '@/features/bebe/comparacoes-semanais'
import { AnexosDoPeriodo } from '@/features/bebe/AnexosDoPeriodo'
import { delta, anexosDoPeriodo } from '@/features/bebe/agregacao'
import type { Periodo } from '@/features/bebe/agregacao'
import type { MedidaFetal, ExameResumo } from '@/features/bebe/tipos'
import type { PontoInfantil } from '@/features/bebe/CrescimentoInfantil'
import { cn } from '@/lib/cn'

/**
 * O chip de variação — a carga emocional da tela.
 *
 * "820 g" é um número. "+412 g desde a semana 24" é a percepção de que uma
 * pessoa está crescendo, e é exatamente o que faltava aqui: as medidas existiam,
 * mas nenhuma delas contava uma história.
 *
 * Quando não há dois pontos, o chip simplesmente não aparece. Mostrar "+0" seria
 * afirmar que nada mudou, quando o que se sabe é que ainda não se mediu de novo.
 */
export function ChipDelta({
  valor,
  unidade,
  desde,
  unidadeTempo,
}: {
  valor: number
  unidade: string
  desde: number
  unidadeTempo: string
}) {
  const subiu = valor >= 0
  const Icone = subiu ? TrendingUp : TrendingDown
  const formatado = `${subiu ? '+' : '−'}${Math.abs(valor).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  })}`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-display text-sm font-semibold',
        subiu ? 'u-chip-success' : 'u-chip-warn',
      )}
    >
      <Icone className="size-3.5" aria-hidden />
      {formatado} {unidade} desde {unidadeTempo} {desde}
    </span>
  )
}

function formatarPeso(g: number): string {
  return g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg` : `${g} g`
}

/**
 * Um período da gestação: o que o bebê era, quanto ele cresceu, e o que ficou
 * guardado daquela época.
 *
 * A `Balanca` é a heroína — a mesma ilustração da tela inteira, agora contando
 * um pedaço da história em vez do estado atual. Entra com mola suave e sem
 * `pointer-events: none`: a lista continua rolável enquanto os cartões chegam,
 * porque uma animação que trava a interface é pior do que nenhuma.
 */
export function CartaoPeriodoFetal({
  periodo,
  exames,
  ehMedico,
  indice,
}: {
  periodo: Periodo<MedidaFetal>
  exames: ExameResumo[]
  ehMedico: boolean
  indice: number
}) {
  const reduzido = useReducedMotion()

  const comPeso = periodo.itens.filter((m) => typeof m.pfeG === 'number' && m.pfeG > 0)
  const ultima = comPeso[comPeso.length - 1] ?? periodo.itens[periodo.itens.length - 1]
  const variacao = delta(
    periodo.itens,
    (m) => m.pfeG,
    (m) => m.semana,
  )
  const comparacao = comparacaoDaSemana(ultima?.semana ?? periodo.ate)
  const anexos = anexosDoPeriodo(exames, periodo)

  return (
    <motion.article
      initial={reduzido ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduzido ? { duration: 0 } : { ...molas.suave, delay: Math.min(indice, 6) * 0.04 }}
      /* Âncora estável para o smoke contar períodos sem depender de `article`,
         que outras seções da página também usam. */
      data-periodo={periodo.chave}
      className="rounded-2xl border border-line bg-paper p-lg shadow-soft"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-indigo">{periodo.rotulo}</h3>
        <p className="text-xs text-ink-mute">
          {periodo.itens.length === 1 ? '1 medida' : `${periodo.itens.length} medidas`}
        </p>
      </header>

      <div className="mt-md">
        <Balanca
          semana={ultima?.semana ?? periodo.ate}
          pesoG={ultima?.pfeG ?? null}
          vazio="Sem peso estimado neste período."
        />
      </div>

      {(variacao || comparacao) && (
        <div className="mt-md flex flex-wrap items-center gap-2">
          {variacao && (
            <ChipDelta
              valor={variacao.valor}
              unidade="g"
              desde={variacao.de}
              unidadeTempo="a semana"
            />
          )}
          {comparacao && !ehMedico && (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-paper-2 px-3 py-1 font-display text-sm font-semibold text-ink">
              <span aria-hidden>{comparacao.emoji}</span>
              do tamanho de {comparacao.objeto}
            </span>
          )}
        </div>
      )}

      {comparacao && !ehMedico && (
        <p className="mt-2 text-sm text-ink-soft">{comparacao.acontecendo}</p>
      )}

      {ehMedico && periodo.itens.length > 0 && (
        <dl className="mt-md grid grid-cols-2 gap-3 rounded-xl bg-paper-2 p-md text-sm min-[560px]:grid-cols-4">
          {periodo.itens.slice(-1).map((m) => (
            <ItensClinicos key={m.id} medida={m} />
          ))}
        </dl>
      )}

      <AnexosDoPeriodo exames={anexos} />
    </motion.article>
  )
}

function ItensClinicos({ medida }: { medida: MedidaFetal }) {
  const campos: [string, string][] = [
    ['PFE', medida.pfeG ? formatarPeso(medida.pfeG) : '—'],
    ['CC', medida.ccMm ? `${medida.ccMm} mm` : '—'],
    ['CA', medida.caMm ? `${medida.caMm} mm` : '—'],
    ['ILA', medida.ilaCm ? `${medida.ilaCm} cm` : '—'],
  ]
  return (
    <>
      {campos.map(([termo, valor]) => (
        <div key={termo}>
          <dt className="text-xs text-ink-mute">{termo}</dt>
          <dd className="font-display font-bold text-ink">{valor}</dd>
        </div>
      ))}
    </>
  )
}

/** O mesmo cartão do outro lado da jornada: meses de vida em vez de semanas. */
export function CartaoPeriodoInfantil({
  periodo,
  exames,
  indice,
}: {
  periodo: Periodo<PontoInfantil>
  exames: ExameResumo[]
  indice: number
}) {
  const reduzido = useReducedMotion()

  const ultimo = periodo.itens[periodo.itens.length - 1]
  const variacaoPeso = delta(
    periodo.itens,
    (p) => p.pesoKg,
    (p) => p.meses,
  )
  const variacaoComprimento = delta(
    periodo.itens,
    (p) => p.comprimentoCm,
    (p) => p.meses,
  )
  const anexos = anexosDoPeriodo(exames, periodo)

  const medidas: [string, string][] = [
    ['Peso', ultimo?.pesoKg ? `${ultimo.pesoKg.toFixed(2).replace('.', ',')} kg` : '—'],
    ['Comprimento', ultimo?.comprimentoCm ? `${ultimo.comprimentoCm} cm` : '—'],
    [
      'Perímetro cefálico',
      ultimo?.perimetroCefalicoCm ? `${ultimo.perimetroCefalicoCm} cm` : '—',
    ],
  ]

  return (
    <motion.article
      initial={reduzido ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduzido ? { duration: 0 } : { ...molas.suave, delay: Math.min(indice, 6) * 0.04 }}
      /* Âncora estável para o smoke contar períodos sem depender de `article`,
         que outras seções da página também usam. */
      data-periodo={periodo.chave}
      className="rounded-2xl border border-line bg-paper p-lg shadow-soft"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-indigo">{periodo.rotulo}</h3>
        <p className="text-xs text-ink-mute">
          {periodo.itens.length === 1 ? '1 medida' : `${periodo.itens.length} medidas`}
        </p>
      </header>

      <div className="mt-md">
        <Balanca
          semana={40}
          progresso={1}
          pesoG={ultimo?.pesoKg ? ultimo.pesoKg * 1000 : null}
          legenda={periodo.rotulo.toLowerCase()}
          vazio="Sem peso registrado neste período."
        />
      </div>

      {(variacaoPeso || variacaoComprimento) && (
        <div className="mt-md flex flex-wrap items-center gap-2">
          {variacaoPeso && (
            <ChipDelta
              valor={Number(variacaoPeso.valor.toFixed(2))}
              unidade="kg"
              desde={variacaoPeso.de}
              unidadeTempo="o mês"
            />
          )}
          {variacaoComprimento && (
            <ChipDelta
              valor={Number(variacaoComprimento.valor.toFixed(1))}
              unidade="cm"
              desde={variacaoComprimento.de}
              unidadeTempo="o mês"
            />
          )}
        </div>
      )}

      <dl className="mt-md grid grid-cols-2 gap-3 rounded-xl bg-paper-2 p-md text-sm min-[560px]:grid-cols-3">
        {medidas.map(([termo, valor]) => (
          <div key={termo}>
            <dt className="text-xs text-ink-mute">{termo}</dt>
            <dd className="font-display font-bold text-ink">{valor}</dd>
          </div>
        ))}
      </dl>

      <AnexosDoPeriodo exames={anexos} />
    </motion.article>
  )
}
