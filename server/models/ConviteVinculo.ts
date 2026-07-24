import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * ConviteVinculo — a short-lived share token behind the link/QR. Either side may
 * create one:
 *  - patient-initiated: carries the patient's `crianca`; a doctor accepts it;
 *  - doctor-initiated: carries the `medicoId`; the patient accepts it.
 * On acceptance a Vínculo is created and the invite is marked used.
 */
const conviteSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    criadorId: { type: String, required: true },
    criadorNome: { type: String, default: '' },
    criadorPapel: { type: String, enum: ['gestante', 'mae', 'pai', 'medico'], required: true },
    // 'medico' → doctor↔patient link (default); 'coparent' → invite the other parent.
    tipo: { type: String, enum: ['medico', 'coparent'], default: 'medico' },
    // Set when the patient creates the invite.
    crianca: { type: Schema.Types.ObjectId, ref: 'Crianca', default: null },
    // Set when the doctor creates the invite.
    medicoId: { type: String, default: '' },
    expiraEm: { type: Date, required: true },
    usado: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export type ConviteVinculoDoc = InferSchemaType<typeof conviteSchema> & {
  _id: mongoose.Types.ObjectId
}

export const ConviteVinculo: mongoose.Model<ConviteVinculoDoc> =
  (mongoose.models.ConviteVinculo as mongoose.Model<ConviteVinculoDoc>) ??
  mongoose.model<ConviteVinculoDoc>('ConviteVinculo', conviteSchema)
