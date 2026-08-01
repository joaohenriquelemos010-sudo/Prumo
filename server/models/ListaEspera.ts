import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Lista de espera — quem quer ser atendido antes do que a agenda oferece.
 *
 * O caso real é sempre o mesmo: a agenda está cheia até o mês que vem, alguém
 * cancela na quinta, e a secretária precisa saber **quem chamar primeiro** sem
 * abrir a caixa de mensagens. Sem isso, o horário vago simplesmente é perdido —
 * é o buraco mais caro de uma agenda cheia, porque custa faturamento e custa
 * atendimento a quem estava esperando.
 *
 * Aponta para uma jornada quando a paciente já existe no sistema, e guarda nome
 * e telefone soltos quando não — a mesma decisão do cadastro sem conta: nada
 * aqui pode esperar por um cadastro que talvez nunca venha.
 */
export const ESTADOS_ESPERA = ['aguardando', 'chamado', 'agendado', 'desistiu'] as const
export type EstadoEspera = (typeof ESTADOS_ESPERA)[number]

const listaEsperaSchema = new Schema(
  {
    medicoId: { type: String, required: true, index: true },
    jornada: { type: Schema.Types.ObjectId, ref: 'Crianca', default: null, index: true },
    /** Preenchidos mesmo quando há jornada — é o que a secretária lê e disca. */
    nome: { type: String, required: true, trim: true, maxlength: 80 },
    telefone: { type: String, default: '', maxlength: 20 },
    tipoAtendimento: { type: Schema.Types.ObjectId, ref: 'TipoAtendimento', default: null },
    tipoNome: { type: String, default: '', maxlength: 60 },
    /**
     * 1 = urgente, 2 = preferencial, 3 = quando der.
     *
     * Números e não rótulos porque a ordenação é a única coisa que a lista faz
     * de verdade, e ordenar por rótulo exigiria um mapa que se desatualiza.
     */
    prioridade: { type: Number, default: 3, min: 1, max: 3, index: true },
    /** Quando ela pode vir — "só de manhã", "qualquer dia menos terça". */
    disponibilidade: { type: String, default: '', maxlength: 160 },
    observacao: { type: String, default: '', maxlength: 300 },
    estado: { type: String, enum: ESTADOS_ESPERA, default: 'aguardando', index: true },
    chamadoEm: { type: Date, default: null },
    resolvidoEm: { type: Date, default: null },
    /** O agendamento que nasceu daqui — fecha o ciclo e evita chamar duas vezes. */
    agendamento: { type: Schema.Types.ObjectId, ref: 'Agendamento', default: null },
  },
  { timestamps: true },
)

// A única consulta que a tela faz: a fila deste médico, na ordem de chamar.
listaEsperaSchema.index({ medicoId: 1, estado: 1, prioridade: 1, createdAt: 1 })

export type ListaEsperaDoc = InferSchemaType<typeof listaEsperaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const ListaEspera: mongoose.Model<ListaEsperaDoc> =
  (mongoose.models.ListaEspera as mongoose.Model<ListaEsperaDoc>) ??
  mongoose.model<ListaEsperaDoc>('ListaEspera', listaEsperaSchema)
