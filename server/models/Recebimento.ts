import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * O que a médica tem a receber por um atendimento.
 *
 * ## Isto NÃO é dado clínico, e a diferença muda o escopo inteiro
 *
 * Todo o resto do Prumo é escopado por `Crianca` — a jornada é da família, e o
 * médico alcança por vínculo. Aqui é o contrário: **o dado é do médico**. Quanto
 * ele cobrou, se recebeu, por qual convênio — isso é o negócio dele, e a
 * paciente não tem nada com isso.
 *
 * A consequência prática é uma regra dura: um recebimento **nunca** entra na
 * exportação LGPD da paciente, nem no pacote de transferência. Se um dia
 * aparecer lá, é vazamento — na direção contrária da usual, mas vazamento.
 *
 * Por isso o índice principal é `{ medicoId, competencia }`, e `jornada` existe
 * só para o médico saber de quem era a consulta.
 *
 * ## Dinheiro em centavos
 *
 * `valorCentavos` é inteiro. Ponto flutuante para dinheiro é o defeito clássico
 * que aparece depois de mil linhas somadas e some quando se procura: `0.1 + 0.2`
 * não é `0.3`, e um relatório que fecha com dois centavos de diferença destrói a
 * confiança no sistema inteiro.
 *
 * ## Não é TISS
 *
 * Deliberado. TISS 4.x é meses de trabalho com particularidades por operadora, e
 * só paga para quem fatura convênio direto. Isto aqui responde a pergunta que a
 * obstetra faz todo mês — *quanto entrou?* — e nada além.
 */
export const FORMAS_PAGAMENTO = [
  'pix',
  'dinheiro',
  'cartao-credito',
  'cartao-debito',
  'transferencia',
  'convenio',
  'outro',
] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const ESTADOS_RECEBIMENTO = ['previsto', 'recebido', 'cancelado'] as const
export type EstadoRecebimento = (typeof ESTADOS_RECEBIMENTO)[number]

const recebimentoSchema = new Schema(
  {
    /** O dono do dado. Tudo é escopado por aqui. */
    medicoId: { type: String, required: true, index: true },

    /** De quem era a consulta. Para o médico se situar, não para a paciente ler. */
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', default: null },
    pacienteNome: { type: String, default: '', maxlength: 120 },

    agendamento: { type: Schema.Types.ObjectId, ref: 'Agendamento', default: null, index: true },
    consulta: { type: Schema.Types.ObjectId, ref: 'Consulta', default: null },

    /** Inteiro. Ver o comentário do topo. */
    valorCentavos: { type: Number, required: true, min: 0 },
    forma: { type: String, enum: FORMAS_PAGAMENTO, default: 'pix' },
    /** Preenchido quando `forma` é convênio. Nome livre — não há tabela padrão. */
    convenio: { type: String, default: '', maxlength: 80 },

    estado: { type: String, enum: ESTADOS_RECEBIMENTO, default: 'previsto', index: true },

    /** Quando o atendimento aconteceu — a data que define a competência. */
    dataAtendimento: { type: Date, required: true },
    /** Quando o dinheiro entrou. Nulo enquanto `previsto`. */
    recebidoEm: { type: Date, default: null },

    /**
     * `AAAA-MM` do atendimento, denormalizado.
     *
     * O relatório mensal é a única consulta que este modelo serve, e agrupar por
     * mês a partir de um `Date` exige `$dateToString` em agregação — que não usa
     * índice. Uma string derivada custa 7 bytes e transforma o relatório num
     * range scan.
     */
    competencia: { type: String, required: true, index: true },

    observacao: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
)

recebimentoSchema.index({ medicoId: 1, competencia: 1 })
recebimentoSchema.index({ medicoId: 1, dataAtendimento: -1 })
/**
 * Um agendamento gera **um** recebimento. Sem isso, clicar duas vezes em
 * "registrar" dobra o faturamento do mês — e ninguém confere um relatório
 * financeiro contra a agenda item a item.
 *
 * `sparse` porque recebimento avulso (sem agendamento) é caso legítimo.
 */
recebimentoSchema.index(
  { agendamento: 1 },
  { unique: true, sparse: true, partialFilterExpression: { agendamento: { $type: 'objectId' } } },
)

export type RecebimentoDoc = InferSchemaType<typeof recebimentoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Recebimento: mongoose.Model<RecebimentoDoc> =
  (mongoose.models.Recebimento as mongoose.Model<RecebimentoDoc>) ??
  mongoose.model<RecebimentoDoc>('Recebimento', recebimentoSchema)

/** `AAAA-MM` de uma data. Puro, para o relatório e para o teste. */
export function competenciaDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}
