/**
 * Dinheiro, no cliente.
 *
 * ## Por que é uma cópia de `server/services/financeiro.ts`
 *
 * O split `tsconfig.app` / `tsconfig.server` e os sufixos `.js` do ESM do
 * servidor tornam o compartilhamento caro — a mesma razão pela qual o registro
 * de programas é espelhado em vez de importado. Trinta linhas duplicadas custam
 * menos que a plumbing, **desde que não divirjam**: `dinheiro.test.ts` compara
 * as duas implementações caso a caso, e falha se alguém mexer em uma só.
 */

/** Centavos → "R$ 1.234,56". */
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
 * A regra que desempata `1.500` (mil e quinhentos ou um e cinquenta?): **um
 * separador seguido de exatamente três dígitos, sem outro separador, é milhar.**
 * Moeda brasileira não tem três casas decimais, então a leitura é inequívoca — e
 * errar aqui cobraria R$ 1,50 por uma consulta de R$ 1.500, sem dar erro nenhum.
 *
 * A conta é feita em string porque `Number('1234.56') * 100` dá
 * `123455.99999999999`.
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
    decimal = ultimaVirgula > ultimoPonto ? ',' : '.'
  } else {
    const posicao = Math.max(ultimaVirgula, ultimoPonto)
    if (posicao >= 0) {
      const depois = limpo.length - posicao - 1
      decimal = depois === 3 ? '' : limpo[posicao]
    }
  }

  if (!decimal) return Number(limpo.replace(/\D/g, '') || '0') * 100

  const corte = limpo.lastIndexOf(decimal)
  const digitosInteiro = limpo.slice(0, corte).replace(/\D/g, '')
  const digitosFracao = limpo
    .slice(corte + 1)
    .replace(/\D/g, '')
    .padEnd(2, '0')
    .slice(0, 2)

  return Number(digitosInteiro || '0') * 100 + Number(digitosFracao || '0')
}

export const FORMAS: { id: string; rotulo: string }[] = [
  { id: 'pix', rotulo: 'Pix' },
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'cartao-credito', rotulo: 'Cartão de crédito' },
  { id: 'cartao-debito', rotulo: 'Cartão de débito' },
  { id: 'transferencia', rotulo: 'Transferência' },
  { id: 'convenio', rotulo: 'Convênio' },
  { id: 'outro', rotulo: 'Outro' },
]

export function rotuloDaForma(id: string): string {
  return FORMAS.find((f) => f.id === id)?.rotulo ?? id
}

/** "2026-03" → "março de 2026". */
export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  if (!ano || !mes) return competencia
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}
