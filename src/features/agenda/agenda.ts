import { MapPin, Video, Home as HomeIcon, FlaskConical, HeartPulse, Baby, Sparkles } from 'lucide-react'

/**
 * Shared vocabulary for the agenda: the shapes the API returns, and the labels
 * and date formatting every screen shows them with. One place, so the patient's
 * agenda, the doctor's day and the admin queue can't drift apart.
 */

export type ObjetivoAgendamento =
  | 'exame'
  | 'consulta-gestante'
  | 'consulta-crianca'
  | 'pre-concepcional'

export type ModalidadeAgendamento = 'presencial' | 'teleconsulta' | 'domiciliar'

export type StatusAgendamento =
  | 'pendente'
  | 'confirmado'
  | 'recusado'
  | 'cancelado'
  | 'realizado'
  | 'faltou'

export interface Agendamento {
  id: string
  origem: 'medico' | 'marketplace'
  medicoId: string
  profissionalNome: string
  prestadorId: string
  pacienteNome: string
  objetivo: ObjetivoAgendamento
  modalidade: ModalidadeAgendamento
  inicio: string
  fim: string
  duracaoMin: number
  local: string
  status: StatusAgendamento
  motivo: string
  mensagem: string
  convenio: string
  consultaId: string
  criadoEm: string
}

export interface Slot {
  inicio: string
  duracaoMin: number
  modalidades: string[]
  local: string
}

export interface DiaComSlots {
  dia: string
  slots: Slot[]
}

export const OBJETIVO_LABEL: Record<ObjetivoAgendamento, string> = {
  exame: 'Exame',
  'consulta-gestante': 'Consulta para você',
  'consulta-crianca': 'Consulta do bebê',
  'pre-concepcional': 'Consulta pré-concepcional',
}

export const OBJETIVO_ICON: Record<ObjetivoAgendamento, typeof FlaskConical> = {
  exame: FlaskConical,
  'consulta-gestante': HeartPulse,
  'consulta-crianca': Baby,
  'pre-concepcional': Sparkles,
}

export const MODALIDADE_LABEL: Record<ModalidadeAgendamento, string> = {
  presencial: 'Presencial',
  teleconsulta: 'Teleconsulta',
  domiciliar: 'Em casa',
}

export const MODALIDADE_ICON: Record<ModalidadeAgendamento, typeof MapPin> = {
  presencial: MapPin,
  teleconsulta: Video,
  domiciliar: HomeIcon,
}

interface EstiloStatus {
  label: string
  /** Chip classes — all theme-safe (see .u-chip-* in styles/index.css). */
  chip: string
  /** What it means, in the family's words. */
  explicacao: string
}

export const STATUS_STYLE: Record<StatusAgendamento, EstiloStatus> = {
  pendente: {
    label: 'Aguardando confirmação',
    chip: 'u-chip-brand',
    explicacao: 'Enviamos seu pedido. Assim que confirmarem, você vê aqui.',
  },
  confirmado: {
    label: 'Confirmado',
    chip: 'u-chip-success',
    explicacao: 'Está marcado! Adicione ao seu calendário para não esquecer.',
  },
  recusado: {
    label: 'Recusado',
    chip: 'u-chip-warn',
    explicacao: 'Esse horário não deu certo. Escolha outro — a agenda continua aberta.',
  },
  cancelado: {
    label: 'Cancelado',
    chip: 'bg-paper-2 text-ink-mute',
    explicacao: 'Este agendamento foi cancelado.',
  },
  realizado: {
    label: 'Realizado',
    chip: 'bg-paper-2 text-ink-soft',
    explicacao: 'Consulta realizada.',
  },
  faltou: {
    label: 'Não compareceu',
    chip: 'u-chip-warn',
    explicacao: 'Registrado como falta. Que tal remarcar?',
  },
}

/** Statuses that still lie ahead — what "Próximos" means. */
export const STATUS_ATIVOS: StatusAgendamento[] = ['pendente', 'confirmado']

export function ehFuturo(a: Agendamento, agora = new Date()): boolean {
  return new Date(a.inicio).getTime() >= agora.getTime()
}

/* ------------------------------ formatting ------------------------------ */

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS_LONGOS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]
export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function dataLonga(iso: string): string {
  const d = new Date(iso)
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export function diaCurto(chave: string): string {
  const d = deChaveDia(chave)
  return DIAS_CURTOS[d.getDay()]
}

/** 'YYYY-MM-DD' → a local Date at midnight (no timezone drift from `new Date(str)`). */
export function deChaveDia(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number)
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1)
}

/** A local Date → 'YYYY-MM-DD'. */
export function paraChaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "hoje" / "amanhã" / "sex, 12 de setembro" — warm, not robotic. */
export function rotuloDoDia(chave: string, agora = new Date()): string {
  const hoje = paraChaveDia(agora)
  const amanha = paraChaveDia(new Date(agora.getTime() + 86_400_000))
  if (chave === hoje) return 'hoje'
  if (chave === amanha) return 'amanhã'
  const d = deChaveDia(chave)
  return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** "quinta-feira, 4 de setembro · 09:00" */
export function quandoPorExtenso(iso: string): string {
  return `${dataLonga(iso)} · ${horaCurta(iso)}`
}

/** Human distance to the appointment: "em 3 dias", "em 2 horas", "há 5 dias". */
export function distanciaHumana(iso: string, agora = new Date()): string {
  const diff = new Date(iso).getTime() - agora.getTime()
  const passado = diff < 0
  const abs = Math.abs(diff)
  const minutos = Math.round(abs / 60_000)
  const horas = Math.round(abs / 3_600_000)
  const dias = Math.round(abs / 86_400_000)

  let medida: string
  if (minutos < 60) medida = `${minutos} min`
  else if (horas < 24) medida = horas === 1 ? '1 hora' : `${horas} horas`
  else medida = dias === 1 ? '1 dia' : `${dias} dias`

  return passado ? `há ${medida}` : `em ${medida}`
}
