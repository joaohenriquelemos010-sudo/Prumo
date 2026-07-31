import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'

/**
 * O **conteúdo** de um checklist. Nunca o estado de ninguém.
 *
 * Template e instância vivem separados de propósito: assim, corrigir uma
 * explicação ou acrescentar um passo não reescreve o progresso de nenhuma
 * paciente, e `versao` fixa exatamente o que ela viu quando marcou.
 *
 * ## Exatamente dois níveis
 *
 * `grupos` (o que fazer) → `passos` (como fazer). E para aí — `passos` não têm
 * filhos, e isso é garantido pelo tipo. É o requisito, e é também o que mantém a
 * tela legível: um terceiro nível transformaria o checklist numa árvore que
 * ninguém navega no celular com uma mão.
 *
 * ## Linguagem
 *
 * `explicacaoLeiga` é escrita **para a gestante**, não para o prontuário. É a
 * diferença entre "rastreio de SGB entre 35 e 37 semanas" e "é um cotonete que a
 * enfermeira passa, rápido e sem dor, para ver se tem uma bactéria comum que
 * precisa de antibiótico na hora do parto".
 */
const passoSchema = new Schema(
  {
    id: { type: String, required: true },
    titulo: { type: String, required: true, maxlength: 160 },
    /** O "como", em palavras dela. Opcional: nem todo passo precisa. */
    explicacaoLeiga: { type: String, default: '', maxlength: 600 },
    dica: { type: String, default: '', maxlength: 300 },
    /** Passo que nem toda gestante precisa cumprir. Não conta no progresso. */
    opcional: { type: Boolean, default: false },
  },
  { _id: false },
)

const janelaSchema = new Schema(
  {
    desdeSemana: { type: Number, default: null },
    ateSemana: { type: Number, default: null },
    desdeMes: { type: Number, default: null },
    ateMes: { type: Number, default: null },
  },
  { _id: false },
)

/**
 * Quando lembrar. **Nada é enviado ainda** — a fase de lembretes lê estes
 * campos. Estão aqui desde já porque retroencaixar agendamento em conteúdo já
 * publicado significaria reescrever todos os templates.
 */
const lembreteSchema = new Schema(
  {
    antecedenciaDias: { type: Number, default: 0 },
    canal: { type: String, enum: ['email', 'inapp'], default: 'inapp' },
    repetirDias: { type: Number, default: 0 },
  },
  { _id: false },
)

const grupoSchema = new Schema(
  {
    id: { type: String, required: true },
    titulo: { type: String, required: true, maxlength: 160 },
    resumo: { type: String, default: '', maxlength: 300 },
    /** O quê e por quê, em linguagem leiga. Sempre visível, nunca escondida. */
    explicacaoLeiga: { type: String, required: true, maxlength: 1200 },
    porqueImporta: { type: String, default: '', maxlength: 400 },
    /** A citação clínica. A gestante não precisa ler, mas tem direito de ver. */
    fonte: { type: String, default: '', maxlength: 300 },
    icone: { type: String, default: 'circulo', maxlength: 40 },
    janela: { type: janelaSchema, default: () => ({}) },
    lembrete: { type: lembreteSchema, default: () => ({}) },
    passos: { type: [passoSchema], default: [] },
  },
  { _id: false },
)

const templateSchema = new Schema(
  {
    chave: { type: String, required: true },
    versao: { type: Number, required: true, default: 1 },
    programa: { type: String, default: 'materno-infantil', index: true },
    publico: {
      type: String,
      enum: ['gestante', 'familia', 'medico'],
      default: 'gestante',
    },
    /** `prumo` = conteúdo nosso; `medico` = criado por um profissional. */
    origem: { type: String, enum: ['prumo', 'medico'], default: 'prumo' },
    autorId: { type: String, default: '' },
    titulo: { type: String, required: true, maxlength: 160 },
    descricao: { type: String, default: '', maxlength: 500 },
    icone: { type: String, default: 'lista', maxlength: 40 },
    /** Fase do programa em que este checklist faz sentido. */
    fase: { type: String, default: '', index: true },
    grupos: { type: [grupoSchema], default: [] },
  },
  { timestamps: true },
)

templateSchema.index({ chave: 1, versao: 1 }, { unique: true })

export type ChecklistTemplateDoc = InferSchemaType<typeof templateSchema> & {
  _id: mongoose.Types.ObjectId
}

export const ChecklistTemplate: mongoose.Model<ChecklistTemplateDoc> =
  (mongoose.models.ChecklistTemplate as mongoose.Model<ChecklistTemplateDoc>) ??
  mongoose.model<ChecklistTemplateDoc>('ChecklistTemplate', templateSchema)
