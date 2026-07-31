import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Uma inscrição de Web Push — um aparelho, não uma pessoa.
 *
 * A mesma gestante tem o celular e o notebook, e cada um gera seu próprio
 * endpoint. Por isso a chave única é o `endpoint`, e não o `userId`: inscrever o
 * mesmo aparelho duas vezes atualiza, e inscrever um segundo aparelho soma.
 *
 * ## O que é guardado
 *
 * `endpoint`, `p256dh` e `auth` são o que o protocolo exige para cifrar a
 * mensagem de ponta a ponta até aquele navegador. Não são identificadores de
 * pessoa e não servem para rastrear ninguém fora do Prumo — mas são credenciais
 * de envio, então nunca saem numa resposta de API.
 *
 * ## Limpeza
 *
 * Um endpoint morre quando a pessoa desinstala o app, limpa o site ou revoga a
 * permissão. O serviço de push responde 404/410 nesse caso, e o despachante
 * apaga a inscrição na hora — sem isso, a coleção vira um cemitério de
 * endereços mortos que consomem uma requisição HTTP cada, para sempre.
 */
const assinaturaSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    /** Só para diagnóstico ("por que não chega no meu iPhone?"). */
    agente: { type: String, default: '', maxlength: 300 },
    ultimoEnvioEm: { type: Date, default: null },
  },
  { timestamps: true },
)

export type AssinaturaPushDoc = InferSchemaType<typeof assinaturaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const AssinaturaPush: mongoose.Model<AssinaturaPushDoc> =
  (mongoose.models.AssinaturaPush as mongoose.Model<AssinaturaPushDoc>) ??
  mongoose.model<AssinaturaPushDoc>('AssinaturaPush', assinaturaSchema)
