import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Prestador — a marketplace listing: a doctor, an obstetric/pediatric nurse, an
 * exam clinic or a hospital/maternity. Seeded (not a user account). The family
 * browses these to schedule an exam or a consultation, gets directions via
 * Google Maps / Waze, and requests contact (see Solicitacao).
 */
export const TIPOS_PRESTADOR = ['medico', 'enfermeiro', 'clinica', 'hospital'] as const
export const SERVICOS = ['exame', 'consulta-gestante', 'consulta-crianca'] as const
export const MODALIDADES = ['teleconsulta', 'presencial'] as const

const prestadorSchema = new Schema(
  {
    nome: { type: String, required: true },
    tipo: { type: String, enum: TIPOS_PRESTADOR, required: true },
    especialidade: { type: String, default: '' },
    servicos: { type: [String], default: [] },
    atende: { type: [String], default: ['presencial'] }, // teleconsulta / presencial
    aceitaDomiciliar: { type: Boolean, default: false }, // nurse visiting the home
    cidade: { type: String, default: '' },
    uf: { type: String, default: '' },
    endereco: { type: String, default: '' },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    bio: { type: String, default: '' },
    convenios: { type: [String], default: [] },
  },
  { timestamps: true },
)

export type PrestadorDoc = InferSchemaType<typeof prestadorSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Prestador: mongoose.Model<PrestadorDoc> =
  (mongoose.models.Prestador as mongoose.Model<PrestadorDoc>) ??
  mongoose.model<PrestadorDoc>('Prestador', prestadorSchema)
