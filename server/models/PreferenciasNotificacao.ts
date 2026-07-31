import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * O que cada pessoa aceita receber.
 *
 * Os defaults aqui são metade do produto. Um lembrete que chega demais deixa de
 * ser lembrete e vira ruído, e a pessoa desliga tudo — inclusive o aviso da
 * consulta que ela não podia perder. Então:
 *
 * - **`sequencia: false`.** Cutucão de streak é opt-in. É o tipo de notificação
 *   que serve ao produto e não à pessoa, e ligá-la por padrão seria escolher
 *   engajamento em cima de confiança.
 * - **Um por dia, três por semana.** Só o aviso de consulta fura esse teto.
 * - **Silêncio das 21h às 8h**, no fuso dela.
 */
const preferenciasSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    canais: {
      email: { type: Boolean, default: true },
      inapp: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
    },

    silencio: {
      de: { type: String, default: '21:00' },
      ate: { type: String, default: '08:00' },
      fuso: { type: String, default: 'America/Sao_Paulo' },
    },

    limites: {
      porDia: { type: Number, default: 1, min: 0, max: 10 },
      porSemana: { type: Number, default: 3, min: 0, max: 50 },
    },

    tipos: {
      consulta: { type: Boolean, default: true },
      checklist: { type: Boolean, default: true },
      exame: { type: Boolean, default: true },
      vacina: { type: Boolean, default: true },
      resumo: { type: Boolean, default: true },
      /** Opt-in. Ver o comentário do schema. */
      sequencia: { type: Boolean, default: false },
    },

    /**
     * Descadastro de um clique, **sem login**. É o ponto: quem quer sair não
     * pode esbarrar numa tela de senha — isso transforma "parar de receber" em
     * "marcar como spam", que é muito pior para todo mundo.
     */
    tokenDescadastro: { type: String, default: '', index: true, sparse: true },

    /** Pausa temporária. Converte um descadastro definitivo numa soneca. */
    pausadoAte: { type: Date, default: null },
  },
  { timestamps: true },
)

export type PreferenciasDoc = InferSchemaType<typeof preferenciasSchema> & {
  _id: mongoose.Types.ObjectId
}

export const PreferenciasNotificacao: mongoose.Model<PreferenciasDoc> =
  (mongoose.models.PreferenciasNotificacao as mongoose.Model<PreferenciasDoc>) ??
  mongoose.model<PreferenciasDoc>('PreferenciasNotificacao', preferenciasSchema)

/**
 * A forma concreta das preferências.
 *
 * `InferSchemaType` marca todo subdocumento aninhado como opcional, mesmo com
 * default no schema — então cada consumidor teria que repetir os mesmos
 * fallbacks. Centralizar aqui garante que os defaults sejam **um só lugar**: se
 * `sequencia` deixar de ser opt-in, muda numa linha, e não em três arquivos.
 */
export interface PreferenciasConcretas {
  canais: { email: boolean; inapp: boolean; push: boolean }
  silencio: { de: string; ate: string; fuso: string }
  limites: { porDia: number; porSemana: number }
  tipos: Record<string, boolean>
  pausadoAte: Date | null
}

export function normalizarPreferencias(doc: PreferenciasDoc): PreferenciasConcretas {
  return {
    canais: {
      email: doc.canais?.email ?? true,
      inapp: doc.canais?.inapp ?? true,
      push: doc.canais?.push ?? false,
    },
    silencio: {
      de: doc.silencio?.de ?? '21:00',
      ate: doc.silencio?.ate ?? '08:00',
      fuso: doc.silencio?.fuso ?? 'America/Sao_Paulo',
    },
    limites: {
      porDia: doc.limites?.porDia ?? 1,
      porSemana: doc.limites?.porSemana ?? 3,
    },
    tipos: {
      consulta: doc.tipos?.consulta ?? true,
      checklist: doc.tipos?.checklist ?? true,
      exame: doc.tipos?.exame ?? true,
      vacina: doc.tipos?.vacina ?? true,
      resumo: doc.tipos?.resumo ?? true,
      /** Opt-in. O default que mais importa nesta lista. */
      sequencia: doc.tipos?.sequencia ?? false,
    },
    pausadoAte: doc.pausadoAte ?? null,
  }
}
