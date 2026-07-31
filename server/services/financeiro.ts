import type { EstadoRecebimento, FormaPagamento } from '../models/Recebimento.js'

/**
 * O relatório mensal, como aritmética pura.
 *
 * Sem banco e sem relógio — mesma forma de `slots.ts`, e pelo mesmo motivo: é o
 * módulo em que um erro não quebra nada visível, só produz um número errado. E
 * um relatório financeiro que fecha com dois centavos de diferença destrói a
 * confiança no sistema inteiro, porque a pessoa passa a conferir tudo à mão.
 */

export interface LinhaFinanceira {
  valorCentavos: number
  forma: FormaPagamento | string
  convenio?: string
  estado: EstadoRecebimento | string
  dataAtendimento: string
  recebidoEm?: string | null
}

export interface Resumo {
  /** Já entrou. */
  recebidoCentavos: number
  /** Prometido e ainda não pago. */
  previstoCentavos: number
  /** Recebido + previsto. O que o mês vale se tudo for pago. */
  totalCentavos: number
  atendimentos: number
  /** Quanto cada forma trouxe, só do que foi recebido. */
  porForma: { forma: string; centavos: number; atendimentos: number }[]
  /** Particular vs. convênio — a divisão que a obstetra realmente acompanha. */
  particularCentavos: number
  convenioCentavos: number
  /** Ticket médio do recebido. Zero atendimentos não vira divisão por zero. */
  ticketMedioCentavos: number
}

/**
 * Convênio é uma **forma de pagamento**, e não um campo separado.
 *
 * Foi uma decisão: modelar "particular ou convênio" como um booleano ao lado da
 * forma criaria dois lugares para dizer a mesma coisa, e eles divergiriam no
 * primeiro registro editado pela metade.
 */
export function ehConvenio(forma: string): boolean {
  return forma === 'convenio'
}

export function resumir(linhas: LinhaFinanceira[]): Resumo {
  // Cancelado não conta em lugar nenhum: ele existe para o histórico, não para
  // a soma. Somá-lo em "previsto" faria o mês parecer maior do que é.
  const validas = linhas.filter((l) => l.estado !== 'cancelado')
  const recebidas = validas.filter((l) => l.estado === 'recebido')

  const somar = (ls: LinhaFinanceira[]) => ls.reduce((t, l) => t + Math.round(l.valorCentavos), 0)

  const recebidoCentavos = somar(recebidas)
  const previstoCentavos = somar(validas.filter((l) => l.estado === 'previsto'))

  const porFormaMapa = new Map<string, { centavos: number; atendimentos: number }>()
  for (const l of recebidas) {
    const atual = porFormaMapa.get(l.forma) ?? { centavos: 0, atendimentos: 0 }
    atual.centavos += Math.round(l.valorCentavos)
    atual.atendimentos += 1
    porFormaMapa.set(l.forma, atual)
  }

  const porForma = [...porFormaMapa.entries()]
    .map(([forma, v]) => ({ forma, ...v }))
    .sort((a, b) => b.centavos - a.centavos)

  const convenioCentavos = somar(recebidas.filter((l) => ehConvenio(l.forma)))

  return {
    recebidoCentavos,
    previstoCentavos,
    totalCentavos: recebidoCentavos + previstoCentavos,
    atendimentos: validas.length,
    porForma,
    particularCentavos: recebidoCentavos - convenioCentavos,
    convenioCentavos,
    ticketMedioCentavos:
      recebidas.length > 0 ? Math.round(recebidoCentavos / recebidas.length) : 0,
  }
}

/**
 * Centavos → "R$ 1.234,56".
 *
 * Formatar no servidor **e** no cliente seria duas verdades; esta função existe
 * para o PDF e para o relatório, e o cliente importa a dele de `src/lib`. O
 * teste garante que as duas concordam.
 */
export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

/**
 * "1.234,56", "1234.56", "R$ 1.500" → centavos.
 *
 * ## A ambiguidade que importa
 *
 * `"1.500"` são mil e quinhentos reais ou um real e cinquenta? As duas leituras
 * são plausíveis, e a diferença entre elas é de mil vezes — cobrar R$ 1,50 por
 * uma consulta de R$ 1.500 é o pior erro que este arquivo pode cometer, e ele
 * não daria erro nenhum.
 *
 * A regra que desempata: **um separador seguido de exatamente três dígitos, sem
 * outro separador depois, é separador de milhar.** Funciona porque moeda
 * brasileira não tem três casas decimais — "1,500" nunca quer dizer um e meio
 * escrito com zero sobrando, e "1.500" é como se escreve mil e quinhentos.
 *
 * Havendo dois separadores diferentes, o **último** é o decimal: `1.234,56` e
 * `1,234.56` chegam os dois em 123456.
 *
 * ## Por que a conta é feita em string
 *
 * `Number('1234.56') * 100` dá `123455.99999999999`. Arredondar isso na hora
 * errada é como um centavo some por atendimento e o mês fecha com diferença —
 * o tipo de defeito que faz a pessoa parar de confiar no relatório e conferir
 * tudo à mão.
 */
export function paraCentavos(entrada: string | number): number {
  if (typeof entrada === 'number') return Math.round(entrada * 100)

  const limpo = entrada.replace(/[^\d,.]/g, '').trim()
  if (!limpo) return 0

  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')
  const temAmbos = ultimaVirgula >= 0 && ultimoPonto >= 0

  let decimal = ''
  if (temAmbos) {
    // Dois separadores: o último é o decimal, o outro é milhar.
    decimal = ultimaVirgula > ultimoPonto ? ',' : '.'
  } else {
    const posicao = Math.max(ultimaVirgula, ultimoPonto)
    if (posicao >= 0) {
      const depois = limpo.length - posicao - 1
      // Três dígitos depois do único separador ⇒ milhar, não decimal.
      decimal = depois === 3 ? '' : limpo[posicao]
    }
  }

  if (!decimal) return Number(limpo.replace(/\D/g, '') || '0') * 100

  const corte = limpo.lastIndexOf(decimal)
  const digitosInteiro = limpo.slice(0, corte).replace(/\D/g, '')
  // Truncar, e não arredondar: cobrar um centavo a mais do que a pessoa digitou
  // é pior do que um a menos.
  const digitosFracao = limpo
    .slice(corte + 1)
    .replace(/\D/g, '')
    .padEnd(2, '0')
    .slice(0, 2)

  return Number(digitosInteiro || '0') * 100 + Number(digitosFracao || '0')
}
