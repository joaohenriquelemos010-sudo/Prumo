import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Solicitacao — the family's request to schedule an exam or a consultation with
 * a Prestador. In the prototype the confirmation is simulated (status stays
 * 'pendente' until a real scheduling backend/agenda exists).
 */
const solicitacaoSchema = new Schema(
  {
    usuario: { type: String, required: true, index: true },
    usuarioNome: { type: String, default: '' },
    prestador: { type: Schema.Types.ObjectId, ref: 'Prestador', required: true },
    prestadorNome: { type: String, default: '' },
    objetivo: { type: String, enum: ['exame', 'consulta-gestante', 'consulta-crianca'], required: true },
    modalidade: { type: String, enum: ['teleconsulta', 'presencial', 'domiciliar'], default: 'presencial' },
    mensagem: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['pendente', 'confirmada'], default: 'pendente' },
  },
  { timestamps: true },
)

export type SolicitacaoDoc = InferSchemaType<typeof solicitacaoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Solicitacao: mongoose.Model<SolicitacaoDoc> =
  (mongoose.models.Solicitacao as mongoose.Model<SolicitacaoDoc>) ??
  mongoose.model<SolicitacaoDoc>('Solicitacao', solicitacaoSchema)
