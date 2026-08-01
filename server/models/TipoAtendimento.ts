import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * Os tipos de consulta que **este** médico oferece.
 *
 * Até aqui o produto tinha três tipos fixos no código (`pre-natal`,
 * `puericultura`, `pre-concepcional`) e **uma** duração global. Isso não descreve
 * nenhum consultório real: "retorno de 15 minutos", "primeira consulta de 50",
 * "ultrassom obstétrico de 30" são coisas diferentes que precisam ocupar espaços
 * diferentes na agenda.
 *
 * Chama-se `TipoAtendimento`, e não `TipoConsulta`, porque `TipoConsulta` já é
 * o nome do enum antigo em `models/Consulta.ts`. Renomear aquele enum obrigaria
 * a migrar todo registro existente por nada — o nome novo custa uma palavra e
 * evita a confusão de dois conceitos com o mesmo nome.
 *
 * Cada tipo aponta para um **formulário de prontuário**
 * (`server/conteudo/prontuario-templates.ts`). É essa ligação que faz a primeira
 * consulta abrir a anamnese completa e o retorno abrir o acompanhamento, sem o
 * médico escolher nada.
 */
const tipoAtendimentoSchema = new Schema(
  {
    medicoId: { type: String, required: true, index: true },
    nome: { type: String, required: true, trim: true, maxlength: 60 },
    duracaoMin: { type: Number, default: 30, min: 5, max: 480 },
    /**
     * A cor na agenda. Um dia cheio se lê pela mancha antes de se ler pelo
     * texto — é o que diz "hoje é dia de retorno" num relance.
     */
    cor: { type: String, default: 'indigo', maxlength: 20 },
    /** Chave em `conteudo/prontuario-templates.ts`. */
    template: { type: String, default: 'soap-generico', maxlength: 60 },
    /**
     * Procedimento, não consulta (ultrassom, inserção de DIU, colposcopia).
     * Muda o que se espera do registro: laudo, não anamnese.
     */
    procedimento: { type: Boolean, default: false },
    /** Some da lista sem sumir do histórico — atendimentos antigos apontam para cá. */
    ativo: { type: Boolean, default: true },
    ordem: { type: Number, default: 0 },
    observacaoPadrao: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
)

// Dois tipos com o mesmo nome no mesmo consultório seriam indistinguíveis na
// agenda — que é justamente onde eles precisam ser escolhidos rápido.
tipoAtendimentoSchema.index({ medicoId: 1, nome: 1 }, { unique: true })

export type TipoAtendimentoDoc = InferSchemaType<typeof tipoAtendimentoSchema> & {
  _id: mongoose.Types.ObjectId
}

export const TipoAtendimento: mongoose.Model<TipoAtendimentoDoc> =
  (mongoose.models.TipoAtendimento as mongoose.Model<TipoAtendimentoDoc>) ??
  mongoose.model<TipoAtendimentoDoc>('TipoAtendimento', tipoAtendimentoSchema)

/**
 * O que um médico encontra pronto ao entrar pela primeira vez.
 *
 * Configuração em branco é a forma mais confiável de um recurso não ser usado:
 * quem abre a agenda quer marcar uma consulta, não desenhar um catálogo. Estes
 * cobrem o consultório de GO e pediatria no primeiro dia, e são editáveis.
 */
export const PADROES_POR_ESPECIALIDADE: Record<
  string,
  { nome: string; duracaoMin: number; template: string; cor: string; procedimento?: boolean }[]
> = {
  obstetricia: [
    { nome: 'Pré-natal — primeira consulta', duracaoMin: 50, template: 'pre-natal-primeira', cor: 'lilas' },
    { nome: 'Pré-natal — retorno', duracaoMin: 25, template: 'pre-natal-retorno', cor: 'indigo' },
    { nome: 'Ultrassom obstétrico', duracaoMin: 30, template: 'soap-generico', cor: 'azul', procedimento: true },
    { nome: 'Consulta ginecológica', duracaoMin: 40, template: 'ginecologia-primeira', cor: 'lilas' },
  ],
  ginecologia: [
    { nome: 'Ginecologia — primeira consulta', duracaoMin: 50, template: 'ginecologia-primeira', cor: 'lilas' },
    { nome: 'Ginecologia — retorno', duracaoMin: 25, template: 'ginecologia-retorno', cor: 'indigo' },
    { nome: 'Preventivo', duracaoMin: 30, template: 'soap-generico', cor: 'azul', procedimento: true },
  ],
  pediatria: [
    { nome: 'Puericultura — primeira consulta', duracaoMin: 50, template: 'puericultura-primeira', cor: 'lilas' },
    { nome: 'Puericultura — retorno', duracaoMin: 25, template: 'puericultura-retorno', cor: 'indigo' },
    { nome: 'Consulta eventual', duracaoMin: 30, template: 'soap-generico', cor: 'azul' },
  ],
}

/** Sem especialidade reconhecida, o mínimo que serve para qualquer um. */
export const PADRAO_GENERICO: (typeof PADROES_POR_ESPECIALIDADE)[string] = [
  { nome: 'Primeira consulta', duracaoMin: 50, template: 'soap-generico', cor: 'lilas' },
  { nome: 'Retorno', duracaoMin: 25, template: 'soap-generico', cor: 'indigo' },
]

/**
 * Da especialidade escrita à mão no cadastro para o conjunto de padrões.
 *
 * O campo é texto livre ("Obstetrícia", "Ginecologia e Obstetrícia", "GO"), então
 * a leitura é por substring e sem acento — e o pior caso é o conjunto genérico,
 * nunca um erro.
 */
export function padroesPara(especialidade: string | undefined | null) {
  const e = String(especialidade ?? '')
    .toLowerCase()
    .normalize('NFD')
    // Escapes explícitos: os combining marks literais são invisíveis no editor,
    // e um deles apagado por engano some sem deixar rastro.
    .replace(/[\u0300-\u036f]/g, '')

  if (e.includes('pediatr')) return PADROES_POR_ESPECIALIDADE.pediatria
  if (e.includes('obstetr')) return PADROES_POR_ESPECIALIDADE.obstetricia
  if (e.includes('ginecolog')) return PADROES_POR_ESPECIALIDADE.ginecologia
  return PADRAO_GENERICO
}
