import type { Agendamento } from './agenda'
import { OBJETIVO_LABEL, MODALIDADE_LABEL } from './agenda'

/**
 * Builds a calendar file for one appointment, so it lands in the phone's own
 * calendar with its own reminder. The product has no notification channel yet;
 * this is the honest way to make sure nobody misses a consultation because they
 * only remembered to open the app.
 *
 * Hand-rolled rather than pulled from a library: iCalendar is a small format and
 * this project keeps its dependency list short on purpose.
 */

function paraUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** RFC 5545: escape the delimiters, then fold lines at 75 octets. */
function escapar(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function dobrar(linha: string): string {
  if (linha.length <= 75) return linha
  const partes: string[] = [linha.slice(0, 75)]
  let resto = linha.slice(75)
  while (resto.length > 74) {
    partes.push(` ${resto.slice(0, 74)}`)
    resto = resto.slice(74)
  }
  if (resto) partes.push(` ${resto}`)
  return partes.join('\r\n')
}

export function montarIcs(a: Agendamento): string {
  const titulo = `${OBJETIVO_LABEL[a.objetivo]} · ${a.profissionalNome}`
  const descricao = [
    `${OBJETIVO_LABEL[a.objetivo]} com ${a.profissionalNome}.`,
    `Modalidade: ${MODALIDADE_LABEL[a.modalidade]}.`,
    a.convenio ? `Plano informado: ${a.convenio}.` : '',
    a.mensagem ? `Observação: ${a.mensagem}` : '',
    'Agendado pela Prumo.',
  ]
    .filter(Boolean)
    .join('\n')

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prumo//Agenda//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.id}@prumo.app`,
    `DTSTAMP:${paraUtc(new Date().toISOString())}`,
    `DTSTART:${paraUtc(a.inicio)}`,
    `DTEND:${paraUtc(a.fim)}`,
    `SUMMARY:${escapar(titulo)}`,
    `DESCRIPTION:${escapar(descricao)}`,
    a.local ? `LOCATION:${escapar(a.local)}` : '',
    `STATUS:${a.status === 'confirmado' ? 'CONFIRMED' : 'TENTATIVE'}`,
    // A nudge the evening before — the reminder people actually want.
    'BEGIN:VALARM',
    'TRIGGER:-PT12H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapar(titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return linhas.map(dobrar).join('\r\n')
}

/** Triggers the download. Named after the appointment so the file is findable. */
export function baixarIcs(a: Agendamento): void {
  const blob = new Blob([montarIcs(a)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `prumo-${a.objetivo}-${a.inicio.slice(0, 10)}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
