import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * A "Dúvida" is one question the family jots in the Caderninho de Dúvidas. It is
 * tied to a Criança (the journey), authored by the family, optionally shared with
 * the doctor, and optionally answered. Day-indexing is derived from `criadaEm` on
 * read — we store the timestamp, the UI groups by day.
 */
const duvidaSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    // Empty for seeded example questions (Mongoose rejects '' under `required`).
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    texto: { type: String, required: true, maxlength: 1000 },
    compartilhada: { type: Boolean, default: true },
    respondida: { type: Boolean, default: false },
    respostaTexto: { type: String, default: '' },
    respondidaPor: { type: String, default: '' },
    respondidaEm: { type: Date, default: null },
  },
  { timestamps: true },
)

export type DuvidaDoc = InferSchemaType<typeof duvidaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Duvida: mongoose.Model<DuvidaDoc> =
  (mongoose.models.Duvida as mongoose.Model<DuvidaDoc>) ??
  mongoose.model<DuvidaDoc>('Duvida', duvidaSchema)
