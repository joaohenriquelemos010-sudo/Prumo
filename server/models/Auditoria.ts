import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * O log de auditoria.
 *
 * A NGS2 (SBIS/CFM) exige registro **imutável** de quem acessou o quê, quando e
 * de onde. É um dos pré-requisitos formais da certificação, e é também a única
 * forma de responder à pergunta que aparece depois de um incidente: *quem viu
 * este prontuário?*
 *
 * ## Imutabilidade não se declara, se impõe
 *
 * Este arquivo não expõe update nem delete, e nenhuma rota escreve aqui a não
 * ser por `registrar()`. Mas isso é disciplina de código, e disciplina de código
 * não é controle: quem tiver a string de conexão continua podendo apagar uma
 * linha. A imutabilidade de verdade se impõe **no Atlas**, com um usuário de
 * banco sem `update`/`remove` nesta coleção — está documentado em SECURITY.md, e
 * é obrigatório antes de reivindicar conformidade.
 *
 * ## O que NÃO entra aqui
 *
 * Nenhum conteúdo clínico. O log guarda que a Dra. Alice leu o prontuário da
 * jornada X às 14h32; não guarda o que estava escrito nele. Um log que copia o
 * dado sensível dobra a superfície de vazamento e passa a precisar da mesma
 * proteção que ele — e o log é justamente a coleção que mais gente precisa ler.
 */
export const ACOES = [
  'prontuario.ler',
  'prontuario.escrever',
  'prontuario.retificar',
  'consulta.iniciar',
  'consulta.finalizar',
  'exame.baixar',
  'transferencia.solicitar',
  'transferencia.consentir',
  'transferencia.baixar',
  // Mesmo conteúdo do `baixar`, outro formato — ação separada porque "quem
  // puxou como FHIR" é a pergunta que a auditoria de interoperabilidade faz.
  'transferencia.baixar-fhir',
  'dados.exportar',
  'conta.excluir',
  'login.sucesso',
  'login.falha',
  'admin.acao',
] as const
export type AcaoAuditada = (typeof ACOES)[number]

const auditoriaSchema = new Schema(
  {
    em: { type: Date, default: Date.now, index: true },

    /** Quem. Vazio só em falha de login com e-mail inexistente. */
    atorId: { type: String, default: '', index: true },
    atorPapel: { type: String, default: '' },

    /** O quê. String livre no tipo do Mongo, restrita no tipo do TypeScript. */
    acao: { type: String, required: true, index: true },

    /** Sobre o quê. */
    recurso: {
      colecao: { type: String, default: '' },
      id: { type: String, default: '' },
    },

    /** De quem é o dado tocado — a pergunta "quem viu MEU prontuário". */
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', default: null },

    /** De onde. */
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 300 },

    resultado: { type: String, enum: ['ok', 'negado', 'erro'], default: 'ok' },

    /** Contexto adicional — **nunca** conteúdo clínico. */
    metadados: { type: Schema.Types.Mixed, default: null },
  },
  { versionKey: false },
)

// As duas perguntas que se faz a um log de auditoria: "quem tocou nesta
// jornada?" e "o que esta pessoa andou fazendo?".
auditoriaSchema.index({ jornada: 1, em: -1 })
auditoriaSchema.index({ atorId: 1, em: -1 })

export type AuditoriaDoc = InferSchemaType<typeof auditoriaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Auditoria: mongoose.Model<AuditoriaDoc> =
  (mongoose.models.Auditoria as mongoose.Model<AuditoriaDoc>) ??
  mongoose.model<AuditoriaDoc>('Auditoria', auditoriaSchema)
