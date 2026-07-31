import type { MedidaFetal } from '@/features/bebe/tipos'
import type { PontoInfantil } from '@/features/bebe/CrescimentoInfantil'

/**
 * Como a evolução do bebê é agrupada no tempo.
 *
 * Puro, sem React e sem relógio implícito — a mesma forma de `server/services/
 * slots.ts`, e pelo mesmo motivo: é aritmética com regra clínica dentro. Um
 * bucket errado não quebra a tela, ele conta uma história errada sobre o
 * crescimento de uma criança, e isso não aparece em nenhum erro de runtime.
 *
 * Quem escolhe a granularidade é quem cuida, não o produto. Uma mãe de primeira
 * viagem na semana 12 quer ver semana a semana; a mesma pessoa oito meses
 * depois, com a vida cheia, quer o trimestre inteiro numa tela.
 */
export type Granularidade = 'semana' | 'mes' | 'trimestre'

export const GRANULARIDADES: { id: Granularidade; rotulo: string }[] = [
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'trimestre', rotulo: 'Trimestre' },
]

export interface Periodo<T> {
  /** Estável entre renders e entre granularidades — serve de `key` e de âncora. */
  chave: string
  rotulo: string
  /** Início e fim do intervalo, na unidade da fase (semanas ou meses). */
  de: number
  ate: number
  itens: T[]
  /** Datas reais cobertas, para casar exames com o período. */
  dataInicio: string | null
  dataFim: string | null
}

/**
 * Os trimestres **de verdade** da gestação, e não terços dos dados.
 *
 * Dividir a lista de medidas em três partes iguais daria buckets que mudam de
 * significado toda vez que uma medida nova entra — e "primeiro trimestre"
 * passaria a querer dizer coisas diferentes em semanas diferentes. Os limites
 * são obstétricos: 1–13, 14–27, 28–42.
 */
export const TRIMESTRES_GESTACAO: { de: number; ate: number; rotulo: string }[] = [
  { de: 0, ate: 13, rotulo: '1º trimestre' },
  { de: 14, ate: 27, rotulo: '2º trimestre' },
  { de: 28, ate: 42, rotulo: '3º trimestre' },
]

function ordinal(n: number): string {
  return `${n}º`
}

/** O trimestre de vida a que um mês pertence: 0–2, 3–5, 6–8… */
function trimestreDoMes(mes: number): { de: number; ate: number; rotulo: string } {
  const indice = Math.floor(mes / 3)
  const de = indice * 3
  return { de, ate: de + 2, rotulo: `${ordinal(indice + 1)} trimestre de vida` }
}

function faixaDeDatas<T extends { data: string }>(itens: T[]): {
  dataInicio: string | null
  dataFim: string | null
} {
  if (itens.length === 0) return { dataInicio: null, dataFim: null }
  const ordenadas = itens.map((i) => i.data).sort()
  return { dataInicio: ordenadas[0], dataFim: ordenadas[ordenadas.length - 1] }
}

/**
 * Agrupa as medidas fetais.
 *
 * Períodos vazios **não** são criados: um cartão "semana 17, nenhuma medida"
 * repetido dez vezes é ruído que empurra para baixo o que a pessoa veio ver. A
 * curva de crescimento é quem mostra os vazios, e lá eles significam alguma
 * coisa.
 */
export function agruparFetais(
  medidas: MedidaFetal[],
  granularidade: Granularidade,
): Periodo<MedidaFetal>[] {
  if (medidas.length === 0) return []
  const ordenadas = [...medidas].sort((a, b) => a.semana - b.semana)

  if (granularidade === 'semana') {
    return agrupar(ordenadas, (m) => {
      const s = m.semana
      return { chave: `s${s}`, rotulo: `Semana ${s}`, de: s, ate: s }
    })
  }

  if (granularidade === 'mes') {
    // Mês gestacional ≈ 4 semanas. É a conta que a gestante ouve na consulta
    // ("você está de cinco meses"), e não a conversão de calendário.
    return agrupar(ordenadas, (m) => {
      const mes = Math.max(1, Math.ceil(m.semana / 4))
      return {
        chave: `m${mes}`,
        rotulo: `${ordinal(mes)} mês`,
        de: (mes - 1) * 4 + 1,
        ate: mes * 4,
      }
    })
  }

  return agrupar(ordenadas, (m) => {
    const t = TRIMESTRES_GESTACAO.find((x) => m.semana >= x.de && m.semana <= x.ate) ?? TRIMESTRES_GESTACAO[2]
    return { chave: `t${t.de}`, rotulo: t.rotulo, de: t.de, ate: t.ate }
  })
}

