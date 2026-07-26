import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * MedidaFetal — the baby's measurements, week by week.
 *
 * Written by the obstetrician (that is where the numbers come from: the scan, the
 * tape, the report). The family reads a warm version of the same record — the
 * size comparison, the curve, the streak — without the findings that frighten
 * without a clinician alongside. `notasPrivadas` never leaves the clinical side.
 *
 * `percentis` is computed on save from `server/clinico/curvas-fetais.ts`, so the
 * chart and the alerts read the same number the doctor saw.
 */
const percentisSchema = new Schema(
  {
    pfeG: { type: Number, default: null },
    ccMm: { type: Number, default: null },
    caMm: { type: Number, default: null },
    cfMm: { type: Number, default: null },
    dbpMm: { type: Number, default: null },
  },
  { _id: false },
)

const medidaFetalSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    /** Idade gestacional da medida — a chave de tudo aqui. */
    semana: { type: Number, required: true, min: 10, max: 42 },
    data: { type: Date, default: Date.now },
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    autorPapel: { type: String, default: '' },

    // Biometria
    dbpMm: { type: Number, default: null },
    ccMm: { type: Number, default: null },
    caMm: { type: Number, default: null },
    cfMm: { type: Number, default: null },
    pfeG: { type: Number, default: null },
    ilaCm: { type: Number, default: null },
    apresentacao: {
      type: String,
      enum: ['cefalica', 'pelvica', 'cormica', 'indefinida'],
      default: 'indefinida',
    },
    placenta: { type: String, default: '', maxlength: 120 },

    observacao: { type: String, default: '', maxlength: 500 },
    /** Nunca retornado para a família. */
    notasPrivadas: { type: String, default: '', maxlength: 1000 },

    percentis: { type: percentisSchema, default: () => ({}) },
    consulta: { type: Schema.Types.ObjectId, ref: 'Consulta', default: null },
  },
  { timestamps: true },
)

// One record per gestational week — a re-measure updates, never duplicates.
medidaFetalSchema.index({ crianca: 1, semana: 1 }, { unique: true })

export type MedidaFetalDoc = InferSchemaType<typeof medidaFetalSchema> & {
  _id: mongoose.Types.ObjectId
}

export const MedidaFetal: mongoose.Model<MedidaFetalDoc> =
  (mongoose.models.MedidaFetal as mongoose.Model<MedidaFetalDoc>) ??
  mongoose.model<MedidaFetalDoc>('MedidaFetal', medidaFetalSchema)
