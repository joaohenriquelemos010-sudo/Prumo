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
    /**
     * Check-in semanal da família na tela do bebê. Não é dado clínico — é o
     * ritual que traz de volta, e a sequência que faz isso valer a pena.
     */
    checkins: {
      type: [
        new Schema(
          {
            semana: { type: Number, required: true },
            em: { type: Date, default: Date.now },
            notaFamilia: { type: String, default: '', maxlength: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    /**
     * Convênio da jornada — usado para filtrar o marketplace ("atende meu plano?")
     * e para indicar cobertura nos exames. O número da carteirinha é dado
     * sensível: fica `select: false` e volta mascarado para quem não é o titular.
     */
    convenio: {
      tipo: { type: String, enum: ['convenio', 'particular', 'sus'], default: 'particular' },
      operadora: { type: String, default: '', maxlength: 80 },
      plano: { type: String, default: '', maxlength: 80 },
      numeroCarteirinha: { type: String, default: '', maxlength: 40, select: false },
      validade: { type: Date, default: null },
      informado: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
)

export type CriancaDoc = InferSchemaType<typeof criancaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Crianca: mongoose.Model<CriancaDoc> =
  (mongoose.models.Crianca as mongoose.Model<CriancaDoc>) ??
  mongoose.model<CriancaDoc>('Crianca', criancaSchema)
