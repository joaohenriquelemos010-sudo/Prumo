import type { Checkin, Fase } from '@/features/bebe/tipos'

/**
 * Períodos seguidos com check-in, contando de trás para frente a partir do atual.
 *
 * Morava dentro de `AppBebe.tsx` e o checklist precisava da mesma conta — duas
 * cópias de uma regra de sequência divergem em silêncio, e "quantas semanas
 * seguidas" passa a responder duas coisas na mesma tela.
 *
 * A contagem para no primeiro buraco de propósito. Uma sequência que ignora
 * falhas não é uma sequência; é um contador de visitas com nome bonito, e a
 * pessoa percebe.
 */
export function calcularSequencia(checkins: Checkin[], fase: Fase, atual: number): number {
  const feitas = new Set(checkins.filter((c) => c.fase === fase).map((c) => c.periodo))
  let n = 0
  for (let p = atual; p >= 0; p--) {
    if (!feitas.has(p)) break
    n++
  }
  return n
}
