import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Prontuário — the continuous clinical record for one Criança, from gestation
 * through pediatrics. One document per Criança. Free-text notes are appended as
 * events with an author and timestamp; the structured fields carry the summary a
 * doctor scans first. All of this is health data and lives only in the database.
 */
const eventoSchema = new Schema(
  {
    data: { type: Date, default: Date.now },
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    autorPapel: { type: String, default: '' },
    texto: { type: String, required: true, maxlength: 2000 },
  },
  { _id: true },
)

/**
 * Resumo de nascimento — a passagem do pré-natal para a pediatria.
 *
 * É a informação que a pediatra pede na primeira consulta e que hoje se perdia
 * entre a obstetra e ela: como foi a gestação, como foi o parto, com quanto o
 * bebê nasceu, quais sorologias e triagens já estão respondidas. Preenchido uma
 * vez, na virada, e lido dali em diante — a "trilha contínua" que o produto
 * promete, com um mecanismo por trás.
 */
const triagemSchema = new Schema(
  {
    id: { type: String, required: true },
    feito: { type: Boolean, default: false },
    data: { type: Date, default: null },
    resultado: { type: String, default: '', maxlength: 200 },
  },
  { _id: false },
)

const resumoNascimentoSchema = new Schema(
  {
    preenchido: { type: Boolean, default: false },
    igAoNascerSemanas: { type: Number, default: null },
    igAoNascerDias: { type: Number, default: null },
    tipoParto: { type: String, enum: ['vaginal', 'cesarea', 'forceps', ''], default: '' },
    apgar1: { type: Number, default: null },
    apgar5: { type: Number, default: null },
    pesoNascimentoG: { type: Number, default: null },
    comprimentoNascimentoCm: { type: Number, default: null },
    pcNascimentoCm: { type: Number, default: null },
    intercorrencias: { type: String, default: '', maxlength: 1000 },
    sorologiasMaternas: { type: String, default: '', maxlength: 500 },
    /** Estreptococo do grupo B, colhido entre 35 e 37 semanas. */
    gbs: { type: String, enum: ['positivo', 'negativo', 'nao-realizado', ''], default: '' },
    aleitamento: { type: String, default: '', maxlength: 200 },
    triagens: { type: [triagemSchema], default: [] },
    registradoPor: { type: String, default: '' },
    registradoEm: { type: Date, default: null },
  },
  { _id: false },
)

const prontuarioSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, unique: true, index: true },
    tipoSanguineo: { type: String, default: '' },
    alergias: { type: String, default: '' },
    resumoGestacional: { type: String, default: '' },
    condicoes: { type: [String], default: [] },
    eventos: { type: [eventoSchema], default: [] },
    resumoNascimento: { type: resumoNascimentoSchema, default: () => ({}) },
  },
  { timestamps: true },
)

export type ProntuarioDoc = InferSchemaType<typeof prontuarioSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Prontuario: mongoose.Model<ProntuarioDoc> =
  (mongoose.models.Prontuario as mongoose.Model<ProntuarioDoc>) ??
  mongoose.model<ProntuarioDoc>('Prontuario', prontuarioSchema)
