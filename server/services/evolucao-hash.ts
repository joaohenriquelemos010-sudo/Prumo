import { createHash } from 'node:crypto'

/**
 * A parte pura da cadeia de evoluções: como um elo é calculado.
 *
 * Separada do serviço porque é o coração da propriedade que estamos prometendo
 * (adulteração detectável) e porque assim ela é testável sem banco, sem relógio
 * e sem sessão — o mesmo formato de `services/slots.ts`.
 */

export interface CorpoDaEvolucao {
  jornada: string
  ordem: number
  tipo: string
  autorId: string
  em: string
  texto: string
  estruturado: unknown
  visibilidade: string
  origem: string
}

/**
 * JSON canônico: chaves ordenadas, recursivamente.
 *
 * Sem isto o hash dependeria da ordem em que as chaves aparecem no objeto, que
 * varia com a versão do driver e com a ordem de atribuição. Um documento
 * idêntico produziria hashes diferentes e a cadeia quebraria sozinha — pior que
 * não ter cadeia nenhuma, porque acusaria adulteração onde não houve.
 */
export function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'null'
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`
  if (valor instanceof Date) return JSON.stringify(valor.toISOString())

  const entradas = Object.keys(valor as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${jsonCanonico((valor as Record<string, unknown>)[k])}`)
  return `{${entradas.join(',')}}`
}

/**
 * O elo: hash do anterior concatenado ao corpo canônico deste.
 *
 * Encadear pelo hash anterior é o que torna a cadeia detectável em vez de só
 * verificável por item: mudar a entrada 3 invalida 3 e **todas** depois dela, o
 * que impede reescrever um trecho do meio e recalcular só ele.
 */
export function calcularHash(hashAnterior: string, corpo: CorpoDaEvolucao): string {
  return createHash('sha256')
    .update(hashAnterior)
    .update(jsonCanonico(corpo))
    .digest('hex')
}

/**
 * Percorre uma cadeia já materializada e devolve o índice do primeiro elo
 * quebrado, ou `null` se está íntegra.
 *
 * Recebe a lista pronta (nada de I/O aqui) para que o mesmo código sirva à rota
 * de integridade e ao teste.
 */
export function primeiroEloQuebrado(
  cadeia: { hash: string; hashAnterior: string; corpo: CorpoDaEvolucao }[],
): number | null {
  let anterior = ''
  for (let i = 0; i < cadeia.length; i++) {
    const elo = cadeia[i]!
    if (elo.hashAnterior !== anterior) return i
    if (elo.hash !== calcularHash(anterior, elo.corpo)) return i
    anterior = elo.hash
  }
  return null
}
