import type { Programa } from './tipos.js'
import { maternoInfantil } from './materno-infantil.js'

export type { Programa, FasePrograma, VocabularioPrograma } from './tipos.js'

/**
 * Registro de programas.
 *
 * Um programa novo entra aqui e em lugar nenhum mais. É esse o contrato: se
 * adicionar uma especialidade exigir tocar um model, uma rota ou uma migração,
 * a costura falhou e vale consertar a costura em vez de contornar.
 */
export const REGISTRO: Record<string, Programa> = {
  [maternoInfantil.id]: maternoInfantil,
}

export const PROGRAMA_PADRAO = maternoInfantil.id

/** Sempre devolve um programa — um id desconhecido cai no padrão em vez de quebrar. */
export function programaPorId(id?: string | null): Programa {
  return REGISTRO[id ?? ''] ?? REGISTRO[PROGRAMA_PADRAO]!
}

/** A fase ativa de uma jornada, ou null se nenhuma casar. */
export function faseAtiva(programa: Programa, jornada: Record<string, unknown>) {
  return programa.fases.find((f) => f.ativaQuando(jornada)) ?? null
}
