import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Um balde de rate limit.
 *
 * O `_id` é a própria chave (`login:187.1.2.3`), o que torna incrementar um
 * `findOneAndUpdate` com upsert — uma ida ao banco, atômica, sem transação e
 * sem leitura antes da escrita. Duas requisições simultâneas do mesmo IP não
 * conseguem ler "9" as duas e gravar "10" as duas.
 *
 * ## Por que MongoDB e não Redis
 *
 * O limitador anterior era um `Map` em memória do processo. Num deploy
 * serverless isso quer dizer que **cada cold start zera o contador**, e que dez
 * instâncias quentes dão dez vezes o limite anunciado — ou seja, o limite de
 * login existia no código e não existia na prática. A conexão do Mongoose já
 * está aberta em toda requisição; um round trip a mais é barato perto de
 * introduzir um segundo serviço de infraestrutura só para contar.
 *
 * ## A expiração
 *
 * `expiraEm` tem índice TTL com `expireAfterSeconds: 0`, então o próprio Mongo
 * varre os baldes vencidos. Sem isso a coleção cresceria para sempre com um
 * documento por IP por rota — a limpeza é do banco, não de um cron nosso.
 */
const limiteSchema = new Schema(
  {
    _id: { type: String },
    contador: { type: Number, default: 0 },
    expiraEm: { type: Date, required: true },
  },
  { versionKey: false },
)

limiteSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 })

export type LimiteDoc = InferSchemaType<typeof limiteSchema> & { _id: string }

export const Limite: mongoose.Model<LimiteDoc> =
  (mongoose.models.Limite as mongoose.Model<LimiteDoc>) ??
  mongoose.model<LimiteDoc>('Limite', limiteSchema)
