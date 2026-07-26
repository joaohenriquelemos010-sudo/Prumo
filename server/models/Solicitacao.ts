import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Solicitacao — DEPRECATED. The original booking request, which carried no date
 * and no time, so `confirmada` was unreachable and the agenda ended up showing
 * `createdAt` as if it were the appointment.
 *
 * Superseded by `Agendamento`. Kept only so `migrarSolicitacoes()` can carry the
 * existing rows over; nothing writes here any more. Drop the collection once the
 * migration has run everywhere.
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
    status: { type: String, enum: ['pendente', 'confirmada', 'cancelada'], default: 'pendente' },
    /** Set once this row has an `Agendamento` counterpart. */
    migrada: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export type SolicitacaoDoc = InferSchemaType<typeof solicitacaoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Solicitacao: mongoose.Model<SolicitacaoDoc> =
  (mongoose.models.Solicitacao as mongoose.Model<SolicitacaoDoc>) ??
  mongoose.model<SolicitacaoDoc>('Solicitacao', solicitacaoSchema)
