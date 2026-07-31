import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Uma mensagem de sinalização WebRTC — a caixa postal de uma chamada.
 *
 * ## Por que existe (e por que é tão barato)
 *
 * Numa teleconsulta 1:1, o **áudio e o vídeo nunca passam pelo Prumo**: eles vão
 * direto de um navegador ao outro. O que o servidor precisa fazer é apenas
 * apresentar os dois — trocar meia dúzia de mensagens (`offer`, `answer`,
 * candidatos ICE) enquanto a conexão se estabelece. Depois disso ele sai de
 * cena.
 *
 * É essa separação que torna a teleconsulta **gratuita**: os provedores de vídeo
 * cobram por minuto porque retransmitem mídia. Aqui não há mídia para
 * retransmitir. O custo é uma coleção com TTL e algumas requisições curtas por
 * chamada.
 *
 * ## Por que não é WebSocket
 *
 * Porque o backend roda como função serverless, onde não existe conexão de longa
 * duração. A alternativa seria um serviço de realtime pago — para trocar seis
 * mensagens. Poll curto durante a negociação resolve, e o custo aparece só onde
 * ele não é sentido: a latência de estabelecer a chamada, não a da conversa.
 *
 * ## TTL agressivo
 *
 * Cinco minutos. Um candidato ICE velho não serve para nada — a rede daquele
 * aparelho já mudou —, e sinais acumulados de chamadas passadas seriam entregues
 * a uma chamada nova e a fariam falhar de um jeito impossível de diagnosticar.
 */
export const TIPOS_SINAL = ['oferta', 'resposta', 'candidato', 'tchau'] as const
export type TipoSinal = (typeof TIPOS_SINAL)[number]

const sinalSchema = new Schema(
  {
    /** A sala é o próprio agendamento: não há chamada sem consulta marcada. */
    agendamento: { type: Schema.Types.ObjectId, ref: 'Agendamento', required: true, index: true },

    /** Quem mandou e para quem. Uma chamada tem exatamente dois participantes. */
    de: { type: String, required: true },
    para: { type: String, required: true },

    tipo: { type: String, enum: TIPOS_SINAL, required: true },

    /**
     * O SDP ou o candidato ICE, como veio do navegador. Opaco para o servidor —
     * ele encaminha, não interpreta, e é por isso que uma mudança na negociação
     * do WebRTC não exige deploy de backend.
     */
    carga: { type: Schema.Types.Mixed, default: null },

    criadoEm: { type: Date, default: Date.now },
    expiraEm: { type: Date, required: true, index: true },
  },
  { versionKey: false },
)

sinalSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 })
// A única consulta do cliente: "o que chegou para mim nesta sala desde X".
sinalSchema.index({ agendamento: 1, para: 1, criadoEm: 1 })

export type SinalDoc = InferSchemaType<typeof sinalSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Sinal: mongoose.Model<SinalDoc> =
  (mongoose.models.Sinal as mongoose.Model<SinalDoc>) ??
  mongoose.model<SinalDoc>('Sinal', sinalSchema)
