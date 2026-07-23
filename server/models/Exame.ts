import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Exame — a saved exam/result the family (or doctor) uploads. The binary file
 * lives in GridFS (see server/storage/gridfs.ts); this document holds the
 * metadata plus the GridFS file id. Scoped per Criança so a doctor attending the
 * patient sees the full history through Prumo. Health data.
 */
export const CATEGORIAS_EXAME = [
  'sangue',
  'imagem',
  'ultrassom',
  'urina',
  'triagem',
  'outro',
] as const

const exameSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    nome: { type: String, required: true, maxlength: 120 },
    categoria: { type: String, enum: CATEGORIAS_EXAME, default: 'outro' },
    dataExame: { type: Date, default: Date.now },
    observacoes: { type: String, default: '', maxlength: 1000 },

    // File in GridFS
    arquivoId: { type: Schema.Types.ObjectId, default: null },
    arquivoNome: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    tamanho: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export type ExameDoc = InferSchemaType<typeof exameSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Exame: mongoose.Model<ExameDoc> =
  (mongoose.models.Exame as mongoose.Model<ExameDoc>) ??
  mongoose.model<ExameDoc>('Exame', exameSchema)
