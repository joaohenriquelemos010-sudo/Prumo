import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * SolicitacaoCompartilhamento — a doctor's request to bring ANOTHER doctor onto a
 * patient's journey (médico → médico). It does not grant access on its own: it
 * opens a request the child's responsáveis (mãe/pai) must approve, showing which
 * doctor it points to and their specialty. On approval a Vínculo is created for
 * the destination doctor; any one responsável approving is enough.
 */
const solicitacaoCompartilhamentoSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    medicoOrigemId: { type: String, required: true, index: true },
    medicoOrigemNome: { type: String, default: '' },
    medicoDestinoId: { type: String, required: true, index: true },
    medicoDestinoNome: { type: String, default: '' },
    medicoDestinoEmail: { type: String, default: '' },
    especialidadeDestino: { type: String, default: '' },
    status: { type: String, enum: ['pendente', 'aprovada', 'recusada'], default: 'pendente' },
    resolvidaPor: { type: String, default: '' },
    resolvidaPorNome: { type: String, default: '' },
  },
  { timestamps: true },
)

export type SolicitacaoCompartilhamentoDoc = InferSchemaType<typeof solicitacaoCompartilhamentoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const SolicitacaoCompartilhamento: mongoose.Model<SolicitacaoCompartilhamentoDoc> =
  (mongoose.models.SolicitacaoCompartilhamento as mongoose.Model<SolicitacaoCompartilhamentoDoc>) ??
  mongoose.model<SolicitacaoCompartilhamentoDoc>('SolicitacaoCompartilhamento', solicitacaoCompartilhamentoSchema)
