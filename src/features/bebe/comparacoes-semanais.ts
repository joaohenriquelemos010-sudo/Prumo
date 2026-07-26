/**
 * Week-by-week size comparisons.
 *
 * Sizes follow the usual obstetric references (crown-rump length up to ~13 weeks,
 * crown-heel after that, with Hadlock's median estimated weight). The fruit is
 * the part that makes it land: "356 gramas" is a number, "uma manga" is a thing
 * you have held.
 */

export interface ComparacaoSemanal {
  semana: number
  objeto: string
  emoji: string
  /** Comprimento aproximado em centímetros. */
  cm: number
  /** Peso aproximado em gramas (mediana). */
  g: number
  /** O que está acontecendo nesta semana, em uma frase. */
  acontecendo: string
}

export const COMPARACOES: ComparacaoSemanal[] = [
  { semana: 6, objeto: 'uma lentilha', emoji: '🫘', cm: 0.5, g: 1, acontecendo: 'O coração começa a bater.' },
  { semana: 8, objeto: 'uma framboesa', emoji: '🫐', cm: 1.6, g: 1, acontecendo: 'Bracinhos e perninhas estão se formando.' },
  { semana: 10, objeto: 'uma ameixa', emoji: '🫒', cm: 3.1, g: 4, acontecendo: 'Os dedinhos já se separaram.' },
  { semana: 12, objeto: 'um limão', emoji: '🍋', cm: 5.4, g: 14, acontecendo: 'Já tem unhas e reflexos.' },
  { semana: 14, objeto: 'um pêssego', emoji: '🍑', cm: 8.7, g: 93, acontecendo: 'Faz caretas e franze a testa.' },
  { semana: 16, objeto: 'um abacate', emoji: '🥑', cm: 11.6, g: 146, acontecendo: 'Começa a ouvir sua voz.' },
  { semana: 18, objeto: 'um pimentão', emoji: '🫑', cm: 14.2, g: 223, acontecendo: 'Se mexe bastante — talvez você já sinta.' },
  { semana: 20, objeto: 'uma banana', emoji: '🍌', cm: 25.6, g: 331, acontecendo: 'Metade do caminho. É a semana da morfológica.' },
  { semana: 22, objeto: 'uma manga', emoji: '🥭', cm: 27.8, g: 478, acontecendo: 'Já tem sobrancelhas e cílios.' },
  { semana: 24, objeto: 'uma espiga de milho', emoji: '🌽', cm: 30, g: 670, acontecendo: 'Os pulmões estão amadurecendo.' },
  { semana: 26, objeto: 'uma alface', emoji: '🥬', cm: 35.6, g: 913, acontecendo: 'Abre os olhinhos pela primeira vez.' },
  { semana: 28, objeto: 'uma berinjela', emoji: '🍆', cm: 37.6, g: 1210, acontecendo: 'Começa a sonhar — já tem sono REM.' },
  { semana: 30, objeto: 'um repolho', emoji: '🥬', cm: 39.9, g: 1559, acontecendo: 'Ganha peso rápido a partir de agora.' },
  { semana: 32, objeto: 'um coco', emoji: '🥥', cm: 42.4, g: 1953, acontecendo: 'Já treina respirar.' },
  { semana: 34, objeto: 'um melão cantaloupe', emoji: '🍈', cm: 45, g: 2377, acontecendo: 'A pele está mais lisinha e rosada.' },
  { semana: 36, objeto: 'uma alface romana', emoji: '🥗', cm: 47.4, g: 2813, acontecendo: 'Costuma se virar de cabeça para baixo.' },
  { semana: 38, objeto: 'um alho-poró', emoji: '🌿', cm: 49.8, g: 3236, acontecendo: 'Já é considerado a termo em breve.' },
  { semana: 40, objeto: 'uma abóbora pequena', emoji: '🎃', cm: 51.2, g: 3619, acontecendo: 'Pronto para nascer a qualquer momento.' },
]

/** The comparison for a week — the closest one at or before it. */
export function comparacaoDaSemana(semana: number): ComparacaoSemanal | null {
  const candidatas = COMPARACOES.filter((c) => c.semana <= semana)
  return candidatas[candidatas.length - 1] ?? COMPARACOES[0] ?? null
}

/** How far along, 0–1, for the growth animation. */
export function progressoGestacional(semana: number): number {
  return Math.max(0, Math.min(1, (semana - 6) / (40 - 6)))
}
