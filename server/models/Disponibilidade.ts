import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Disponibilidade — one document per doctor, describing when they can be booked.
 *
 * Rules are weekly and written in the clinic's wall clock ("Tuesdays 09:00–12:00"),
 * not as instants; `server/services/slots.ts` expands them into real slots for a
 * date range and subtracts what is already taken. Blocks are the exceptions —
 * holidays, a congress, a surgery afternoon.
 *
 * A doctor with `ativo: false` (the default until they set this up) simply isn't
 * bookable; the family still finds them, but through the contact-request path.
 */
export const MODALIDADES_ATENDIMENTO = ['presencial', 'teleconsulta', 'domiciliar'] as const
export type ModalidadeAtendimento = (typeof MODALIDADES_ATENDIMENTO)[number]

const regraSchema = new Schema(
  {
    /** 0 = Sunday, matching `Date.getUTCDay()` and the slot expander. */
    diaSemana: { type: Number, min: 0, max: 6, required: true },
    /** 'HH:MM' in the clinic's timezone. */
    inicio: { type: String, required: true },
    fim: { type: String, required: true },
    modalidades: { type: [String], default: ['presencial'] },
    local: { type: String, default: '', maxlength: 160 },
  },
  { _id: true },
)

const bloqueioSchema = new Schema(
  {
    de: { type: Date, required: true },
    ate: { type: Date, required: true },
    motivo: { type: String, default: '', maxlength: 160 },
  },
  { _id: true },
)

const disponibilidadeSchema = new Schema(
  {
    medicoId: { type: String, required: true, unique: true, index: true },
    ativo: { type: Boolean, default: false },
    duracaoPadraoMin: { type: Number, default: 30, min: 10, max: 240 },
    /** How soon before a slot someone may still book it. */
    antecedenciaMinHoras: { type: Number, default: 12, min: 0, max: 720 },
    /** How far ahead the agenda is open. */
    janelaMaxDias: { type: Number, default: 60, min: 1, max: 365 },
    fuso: { type: String, default: 'America/Sao_Paulo' },
    regras: { type: [regraSchema], default: [] },
    bloqueios: { type: [bloqueioSchema], default: [] },
    /** Health plans accepted — powers the "atende seu plano" filter. */
    conveniosAtendidos: { type: [String], default: [] },
    atendeParticular: { type: Boolean, default: true },
    atendeSus: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export type DisponibilidadeDoc = InferSchemaType<typeof disponibilidadeSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Disponibilidade: mongoose.Model<DisponibilidadeDoc> =
  (mongoose.models.Disponibilidade as mongoose.Model<DisponibilidadeDoc>) ??
  mongoose.model<DisponibilidadeDoc>('Disponibilidade', disponibilidadeSchema)