/** Agrupa as medidas da criança, em meses de vida. */
export function agruparInfantis(
  pontos: PontoInfantil[],
  granularidade: Granularidade,
): Periodo<PontoInfantil>[] {
  if (pontos.length === 0) return []
  const ordenados = [...pontos].sort((a, b) => a.meses - b.meses)

  // Depois do nascimento não existe "semana": a puericultura e as curvas da OMS
  // são mensais. Pedir semana devolve mês, em vez de devolver uma tela vazia.
  if (granularidade === 'semana' || granularidade === 'mes') {
    return agrupar(ordenados, (p) => ({
      chave: `m${p.meses}`,
      rotulo: p.meses === 0 ? 'Nascimento' : `${p.meses} ${p.meses === 1 ? 'mês' : 'meses'}`,
      de: p.meses,
      ate: p.meses,
    }))
  }

  return agrupar(ordenados, (p) => {
    const t = trimestreDoMes(p.meses)
    return { chave: `t${t.de}`, rotulo: t.rotulo, de: t.de, ate: t.ate }
  })
}

function agrupar<T extends { data: string }>(
  itens: T[],
  chaveDe: (item: T) => { chave: string; rotulo: string; de: number; ate: number },
): Periodo<T>[] {
  const mapa = new Map<string, Periodo<T>>()

  for (const item of itens) {
    const { chave, rotulo, de, ate } = chaveDe(item)
    const existente = mapa.get(chave)
    if (existente) {
      existente.itens.push(item)
    } else {
      mapa.set(chave, { chave, rotulo, de, ate, itens: [item], dataInicio: null, dataFim: null })
    }
  }

  const periodos = [...mapa.values()]
  for (const p of periodos) Object.assign(p, faixaDeDatas(p.itens))
  return periodos.sort((a, b) => a.de - b.de)
}

/**
 * A variação entre o primeiro e o último valor conhecido de uma série.
 *
 * **É a carga emocional da tela.** "820 g" é um número; "+412 g desde a semana
 * 24" é a percepção de que uma pessoa está crescendo. É por isso que existe
 * como função testável e não como um `at(-1) - at(0)` solto numa view.
 */
export interface Delta {
  valor: number
  de: number
  ate: number
}

export function delta<T>(
  itens: T[],
  valorDe: (item: T) => number | null,
  posicaoDe: (item: T) => number,
): Delta | null {
  const comValor = itens
    .map((i) => ({ valor: valorDe(i), posicao: posicaoDe(i) }))
    .filter((x): x is { valor: number; posicao: number } => typeof x.valor === 'number')
    .sort((a, b) => a.posicao - b.posicao)

  // Um ponto só não tem variação — e inventar "+0" seria afirmar algo que não
  // se sabe. A tela mostra o valor e cala sobre o delta.
  if (comValor.length < 2) return null

  const primeiro = comValor[0]
  const ultimo = comValor[comValor.length - 1]
  return { valor: ultimo.valor - primeiro.valor, de: primeiro.posicao, ate: ultimo.posicao }
}

/** Os exames cuja data cai dentro do período. */
export function anexosDoPeriodo<E extends { dataExame: string }>(
  exames: E[],
  periodo: { dataInicio: string | null; dataFim: string | null },
  folgaDias = 7,
): E[] {
  if (!periodo.dataInicio || !periodo.dataFim) return []
  // A folga existe porque o exame quase nunca é no dia da consulta: ele é
  // colhido antes e levado nela. Sem ela, o anexo aparece órfão de período.
  const de = new Date(periodo.dataInicio).getTime() - folgaDias * 86_400_000
  const ate = new Date(periodo.dataFim).getTime() + folgaDias * 86_400_000

  return exames.filter((e) => {
    const t = new Date(e.dataExame).getTime()
    return !Number.isNaN(t) && t >= de && t <= ate
  })
}
