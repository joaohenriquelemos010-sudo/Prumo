import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Prontuário — the continuous clinical record for one Criança, from gestation
 * through pediatrics. One document per Criança. Free-text notes are appended as
 * events with an author and timestamp; the structured fields carry the summary a
 * doctor scans first. All of this is health data and lives only in the database.
 */
const eventoSchema = new Schema(
  {
    data: { type: Date, default: Date.now },
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    autorPapel: { type: String, default: '' },
    texto: { type: String, required: true, maxlength: 2000 },
  },
  { _id: true },
)

const prontuarioSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, unique: true, index: true },
    tipoSanguineo: { type: String, default: '' },
    alergias: { type: String, default: '' },
    resumoGestacional: { type: String, default: '' },
    condicoes: { type: [String], default: [] },
    eventos: { type: [eventoSchema], default: [] },
  },
  { timestamps: true },
)

export type ProntuarioDoc = InferSchemaType<typeof prontuarioSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Prontuario: mongoose.Model<ProntuarioDoc> =
  (mongoose.models.Prontuario as mongoose.Model<ProntuarioDoc>) ??
  mongoose.model<ProntuarioDoc>('Prontuario', prontuarioSchema)
