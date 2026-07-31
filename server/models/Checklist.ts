import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * O **estado** de um checklist para uma jornada. Só estado.
 *
 * Nenhum título, nenhuma explicação, nenhum texto: tudo isso vive no
 * `ChecklistTemplate`. É essa separação que permite corrigir uma explicação mal
 * escrita sem tocar no progresso de ninguém — e `templateVersao` registra
 * exatamente qual redação a paciente tinha na frente quando marcou.
 */
export const ESTADOS_GRUPO = ['pendente', 'em-andamento', 'feito', 'nao-se-aplica'] as const
export type EstadoGrupo = (typeof ESTADOS_GRUPO)[number]

const passoEstadoSchema = new Schema(
  {
    id: { type: String, required: true },
    feito: { type: Boolean, default: false },
    feitoEm: { type: Date, default: null },
  },
  { _id: false },
)

const grupoEstadoSchema = new Schema(
  {
    id: { type: String, required: true },
    estado: { type: String, enum: ESTADOS_GRUPO, default: 'pendente' },
    feitoEm: { type: Date, default: null },
    feitoPor: { type: String, default: '' },
    /**
     * A nota da família. "Marquei mas o laboratório estava fechado", "a médica
     * disse que não precisa". Vira contexto para a consulta seguinte.
     */
    nota: { type: String, default: '', maxlength: 500 },
    passos: { type: [passoEstadoSchema], default: [] },
  },
  { _id: false },
)

const checklistSchema = new Schema(
  {
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    templateChave: { type: String, required: true },
    templateVersao: { type: Number, required: true, default: 1 },

    /** Quem atribuiu. Vazio quando foi o próprio programa, na criação da jornada. */
    atribuidoPor: { type: String, default: '' },
    atribuidoPorNome: { type: String, default: '' },
    atribuidoEm: { type: Date, default: Date.now },

    grupos: { type: [grupoEstadoSchema], default: [] },

    /**
     * O ritual. Não é dado clínico — é o que traz de volta, e a sequência é o
     * que faz isso valer a pena. Alimenta o chip de streak.
     */
    sequenciaDias: { type: Number, default: 0 },
    ultimoToqueEm: { type: Date, default: null },
  },
  { timestamps: true },
)

checklistSchema.index({ jornada: 1, templateChave: 1 }, { unique: true })

export type ChecklistDoc = InferSchemaType<typeof checklistSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Checklist: mongoose.Model<ChecklistDoc> =
  (mongoose.models.Checklist as mongoose.Model<ChecklistDoc>) ??
  mongoose.model<ChecklistDoc>('Checklist', checklistSchema)
