import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

export const PAPEIS = ['gestante', 'mae', 'medico'] as const
export type Papel = (typeof PAPEIS)[number]

export const VERIFICACAO = ['nao_aplicavel', 'pendente', 'verificado'] as const
export type VerificacaoStatus = (typeof VERIFICACAO)[number]

const userSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    senhaHash: { type: String, required: true },
    papel: { type: String, enum: PAPEIS, required: true },

    // Doctor-only. CPF is sensitive PII — stored only for doctors, never returned
    // to the client, and should be encrypted at rest in production (see SECURITY.md).
    cpf: { type: String, default: '', select: false },
    crm: { type: String, default: '' },
    crmUf: { type: String, default: '' },
    verificacaoStatus: { type: String, enum: VERIFICACAO, default: 'nao_aplicavel' },
  },
  { timestamps: true },
)

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId
}

// Guard against model recompilation on serverless warm invocations.
export const User: mongoose.Model<UserDoc> =
  (mongoose.models.User as mongoose.Model<UserDoc>) ??
  mongoose.model<UserDoc>('User', userSchema)
