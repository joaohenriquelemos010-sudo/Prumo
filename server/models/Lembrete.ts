import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Um lembrete agendado.
 *
 * ## Como o despacho funciona
 *
 * **Claim-then-send**, nunca `find` + `updateMany`: o worker reivindica um
 * lembrete por vez com um `findOneAndUpdate` atômico que também põe um lease em
 * `travadoAte`. Duas execuções sobrepostas do cron nunca mandam o mesmo e-mail
 * duas vezes, e um worker que morre no meio deixa o lease expirar em vez de
 * travar o item para sempre.
 *
 * ## Idempotência
 *
 * `chaveDedup` é única. "Consulta de amanhã, agendamento X, T-24h" tem uma
 * chave só — então programar de novo (porque a consulta foi remarcada, porque o
 * hook rodou duas vezes) atualiza em vez de duplicar. Num sistema de lembretes,
 * duplicar é o pior defeito possível: é exatamente o que faz a pessoa desligar
 * tudo.
 */
export const TIPOS_LEMBRETE = [
  'consulta',
  'checklist',
  'exame',
  'vacina',
  'resumo',
  'sequencia',
  'digest',
] as const
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number]

export const CANAIS = ['email', 'inapp', 'push'] as const
export type CanalLembrete = (typeof CANAIS)[number]

export const ESTADOS_LEMBRETE = [
  'agendado',
  'enviando',
  'enviado',
  'suprimido',
  'falhou',
  'cancelado',
] as const
export type EstadoLembrete = (typeof ESTADOS_LEMBRETE)[number]

const lembreteSchema = new Schema(
  {
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', default: null, index: true },
    destinatarioId: { type: String, required: true, index: true },

    canal: { type: String, enum: CANAIS, default: 'inapp' },
    tipo: { type: String, enum: TIPOS_LEMBRETE, required: true },

    /**
     * 1 é o mais urgente. Usada para ordenar o despacho e para decidir o que
     * fura o limite diário — uma consulta amanhã fura, um cutucão de sequência
     * não.
     */
    prioridade: { type: Number, default: 3, min: 1, max: 5 },

    referencia: {
      colecao: { type: String, default: '' },
      id: { type: String, default: '' },
    },

    agendadoPara: { type: Date, required: true },
    estado: { type: String, enum: ESTADOS_LEMBRETE, default: 'agendado' },

    /** Lease do worker. Um `enviando` mais velho que isso é reivindicável. */
    travadoAte: { type: Date, default: () => new Date(0) },
    tentativas: { type: Number, default: 0 },
    enviadoEm: { type: Date, default: null },
    motivoSupressao: { type: String, default: '', maxlength: 120 },
    erro: { type: String, default: '', maxlength: 300 },

    chaveDedup: { type: String, required: true, unique: true },

    /** O que o template precisa para montar a mensagem. */
    carga: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
)

/** A única consulta que o worker faz. */
lembreteSchema.index({ estado: 1, agendadoPara: 1, prioridade: 1 })
/** Contagem dos limites de frequência. */
lembreteSchema.index({ destinatarioId: 1, enviadoEm: -1 })

export type LembreteDoc = InferSchemaType<typeof lembreteSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Lembrete: mongoose.Model<LembreteDoc> =
  (mongoose.models.Lembrete as mongoose.Model<LembreteDoc>) ??
  mongoose.model<LembreteDoc>('Lembrete', lembreteSchema)
