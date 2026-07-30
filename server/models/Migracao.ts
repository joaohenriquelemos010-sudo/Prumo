import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Registro de qual migração já rodou.
 *
 * O `_id` é o próprio nome da migração — é o que torna o claim atômico: dois
 * cold starts serverless concorrentes disputam o mesmo documento e só um ganha.
 * Não há coleção de "histórico" separada porque o estado é a única coisa que
 * importa: ou a migração está aplicada, ou não está.
 */
const migracaoSchema = new Schema(
  {
    _id: { type: String, required: true },
    estado: {
      type: String,
      enum: ['rodando', 'aplicada', 'falhou'],
      default: 'rodando',
      index: true,
    },
    iniciadaEm: { type: Date, default: Date.now },
    aplicadaEm: { type: Date, default: null },
    /** Mensagem do último erro, para diagnóstico. Nunca o stack completo. */
    erro: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true, _id: false },
)

export type MigracaoDoc = InferSchemaType<typeof migracaoSchema> & { _id: string }

export const Migracao: mongoose.Model<MigracaoDoc> =
  (mongoose.models.Migracao as mongoose.Model<MigracaoDoc>) ??
  mongoose.model<MigracaoDoc>('Migracao', migracaoSchema)
