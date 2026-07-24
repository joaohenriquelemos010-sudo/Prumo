import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * A "Criança" holds the continuous track for one journey: the gestation phase
 * and, after birth, the child. It carries the trilha progress and the dates the
 * SUS clinical schedule (PNI / Caderneta) is computed from. Health data lives
 * here in the database — never in the browser's localStorage.
 */
const criancaSchema = new Schema(
  {
    responsavel: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /**
     * Co-responsáveis — the other parent(s) linked to this journey (mãe↔pai).
     * Stored as user id strings; each has full access to the child (see
     * server/services/acesso.ts). Managed through the co-parent invite flow.
     */
    coResponsaveis: { type: [String], default: [], index: true },
    nome: { type: String, trim: true, maxlength: 80, default: '' },
    momento: {
      type: String,
      enum: ['planejando', 'gestante', 'ja-nasceu'],
      default: 'gestante',
    },
    /** Data provável do parto (quando gestante). */
    dpp: { type: Date, default: null },
    /** Data de nascimento (quando já nasceu). */
    dataNascimento: { type: Date, default: null },
    /** Ids das etapas da trilha já concluídas. */
    etapasConcluidas: { type: [String], default: [] },
    /** Ids das doses de vacina já aplicadas (ver sus-vacinas.ts). */
    vacinasAplicadas: { type: [String], default: [] },
  },
  { timestamps: true },
)

export type CriancaDoc = InferSchemaType<typeof criancaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Crianca: mongoose.Model<CriancaDoc> =
  (mongoose.models.Crianca as mongoose.Model<CriancaDoc>) ??
  mongoose.model<CriancaDoc>('Crianca', criancaSchema)
