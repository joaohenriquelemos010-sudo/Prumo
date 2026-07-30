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
    /**
     * Qual programa de cuidado esta jornada segue (ver server/programas/).
     * Decide quais checklists, protocolos, templates de prontuário e widgets de
     * painel carregam. Hoje só existe `materno-infantil`, que é exatamente o
     * produto atual — o campo existe para que a segunda especialidade seja um
     * arquivo novo em vez de uma refatoração.
     */
    programa: { type: String, default: 'materno-infantil', index: true },
    /**
     * Reservado para multi-clínica. Não usado por nenhuma rota hoje, e é de
     * propósito: o campo custa zero agora e um backfill sobre dezenas de milhares
     * de documentos custa caro depois.
     */
    organizacao: { type: Schema.Types.ObjectId, ref: 'Organizacao', default: null, index: true },
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
     * Check-in da família na tela do bebê. Não é dado clínico — é o ritual que
     * traz de volta, e a sequência que faz isso valer a pena.
     *
     * `periodo` é a semana gestacional antes do parto e o mês de vida depois, por
     * isso vem acompanhado da `fase`: sem ela, a semana 20 da gestação e o mês 20
     * da criança colidiriam. `semana` é o campo legado de quando esta tela só
     * cobria a gravidez, lido como fallback.
     */
    checkins: {
      type: [
        new Schema(
          {
            fase: { type: String, enum: ['gestacao', 'pos-natal'], default: 'gestacao' },
            periodo: { type: Number, default: null },
            semana: { type: Number, default: null },
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
