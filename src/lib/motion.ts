import { useReducedMotion } from 'framer-motion'
import type { Transition } from 'framer-motion'

/**
 * A física do Prumo.
 *
 * Uma interface parece viva quando o movimento começa do valor que está na tela,
 * herda a velocidade do dedo, projeta o momento para a frente, e pode ser
 * agarrado e revertido a qualquer instante. Molas são a ferramenta que torna isso
 * natural, porque são inerentemente interrompíveis e cientes de velocidade —
 * `transition` do CSS e `@keyframes` não são, e por isso não aparecem em nada que
 * o usuário possa tocar.
 *
 * Os quatro presets abaixo são o vocabulário inteiro. Se um componente precisa de
 * um quinto, quase sempre a resposta certa é um dos quatro.
 */

/**
 * Amortecimento crítico (sem overshoot) é o padrão. Bounce só entra quando o
 * gesto **carregou momento** — um flick, um arraste solto. Overshoot num menu que
 * só apareceu parece errado; overshoot num cartão que você jogou parece certo.
 */
export const molas = {
  /** Cartões, layout, reposicionamento. O padrão para quase tudo. */
  suave: { type: 'spring', stiffness: 210, damping: 26, mass: 0.9 },
  /** Toggles, chips, pílula de seleção. Mais curto, ainda sem oscilar. */
  firme: { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 },
  /** Feedback de toque. Tem que fechar antes de a pessoa perceber que esperou. */
  rapida: { type: 'spring', stiffness: 520, damping: 38, mass: 0.6 },
  /** Sheets e gavetas — massa um pouco maior, porque a superfície é grande. */
  folha: { type: 'spring', stiffness: 260, damping: 30, mass: 1 },
} satisfies Record<string, Transition>

export type NomeMola = keyof typeof molas

/**
 * Movimento reduzido não significa *nenhum* feedback — significa um equivalente
 * mais gentil e não-vestibular. Este hook centraliza a decisão para que nenhum
 * componente precise lembrar de checar.
 *
 * `mola()` devolve uma transição instantânea quando o usuário pediu menos
 * movimento; `ativo` deixa o componente trocar um slide por um cross-fade.
 */
export function useMovimento() {
  const reduzir = Boolean(useReducedMotion())

  return {
    ativo: !reduzir,
    mola(nome: NomeMola = 'suave'): Transition {
      return reduzir ? { duration: 0 } : molas[nome]
    },
    /** Para o que ainda faz sentido com duração: cross-fades e opacidade. */
    duracao(segundos: number): Transition {
      return { duration: reduzir ? 0 : segundos }
    },
  }
}

/**
 * Projeção de momento — para onde o gesto **estava indo**.
 *
 * Não use a distância no ponto em que o dedo soltou; use a velocidade para
 * projetar a posição de repouso, exatamente como a desaceleração do scroll, e
 * então escolha o alvo mais próximo desse ponto projetado. É isso que faz um
 * flick parecer que *arremessa* o elemento.
 *
 * Esta é a função de projeção da Apple (do sample code de *Designing Fluid
 * Interfaces*), não a `v²/(2·a)` do livro-texto — a forma de decaimento
 * exponencial é a que casa com o que o iOS realmente faz.
 *
 * @param velocidade px/s no momento em que soltou
 * @param desaceleracao 0.998 dá a sensação normal de scroll; 0.99 é mais seco
 */
export function projetarMomento(velocidade: number, desaceleracao = 0.998): number {
  return ((velocidade / 1000) * desaceleracao) / (1 - desaceleracao)
}

/**
 * Rubber-band — resistência progressiva além de uma borda.
 *
 * Uma parada dura lê como "travou"; resistência contínua lê como "responde, mas
 * não tem mais nada aqui". Quanto mais longe do limite, menos o elemento segue.
 *
 * @param excesso quanto o dedo passou da borda (px)
 * @param dimensao o tamanho da superfície, que dá a escala
 */
export function elastico(excesso: number, dimensao: number, constante = 0.55): number {
  return (excesso * dimensao * constante) / (dimensao + constante * Math.abs(excesso))
}

/**
 * O ponto de encaixe mais próximo de um valor. Use com `projetarMomento` — nunca
 * com a posição crua de soltura.
 */
export function encaixeMaisProximo(valor: number, pontos: number[]): number {
  return pontos.reduce((melhor, p) =>
    Math.abs(p - valor) < Math.abs(melhor - valor) ? p : melhor,
  )
}
