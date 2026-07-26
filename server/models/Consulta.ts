import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Consulta (encounter) — a structured consultation record filled by a doctor,
 * using the SOAP framework (Subjetivo / Objetivo / Avaliação / Plano) plus the
 * guideline-driven fields for prenatal and paediatric visits. Belongs to a
 * Criança (the journey). Health data — lives only in the database, scoped per
 * patient.
 *
 * ## What the family reads
 *
 * Not all of it. `notasPrivadas` never leaves the doctor's side, and `avaliacao`
 * (the diagnostic impression) is shared only when the doctor says so. A finding
 * written for a colleague — "descartar RCIU" — lands very differently on a mother
 * reading it alone at midnight, and the record exists to inform her, not to
 * frighten her.
 *
 * That filtering happens on the server, in `serialize()` at
 * `server/routes/consultas.ts`, decided from the session — never from a flag the
 * client sends.
 */
export const TIPOS_CONSULTA = ['pre-concepcional', 'pre-natal', 'pediatrica'] as const
export type TipoConsulta = (typeof TIPOS_CONSULTA)[number]

/**
 * Numbers, not prose. The old `peso`/`altura`/`pressao` were free text ("6,8 kg"),
 * which reads fine and plots never — no growth curve, no trend, no alert. These
 * are what the pattern checks and the charts run on.
 */
const medidasSchema = new Schema(
  {
    pesoKg: { type: Number, default: null },
    alturaCm: { type: Number, default: null },
    imc: { type: Number, default: null },
    paSistolica: { type: Number, default: null },
    paDiastolica: { type: Number, default: null },
    // Gestação
    alturaUterinaCm: { type: Number, default: null },
    bcfBpm: { type: Number, default: null },
    // Criança
    pesoG: { type: Number, default: null },
    comprimentoCm: { type: Number, default: null },
    perimetroCefalicoCm: { type: Number, default: null },
  },
  { _id: false },
)

const itemChecklistSchema = new Schema(
  {
    /** Id vindo das diretrizes (diretrizes-prenatal.ts / diretrizes-pediatria.ts). */
    id: { type: String, required: true },
    feito: { type: Boolean, default: false },
    observacao: { type: String, default: '', maxlength: 300 },
  },
  { _id: false },
)

const consultaSchema = new Schema(
  {
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    data: { type: Date, default: Date.now },
    tipo: { type: String, enum: TIPOS_CONSULTA, default: 'pediatrica' },

    /** Preenchido quando a consulta nasceu de um agendamento. */
    agendamento: { type: Schema.Types.ObjectId, ref: 'Agendamento', default: null },

    // SOAP
    subjetivo: { type: String, default: '', maxlength: 3000 },
    objetivo: { type: String, default: '', maxlength: 3000 },
    avaliacao: { type: String, default: '', maxlength: 3000 },
    plano: { type: String, default: '', maxlength: 3000 },

    /** Idade gestacional no dia da consulta. */
    igSemanas: { type: Number, default: null },
    igDias: { type: Number, default: null },

    medidas: { type: medidasSchema, default: () => ({}) },
    checklist: { type: [itemChecklistSchema], default: [] },

    /** Nunca retornado para a família. */
    notasPrivadas: { type: String, default: '', maxlength: 3000 },
    /** Quando true, a impressão diagnóstica também fica só com a equipe. */
    avaliacaoPrivada: { type: Boolean, default: false },

    // Legado — mantido para os registros já existentes; preenchido a partir de
    // `medidas` na escrita, para que nada antigo deixe de renderizar.
    peso: { type: String, default: '' },
    altura: { type: String, default: '' },
    pressao: { type: String, default: '' },
  },
  { timestamps: true },
)

export type ConsultaDoc = InferSchemaType<typeof consultaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Consulta: mongoose.Model<ConsultaDoc> =
  (mongoose.models.Consulta as mongoose.Model<ConsultaDoc>) ??
  mongoose.model<ConsultaDoc>('Consulta', consultaSchema)
