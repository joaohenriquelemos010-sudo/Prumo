import { VACINAS_CRIANCA } from './sus-vacinas'
import type { VacinaPNI } from './sus-vacinas'

/**
 * Turns a birth date + the applied-dose list into a real, dated schedule, and a
 * due-date (DPP) into a gestational age. Pure functions — no side effects — so
 * the same logic feeds the agenda, the vaccine card and any future PDF.
 */

const DAY = 24 * 60 * 60 * 1000

export type DoseStatus = 'aplicada' | 'atrasada' | 'proxima' | 'futura'

export interface DoseAgendada {
  vacina: VacinaPNI
  data: Date
  status: DoseStatus
}

export function addMonths(base: Date, months: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + months)
  return d
}

export function idadeEmMeses(dataNascimento: Date, agora = new Date()): number {
  const anos = agora.getFullYear() - dataNascimento.getFullYear()
  const meses = agora.getMonth() - dataNascimento.getMonth()
  const totalMeses = anos * 12 + meses
  return agora.getDate() < dataNascimento.getDate() ? totalMeses - 1 : totalMeses
}

/** Vaccine doses with real dates + status, sorted by date. */
export function calcularDosesVacinas(
  dataNascimento: Date,
  aplicadas: string[],
  agora = new Date(),
): DoseAgendada[] {
  const feitas = new Set(aplicadas)
  const proximaJanela = 30 * DAY

  return VACINAS_CRIANCA.map((vacina): DoseAgendada => {
    const data = addMonths(dataNascimento, vacina.idadeMeses)
    let status: DoseStatus
    if (feitas.has(vacina.id)) status = 'aplicada'
    else if (data.getTime() < agora.getTime()) status = 'atrasada'
    else if (data.getTime() - agora.getTime() <= proximaJanela) status = 'proxima'
    else status = 'futura'
    return { vacina, data, status }
  }).sort((a, b) => a.data.getTime() - b.data.getTime())
}

/** Gestational age in weeks from the estimated due date (DPP = concepção + ~40s). */
export function semanasGestacionais(dpp: Date, agora = new Date()): number {
  const diasAteDPP = (dpp.getTime() - agora.getTime()) / DAY
  const semanas = 40 - diasAteDPP / 7
  return Math.max(0, Math.min(42, Math.round(semanas)))
}

export interface IdadeGestacional {
  semanas: number
  dias: number
  /** "32 semanas e 4 dias" */
  porExtenso: string
  /** "32s4d" — como aparece no prontuário. */
  curta: string
}

/**
 * Gestational age the way obstetrics actually writes it: weeks AND days.
 *
 * `semanasGestacionais` rounds to whole weeks, which is fine for a trimester
 * banner and wrong for a consultation record — at 33s6d versus 34s0d the exam
 * schedule and the reference band both change.
 */
export function idadeGestacional(dpp: Date, agora = new Date()): IdadeGestacional {
  const diasTotais = Math.max(0, Math.min(294, 280 - Math.round((dpp.getTime() - agora.getTime()) / DAY)))
  const semanas = Math.floor(diasTotais / 7)
  const dias = diasTotais % 7
  return {
    semanas,
    dias,
    porExtenso: `${semanas} ${semanas === 1 ? 'semana' : 'semanas'}${dias ? ` e ${dias} ${dias === 1 ? 'dia' : 'dias'}` : ''}`,
    curta: `${semanas}s${dias}d`,
  }
}

/**
 * Estimated due date from the last menstrual period (Naegele: DUM + 280 days).
 *
 * The app only ever asked for the DPP directly, which assumes someone already did
 * this sum — usually the person who has the DUM written in a notebook. Deriving it
 * here means the family can enter what they actually know.
 */
export function dppPelaDum(dum: Date): Date {
  return new Date(dum.getTime() + 280 * DAY)
}

export function trimestreAtual(semanas: number): 1 | 2 | 3 {
  if (semanas <= 13) return 1
  if (semanas <= 27) return 2
  return 3
}

export function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
