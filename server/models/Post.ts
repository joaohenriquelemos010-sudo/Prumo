import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Post — a message in the community feed (FLO-style). Mothers and pregnant users
 * share, support and ask. Posts can be anonymous. Likes are a set of user ids;
 * comments are embedded. Everything is sanitised and length-capped on write.
 */
export const CATEGORIAS_POST = ['gestacao', 'maternidade', 'amamentacao', 'desabafo', 'dica'] as const

const comentarioSchema = new Schema(
  {
    autorId: { type: String, required: true },
    autorNome: { type: String, default: '' },
    texto: { type: String, required: true, maxlength: 500 },
    criadaEm: { type: Date, default: Date.now },
  },
  { _id: true },
)

const postSchema = new Schema(
  {
    autorId: { type: String, required: true, index: true },
    autorNome: { type: String, default: '' },
    anonimo: { type: Boolean, default: false },
    categoria: { type: String, enum: CATEGORIAS_POST, default: 'maternidade' },
    texto: { type: String, required: true, maxlength: 1000 },
    curtidas: { type: [String], default: [] },
    comentarios: { type: [comentarioSchema], default: [] },
  },
  { timestamps: true },
)

export type PostDoc = InferSchemaType<typeof postSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Post: mongoose.Model<PostDoc> =
  (mongoose.models.Post as mongoose.Model<PostDoc>) ??
  mongoose.model<PostDoc>('Post', postSchema)
