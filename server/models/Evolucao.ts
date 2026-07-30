import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Evolução — uma entrada do prontuário, e a unidade da história clínica.
 *
 * ## Por que append-only
 *
 * Um prontuário médico não se edita nem se apaga. Corrigir um registro é
 * **retificar**: escreve-se uma entrada nova que aponta para a anterior, e as
 * duas ficam. Foi assim no papel por um século, e a versão eletrônica só é
 * aceitável se preservar a mesma propriedade — é o que a Res. CFM 1.821/2007 e o
 * nível NGS2 da certificação SBIS/CFM cobram.
 *
 * Por isso não existe rota de update nem de delete para esta coleção. A única
 * mutação permitida é carimbar `retificadaPor` numa entrada, e ela é feita uma
 * vez só, com guarda.
 *
 * ## A cadeia de hash
 *
 * Cada entrada carrega o hash da anterior. Adulterar uma evolução no banco —
 * por acesso direto, por engano de operação, por má-fé — quebra a cadeia a
 * partir dali, e `verificarCadeia()` aponta exatamente onde. Não impede a
 * escrita; torna a adulteração **detectável**, que é o que se pode prometer de
 * verdade sem um serviço externo de selagem.
 *
 * `ordem` é monotônica por jornada e tem índice único: é ela que serializa
 * gravações concorrentes, porque duas evoluções nunca podem ocupar a mesma
 * posição da cadeia.
 */
export const TIPOS_EVOLUCAO = [
  'admissao',
  'consulta',
  'evolucao',
  'resultado',
  'transferencia',
  'intercorrencia',
] as const
export type TipoEvolucao = (typeof TIPOS_EVOLUCAO)[number]

const evolucaoSchema = new Schema(
  {
    /** Vocabulário novo, ref antiga — ver models/Jornada.ts. */
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', required: true, index: true },
    ordem: { type: Number, required: true },

    tipo: { type: String, enum: TIPOS_EVOLUCAO, default: 'evolucao' },
    consulta: { type: Schema.Types.ObjectId, ref: 'Consulta', default: null, index: true },

    autorId: { type: String, default: '' },
    autorNome: { type: String, default: '' },
    autorPapel: { type: String, default: '' },
    autorCrm: { type: String, default: '' },
    autorEspecialidade: { type: String, default: '' },
    em: { type: Date, default: Date.now },

    /** Qual template estruturou o conteúdo (ver conteudo/prontuario-templates.ts). */
    template: {
      chave: { type: String, default: '' },
      versao: { type: Number, default: 1 },
    },

    conteudo: {
      texto: { type: String, default: '', maxlength: 6000 },
      estruturado: { type: Schema.Types.Mixed, default: null },
    },

    /** `equipe` não sai para a família — mesma regra do resto do produto. */
    visibilidade: { type: String, enum: ['familia', 'equipe'], default: 'familia' },

    /**
     * RESERVADO. Nada de IA é gerado hoje. O campo existe porque a Res. CFM
     * 2.454/2026 exige rastrear o que foi produzido com apoio de IA, e
     * retroencaixar isso numa coleção append-only depois seria impossível.
     */
    origem: { type: String, enum: ['humano', 'ia-revisada'], default: 'humano' },

    hash: { type: String, default: '' },
    hashAnterior: { type: String, default: '' },

    /** Preenchido quando ESTA entrada corrige outra. */
    retificacaoDe: { type: Schema.Types.ObjectId, ref: 'Evolucao', default: null },
    /** Preenchido na entrada ANTIGA quando alguém a corrige. Única mutação permitida. */
    retificadaPor: { type: Schema.Types.ObjectId, ref: 'Evolucao', default: null },

    metadados: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
)

/** Serializa a cadeia: duas evoluções nunca ocupam a mesma posição. */
evolucaoSchema.index({ jornada: 1, ordem: 1 }, { unique: true })
evolucaoSchema.index({ jornada: 1, em: -1 })

export type EvolucaoDoc = InferSchemaType<typeof evolucaoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Evolucao: mongoose.Model<EvolucaoDoc> =
  (mongoose.models.Evolucao as mongoose.Model<EvolucaoDoc>) ??
  mongoose.model<EvolucaoDoc>('Evolucao', evolucaoSchema)
