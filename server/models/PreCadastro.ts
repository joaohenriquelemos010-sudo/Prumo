import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * O link de pré-cadastro de um médico.
 *
 * Um por médico, reaproveitável: é um endereço que vai no WhatsApp da clínica,
 * no perfil, no cartãozinho da recepção — não um convite por paciente. Um token
 * novo a cada paciente pareceria mais seguro e não seria: o link não **lê**
 * nada, só escreve uma ficha nova. Quem o descobre consegue mandar um cadastro
 * falso para a fila do médico, e é por isso que a defesa aqui é limite de
 * envios por IP e revisão humana antes de o dado valer — não o segredo do
 * endereço.
 *
 * `rotacionar` existe para o dia em que o link cair num lugar errado: o antigo
 * morre no mesmo instante, e a clínica publica o novo.
 */
const preCadastroSchema = new Schema(
  {
    medicoId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    /** Aleatório e longo — ver `gerarToken`. */
    token: { type: String, required: true, unique: true, index: true },
    /** O nome que a paciente vê no topo do formulário. */
    nomeClinica: { type: String, trim: true, maxlength: 60, default: '' },
    ativo: { type: Boolean, default: true },
    /** Quantas fichas já chegaram por aqui. Só para a tela do médico. */
    recebidos: { type: Number, default: 0 },
    rotacionadoEm: { type: Date, default: null },
  },
  { timestamps: true },
)

export type PreCadastroDoc = InferSchemaType<typeof preCadastroSchema> & {
  _id: mongoose.Types.ObjectId
}

export const PreCadastro: mongoose.Model<PreCadastroDoc> =
  (mongoose.models.PreCadastro as mongoose.Model<PreCadastroDoc>) ??
  mongoose.model<PreCadastroDoc>('PreCadastro', preCadastroSchema)
