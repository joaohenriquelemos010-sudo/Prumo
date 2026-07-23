import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Consulta (encounter) — a structured consultation record filled by a doctor,
 * iClinic-style, using the SOAP framework (Subjetivo / Objetivo / Avaliação /
 * Plano). Belongs to a Criança (the journey). It sits alongside the free-text
 * prontuário events and gives the doctor a guided, repeatable way to record a
 * visit. Health data — lives only in the database, scoped per patient.
 */
const consultaSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    data: { type: Date, default: Date.now },
    tipo: { type: String, enum: ['pre-natal', 'pediatrica'], default: 'pediatrica' },

    // SOAP
    subjetivo: { type: String, default: '', maxlength: 3000 },
    objetivo: { type: String, default: '', maxlength: 3000 },
    avaliacao: { type: String, default: '', maxlength: 3000 },
    plano: { type: String, default: '', maxlength: 3000 },

    // Optional vitals
    peso: { type: String, default: '' },
    altura: { type: String, default: '' },
    pressao: { type: String, default: '' },
  },
  { timestamps: true },
)

export type ConsultaDoc = InferSchemaType<typeof consultaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Consulta: mongoose.Model<ConsultaDoc> =
  (mongoose.models.Consulta as mongoose.Model<ConsultaDoc>) ??
  mongoose.model<ConsultaDoc>('Consulta', consultaSchema)
