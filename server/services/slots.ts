import {
  ZONA_PADRAO,
  chaveDia,
  diaSemanaDaChave,
  minutosDoDia,
  partesDaData,
  somarDias,
  zonaParaUtc,
} from './fuso.js'

/**
 * Expands weekly availability rules into concrete, bookable slots.
 *
 * Pure on purpose: no database, no clock of its own. The routes hand it the
 * doctor's rules, the appointments already on the books and "now", and it answers
 * with what is actually free. The same function decides what the family sees and
 * whether a booking is allowed — so the list can never disagree with the check.
 */

export interface RegraDisponibilidade {
  diaSemana: number
  inicio: string
  fim: string
  modalidades: string[]
  local?: string
}

export interface BloqueioDisponibilidade {
  de: Date
  ate: Date
}

export interface ConfigDisponibilidade {
  ativo: boolean
  duracaoPadraoMin: number
  antecedenciaMinHoras: number
  janelaMaxDias: number
  fuso: string
  regras: RegraDisponibilidade[]
  bloqueios: BloqueioDisponibilidade[]
}

export interface IntervaloOcupado {
  inicio: Date
  duracaoMin: number
}

export interface Slot {
  /** UTC instant, ISO — what the client posts back to book. */
  inicio: string
  duracaoMin: number
  modalidades: string[]
  local: string
}

export interface DiaComSlots {
  /** 'YYYY-MM-DD' in the clinic's timezone. */
  dia: string
  slots: Slot[]
}

const MINUTO = 60_000

function seSobrepoe(aInicio: number, aFim: number, bInicio: number, bFim: number): boolean {
  return aInicio < bFim && bInicio < aFim
}

/**
 * Free slots between two calendar days, inclusive, grouped by day.
 *
 * `de` and `ate` are 'YYYY-MM-DD' in the clinic's zone. A slot survives only if
 * it clears every guard: inside a rule's window, not inside a block, far enough
 * ahead to respect the notice period, within the open booking horizon, and not
 * overlapping an appointment that already holds the time.
 */
export function expandirSlots(
  config: ConfigDisponibilidade,
  de: string,
  ate: string,
  ocupados: IntervaloOcupado[],
  agora: Date = new Date(),
): DiaComSlots[] {
  if (!config.ativo || config.regras.length === 0) return []
  if (!partesDaData(de) || !partesDaData(ate)) return []

  const zona = config.fuso || ZONA_PADRAO
  const duracao = config.duracaoPadraoMin
  const naoAntesDe = agora.getTime() + config.antecedenciaMinHoras * 60 * MINUTO
  const naoDepoisDe = agora.getTime() + config.janelaMaxDias * 24 * 60 * MINUTO

  const janelasOcupadas = ocupados.map((o) => ({
    inicio: o.inicio.getTime(),
    fim: o.inicio.getTime() + o.duracaoMin * MINUTO,
  }))
  const bloqueios = config.bloqueios.map((b) => ({
    inicio: new Date(b.de).getTime(),
    fim: new Date(b.ate).getTime(),
  }))

  const dias: DiaComSlots[] = []
  // A hard stop so a malformed range can never spin: the horizon is the limit.
  const maxDias = Math.min(config.janelaMaxDias + 1, 366)

  let chave = de
  for (let i = 0; i < maxDias && chave <= ate; i++, chave = somarDias(chave, 1)) {
    const partes = partesDaData(chave)
    if (!partes) break
    const diaSemana = diaSemanaDaChave(chave)
    const slots: Slot[] = []

    for (const regra of config.regras) {
      if (regra.diaSemana !== diaSemana) continue
      const inicioMin = minutosDoDia(regra.inicio)
      const fimMin = minutosDoDia(regra.fim)
      if (inicioMin === null || fimMin === null || fimMin <= inicioMin) continue

      for (let m = inicioMin; m + duracao <= fimMin; m += duracao) {
        const inicio = zonaParaUtc(partes.ano, partes.mes, partes.dia, Math.floor(m / 60), m % 60, zona)
        const t = inicio.getTime()
        const fim = t + duracao * MINUTO

        if (t < naoAntesDe || t > naoDepoisDe) continue
        if (bloqueios.some((b) => seSobrepoe(t, fim, b.inicio, b.fim))) continue
        if (janelasOcupadas.some((o) => seSobrepoe(t, fim, o.inicio, o.fim))) continue

        slots.push({
          inicio: inicio.toISOString(),
          duracaoMin: duracao,
          modalidades: regra.modalidades.length > 0 ? regra.modalidades : ['presencial'],
          local: regra.local ?? '',
        })
      }
    }

    if (slots.length > 0) {
      slots.sort((a, b) => a.inicio.localeCompare(b.inicio))
      dias.push({ dia: chave, slots })
    }
  }

  return dias
}

/**
 * Whether one specific instant is bookable. The booking route asks this instead
 * of trusting the slot the client sends back — the list it was picked from may
 * be seconds stale, and two people can want the same 09:00.
 */
export function slotDisponivel(
  config: ConfigDisponibilidade,
  inicio: Date,
  ocupados: IntervaloOcupado[],
  agora: Date = new Date(),
): boolean {
  const dia = chaveDia(inicio, config.fuso || ZONA_PADRAO)
  const dias = expandirSlots(config, dia, dia, ocupados, agora)
  const alvo = inicio.toISOString()
  return dias.some((d) => d.slots.some((s) => s.inicio === alvo))
}
