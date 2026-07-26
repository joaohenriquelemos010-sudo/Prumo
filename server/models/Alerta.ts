import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Alerta — a measurement that fell outside the expected band for the age.
 *
 * Raised automatically when a fetal biometry or a child's anthropometry is
 * recorded, so a drifting curve reaches the doctor on the day it is written
 * rather than whenever somebody next thinks to plot it.
 *
 * `paraFamilia` defaults to false, and that default is the point. Most of these
 * are a prompt for the clinician to look closer, not news for a mother to read
 * alone. The few that are worth surfacing are phrased as an invitation to talk at
 * the next visit — never as a number and a percentile.
 */
export const SEVERIDADES = ['info', 'atencao', 'urgente'] as const
export type Severidade = (typeof SEVERIDADES)[number]

export const ORIGENS_ALERTA = ['medida-fetal', 'antropometria', 'agenda', 'vacina'] as const

const alertaSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    origem: { type: String, enum: ORIGENS_ALERTA, required: true },
    /** Id do documento que gerou o alerta — evita duplicar na regravação. */
    referenciaId: { type: String, default: '', index: true },
    /** Chave estável da regra, p.ex. 'pfe-abaixo-p10'. */
    regra: { type: String, required: true },
    severidade: { type: String, enum: SEVERIDADES, default: 'atencao' },
    titulo: { type: String, required: true, maxlength: 160 },
    detalhe: { type: String, default: '', maxlength: 600 },
    condutaSugerida: { type: String, default: '', maxlength: 600 },
    fonte: { type: String, default: '', maxlength: 200 },
    /** Texto acolhedor mostrado à família, quando `paraFamilia` é true. */
    mensagemFamilia: { type: String, default: '', maxlength: 400 },
    paraFamilia: { type: Boolean, default: false },
    resolvido: { type: Boolean, default: false },
    resolvidoPor: { type: String, default: '' },
    resolvidoEm: { type: Date, default: null },
  },
  { timestamps: true },
)

// One alert per rule per source document — re-saving a measurement must not pile
// up copies of the same finding.
alertaSchema.index({ crianca: 1, referenciaId: 1, regra: 1 }, { unique: true })

export type AlertaDoc = InferSchemaType<typeof alertaSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
}

export const Alerta: mongoose.Model<AlertaDoc> =
  (mongoose.models.Alerta as mongoose.Model<AlertaDoc>) ??
  mongoose.model<AlertaDoc>('Alerta', alertaSchema)
