import type { Convenio } from '@/lib/stores/perfil'

/**
 * Health plans ("convênios") — the patient side of the marketplace filter.
 *
 * The `Prestador` model always carried a `convenios` array, but nothing ever
 * showed it and the family had nowhere to say which plan they carry. This module
 * is the shared vocabulary for both ends: the list to pick from, and the single
 * rule that decides whether a professional serves a given plan.
 */

export const OPERADORAS = [
  'Amil',
  'Bradesco Saúde',
  'Golden Cross',
  'Hapvida NotreDame Intermédica',
  'Porto Seguro Saúde',
  'Prevent Senior',
  'São Cristóvão Saúde',
  'SulAmérica',
  'Unimed',
] as const

export const TIPOS_COBERTURA = ['convenio', 'particular', 'sus'] as const
export type TipoCobertura = (typeof TIPOS_COBERTURA)[number]

export const TIPO_LABEL: Record<TipoCobertura, string> = {
  convenio: 'Plano de saúde',
  particular: 'Particular',
  sus: 'SUS',
}

/** What a professional advertises, from either side of the hybrid model. */
export interface CoberturaOfertada {
  convenios: string[]
  atendeSus?: boolean
  atendeParticular?: boolean
}

/**
 * Whether a listing serves this plan.
 *
 * `'Vários'` is what the seeded lab chains carry — it means "most plans", so it
 * matches any named operator rather than none. Being generous here is the right
 * failure mode: the chip says "atende seu plano", and the booking screen still
 * tells the family to confirm with the operator.
 */
export function atendeConvenio(oferta: CoberturaOfertada, convenio: Convenio): boolean {
  if (convenio.tipo === 'sus') return oferta.atendeSus === true
  if (convenio.tipo === 'particular') return oferta.atendeParticular !== false

  const alvo = (convenio.operadora ?? '').trim().toLowerCase()
  if (!alvo) return true
  return (oferta.convenios ?? []).some((c) => {
    const nome = c.trim().toLowerCase()
    return nome === alvo || nome === 'vários' || nome === 'varios'
  })
}

/** "pelo SUS" / "particular" / "Unimed" — reads naturally after "atende…". */
export function rotuloConvenio(convenio: Convenio): string {
  if (convenio.tipo === 'sus') return 'pelo SUS'
  if (convenio.tipo === 'particular') return 'particular'
  return convenio.operadora || 'seu plano'
}

/** The value pre-filled into the booking form's free-text plan field. */
export function convenioParaTexto(convenio: Convenio): string {
  if (convenio.tipo === 'sus') return 'SUS'
  if (convenio.tipo === 'particular') return 'Particular'
  return convenio.operadora ?? ''
}

/** "Unimed · Plano Alfa" for the profile summary. */
export function descreverConvenio(convenio: Convenio): string {
  if (convenio.tipo === 'sus') return 'SUS'
  if (convenio.tipo === 'particular') return 'Particular'
  return [convenio.operadora, convenio.plano].filter(Boolean).join(' · ') || 'Plano de saúde'
}
