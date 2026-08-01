import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Vínculo — an explicit, consented connection between a patient's journey
 * (Criança) and a doctor. Created when one side accepts the other's share
 * link/QR. It is what grants the doctor scoped access to that patient's exams,
 * prontuário, consultas and vaccines (see server/services/acesso.ts), and the
 * patient can revoke it at any time.
 */
const vinculoSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    /**
     * Vazio quando a paciente ainda não tem conta (jornada aberta pelo médico no
     * consultório). O vínculo existe assim mesmo, e é de propósito: é ele que
     * governa o acesso do médico e que faz a paciente aparecer em "Meus
     * pacientes" — as duas coisas continuam valendo antes de existir conta.
     * Preenchido na vinculação.
     */
    pacienteId: { type: String, default: '', index: true },
    pacienteNome: { type: String, default: '' },
    medicoId: { type: String, required: true, index: true },
    medicoNome: { type: String, default: '' },
    status: { type: String, enum: ['ativo'], default: 'ativo' },
  },
  { timestamps: true },
)

// One active link per (patient-baby, doctor).
vinculoSchema.index({ crianca: 1, medicoId: 1 }, { unique: true })

export type VinculoDoc = InferSchemaType<typeof vinculoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Vinculo: mongoose.Model<VinculoDoc> =
  (mongoose.models.Vinculo as mongoose.Model<VinculoDoc>) ??
  mongoose.model<VinculoDoc>('Vinculo', vinculoSchema)
