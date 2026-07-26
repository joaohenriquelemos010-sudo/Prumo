/**
 * Timezone plumbing for the agenda.
 *
 * Appointments are stored as real UTC instants. Availability rules, though, are
 * written the way a clinic thinks: "Tuesdays, 09:00 to 12:00" — wall-clock time
 * in the clinic's zone. Converting between the two is where scheduling code
 * usually rots, so every conversion in the product goes through this file.
 *
 * Brazil dropped DST in 2019, so today São Paulo is a flat -03:00. The offset is
 * still resolved per-instant rather than hardcoded: the rules outlive the policy,
 * and other zones may follow later.
 */

export const ZONA_PADRAO = 'America/Sao_Paulo'

/** Minutes the zone is ahead of UTC at a given instant (São Paulo → -180). */
function offsetMinutos(zona: string, instante: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p: Record<string, number> = {}
  for (const parte of dtf.formatToParts(instante)) {
    if (parte.type !== 'literal') p[parte.type] = Number(parte.value)
  }
  // `Intl` renders midnight as hour 24 in some engines; normalise it.
  const hora = p.hour === 24 ? 0 : p.hour
  const relogioLocal = Date.UTC(p.year, p.month - 1, p.day, hora, p.minute, p.second)
  return (relogioLocal - instante.getTime()) / 60_000
}

/** The wall clock in `zona`, as plain numbers. */
export function partesNaZona(
  instante: Date,
  zona = ZONA_PADRAO,
): { ano: number; mes: number; dia: number; hora: number; minuto: number; diaSemana: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const parte of dtf.formatToParts(instante)) {
    if (parte.type !== 'literal') p[parte.type] = parte.value
  }
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  const hora = Number(p.hour) === 24 ? 0 : Number(p.hour)
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora,
    minuto: Number(p.minute),
    diaSemana: semana,
  }
}

/**
 * Turns a wall-clock moment in `zona` into the UTC instant it names.
 * Resolved twice so a reading taken on one side of a DST shift still lands right.
 */
export function zonaParaUtc(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  zona = ZONA_PADRAO,
): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto)
  let instante = new Date(palpite - offsetMinutos(zona, new Date(palpite)) * 60_000)
  instante = new Date(palpite - offsetMinutos(zona, instante) * 60_000)
  return instante
}

/** 'YYYY-MM-DD' as seen in `zona` — the key for grouping a day's slots. */
export function chaveDia(instante: Date, zona = ZONA_PADRAO): string {
  const { ano, mes, dia } = partesNaZona(instante, zona)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Day of week in `zona`, 0 = Sunday — matches `Disponibilidade.regras.diaSemana`. */
export function diaSemanaNaZona(instante: Date, zona = ZONA_PADRAO): number {
  return partesNaZona(instante, zona).diaSemana
}

/** 'HH:MM' as seen in `zona`. */
export function horaNaZona(instante: Date, zona = ZONA_PADRAO): string {
  const { hora, minuto } = partesNaZona(instante, zona)
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

/** 'HH:MM' → minutes since midnight. Returns null when malformed. */
export function minutosDoDia(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Parses 'YYYY-MM-DD' into its parts, or null when malformed. */
export function partesDaData(iso: string): { ano: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { ano, mes, dia }
}

/** Adds whole days to a 'YYYY-MM-DD' key, staying on the calendar grid. */
export function somarDias(chave: string, dias: number): string {
  const partes = partesDaData(chave)
  if (!partes) return chave
  const d = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia))
  d.setUTCDate(d.getUTCDate() + dias)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Day of week for a 'YYYY-MM-DD' key, 0 = Sunday. */
export function diaSemanaDaChave(chave: string): number {
  const partes = partesDaData(chave)
  if (!partes) return 0
  return new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia)).getUTCDay()
}
