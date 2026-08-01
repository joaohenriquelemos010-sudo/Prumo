import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Agendamento — a real appointment: it has a date and a time.
 *
 * It replaces the old `Solicitacao`, which carried only a provider and an intent,
 * so nothing could ever be confirmed and the agenda ended up showing the moment
 * the request was typed as if it were the consultation.
 *
 * Two shapes of destination, one model:
 *  - `origem: 'medico'`     → a registered doctor with a published agenda. The
 *                             family picks a real free slot; the doctor confirms.
 *  - `origem: 'marketplace'`→ a seeded Prestador with no account. The family
 *                             proposes a time and an admin answers on their behalf.
 *
 * Scoped by `crianca`, not by user id, so the other parent and the linked doctor
 * see the same agenda — that's what `resolveCriancaOr403` keys on everywhere else.
 */
export const OBJETIVOS_AGENDAMENTO = [
  'exame',
  'consulta-gestante',
  'consulta-crianca',
  'pre-concepcional',
] as const
export type ObjetivoAgendamento = (typeof OBJETIVOS_AGENDAMENTO)[number]

export const STATUS_AGENDAMENTO = [
  'pendente',
  'confirmado',
  'recusado',
  'cancelado',
  'realizado',
  'faltou',
] as const
export type StatusAgendamento = (typeof STATUS_AGENDAMENTO)[number]

/** Statuses that still occupy a slot on the doctor's calendar. */
export const STATUS_OCUPAM_SLOT: StatusAgendamento[] = ['pendente', 'confirmado', 'realizado']

const historicoSchema = new Schema(
  {
    em: { type: Date, default: Date.now },
    porId: { type: String, default: '' },
    porNome: { type: String, default: '' },
    de: { type: String, default: '' },
    para: { type: String, default: '' },
    nota: { type: String, default: '', maxlength: 200 },
  },
  { _id: false },
)

const agendamentoSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    /**
     * Vazio quando a jornada ainda não tem conta — o atendimento de balcão, que
     * o médico registra sem que a paciente tenha se cadastrado. A `crianca` é
     * que identifica de quem é o atendimento; o `pacienteId` só diz qual conta o
     * enxerga, e antes da vinculação não existe nenhuma.
     */
    pacienteId: { type: String, default: '', index: true },
    pacienteNome: { type: String, default: '' },

    // Exactly one of these two is set — see `origem`.
    medicoId: { type: String, default: '', index: true },
    medicoNome: { type: String, default: '' },
    prestador: { type: Schema.Types.ObjectId, ref: 'Prestador', default: null },
    prestadorNome: { type: String, default: '' },
    origem: { type: String, enum: ['medico', 'marketplace'], default: 'marketplace' },

    objetivo: { type: String, enum: OBJETIVOS_AGENDAMENTO, required: true },
    modalidade: {
      type: String,
      enum: ['teleconsulta', 'presencial', 'domiciliar'],
      default: 'presencial',
    },

    inicio: { type: Date, required: true, index: true },
    duracaoMin: { type: Number, default: 30, min: 10, max: 240 },
    local: { type: String, default: '', maxlength: 160 },

    status: { type: String, enum: STATUS_AGENDAMENTO, default: 'pendente', index: true },
    motivo: { type: String, default: '', maxlength: 200 },
    mensagem: { type: String, default: '', maxlength: 500 },
    /** The plan the family named when booking — informative, never a guarantee. */
    convenio: { type: String, default: '', maxlength: 80 },

    /** Set when the doctor turns the appointment into a recorded encounter. */
    consulta: { type: Schema.Types.ObjectId, ref: 'Consulta', default: null },

    historico: { type: [historicoSchema], default: [] },

    /** Id of the `Solicitacao` this came from, so the migration stays idempotent. */
    origemLegado: { type: String, default: '' },
  },
  { timestamps: true },
)

// The two reads that matter: a doctor's day, and a journey's upcoming agenda.
agendamentoSchema.index({ medicoId: 1, inicio: 1 })
agendamentoSchema.index({ crianca: 1, inicio: 1 })

export type AgendamentoDoc = InferSchemaType<typeof agendamentoSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const Agendamento: mongoose.Model<AgendamentoDoc> =
  (mongoose.models.Agendamento as mongoose.Model<AgendamentoDoc>) ??
  mongoose.model<AgendamentoDoc>('Agendamento', agendamentoSchema)
