import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Transferência de prontuário — passar o caso para o próximo médico.
 *
 * O ponto do Prumo é que o registro segue **a paciente**, não o consultório. Por
 * isso o fluxo aqui tem três atos e não dois: o médico atual *pede*, a
 * **responsável consente**, e só então o médico receptor baixa. É o mesmo
 * precedente de `SolicitacaoCompartilhamento`, e é o precedente certo — quem
 * decide para onde o prontuário vai é quem é dono dele.
 *
 * O token é uma credencial portadora com prazo. Quem tiver o link baixa o
 * pacote, então ele expira por TTL e a revogação é imediata.
 */
export const ESCOPOS_TRANSFERENCIA = [
  'prontuario',
  'consultas',
  'exames',
  'medidas',
  'vacinas',
] as const
export type EscopoTransferencia = (typeof ESCOPOS_TRANSFERENCIA)[number]

const transferenciaSchema = new Schema(
  {
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },

    deMedicoId: { type: String, required: true, index: true },
    deMedicoNome: { type: String, default: '' },
    /** Para quem vai. E-mail porque o receptor pode ainda nem ter conta. */
    paraMedicoEmail: { type: String, default: '', lowercase: true, trim: true },
    paraMedicoNome: { type: String, default: '', maxlength: 80 },
    paraMedicoId: { type: String, default: '' },

    escopo: { type: [String], enum: ESCOPOS_TRANSFERENCIA, default: ['prontuario'] },
    motivo: { type: String, default: '', maxlength: 300 },

    estado: {
      type: String,
      enum: ['pendente', 'consentida', 'recusada', 'revogada', 'baixada'],
      default: 'pendente',
      index: true,
    },

    consentidoPor: { type: String, default: '' },
    consentidoEm: { type: Date, default: null },
    recusadoEm: { type: Date, default: null },
    revogadaEm: { type: Date, default: null },
    baixadaEm: { type: Date, default: null },

    /** Só existe depois do consentimento — antes disso não há o que baixar. */
    token: { type: String, default: '', index: true, sparse: true },
    expiraEm: { type: Date, default: null },
  },
  { timestamps: true },
)

/**
 * TTL: o documento some do banco quando expira. Um pacote clínico não deve
 * ficar acessível por um link esquecido numa caixa de e-mail.
 */
transferenciaSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 })

export type TransferenciaDoc = InferSchemaType<typeof transferenciaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Transferencia: mongoose.Model<TransferenciaDoc> =
  (mongoose.models.Transferencia as mongoose.Model<TransferenciaDoc>) ??
  mongoose.model<TransferenciaDoc>('Transferencia', transferenciaSchema)
